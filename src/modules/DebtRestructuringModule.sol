// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CampaignStorage} from "../host/CampaignStorage.sol";
import {IGrowfiCampaignTokenMint} from "../interfaces/IGrowfiCampaignTokenMint.sol";
import {IHarvestManagerDebtRestructuring} from "../interfaces/IHarvestManagerDebtRestructuring.sol";

/// @title  DebtRestructuringModule
/// @notice Last-resort conversion of unpaid harvest USDC claims into newly
///         minted CampaignToken after the producer deposit window has expired.
///
///         The holder must first claim every USDC unit already available in
///         HarvestManager. Only the residual unpaid shortfall can be converted.
///         If the season is covered by collateral, all available collateral must
///         be exhausted before this module can mint compensating CampaignToken.
///
///         Storage namespace: `keccak256("growfi.module.debt.restructuring.v1")`.
contract DebtRestructuringModule {
    struct Layout {
        mapping(uint256 => bool) seasonStarted;
        mapping(uint256 => mapping(address => uint256)) campaignTokensClaimed;
        mapping(uint256 => mapping(address => uint256)) usdcShortfallConverted;
        uint256 reentrancyStatus;
        bool initialized;
    }

    bytes32 internal constant STORAGE_SLOT = 0xc7ea81bd06fad1a7d624a5ec9ac64ff9dbbcd9447d0f815af5a88c8080289e12; // keccak256("growfi.module.debt.restructuring.v1")
    bytes32 internal constant SALE_CLASSIC_SLOT = 0xd7250d23bb7bc8e93366cf6815d31bcb947e004baa702b9bb515d6082501a234; // keccak256("growfi.module.sale.classic.v1")
    bytes32 internal constant COLLATERAL_SLOT = 0x1d5c7025e27f7f3a598a1ed3ef2f3b18a3b6b8f8025c5754e51904d497088646; // keccak256("growfi.module.collateral.v1")

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint8 internal constant REDEMPTION_USDC = 2;

    error AlreadyInitialized();
    error OnlyFactoryBootstrap();
    error OnlyProducer();
    error Reentrant();
    error NotInitialized();
    error InvalidState();
    error SeasonNotReported();
    error RestructuringNotOpen();
    error NotUsdcRedemption();
    error ClaimUSDCFirst();
    error NoShortfall();
    error PrincipalNotSet();
    error CollateralAvailable();
    error ZeroAmount();

    event DebtRestructuringInitialized();
    event DebtRestructuringStarted(uint256 indexed seasonId);
    event CampaignTokensMintedForShortfall(
        address indexed holder,
        uint256 indexed seasonId,
        uint256 usdcShortfall,
        uint256 campaignTokensMinted,
        uint256 pricePerToken
    );

    function _s() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    modifier onlyProducer() {
        if (msg.sender != CampaignStorage.layout().producer) revert OnlyProducer();
        _;
    }

    modifier nonReentrant() {
        Layout storage s = _s();
        if (s.reentrancyStatus == _ENTERED) revert Reentrant();
        s.reentrancyStatus = _ENTERED;
        _;
        s.reentrancyStatus = _NOT_ENTERED;
    }

    function initializeDebtRestructuring() external {
        Layout storage s = _s();
        CampaignStorage.Layout storage cs = CampaignStorage.layout();
        if (s.initialized) revert AlreadyInitialized();
        if (msg.sender != cs.factory || !cs.factoryBootstrap) revert OnlyFactoryBootstrap();
        s.reentrancyStatus = _NOT_ENTERED;
        s.initialized = true;
        emit DebtRestructuringInitialized();
    }

    function initializeDebtRestructuringByProducer() external onlyProducer {
        Layout storage s = _s();
        if (s.initialized) revert AlreadyInitialized();
        s.reentrancyStatus = _NOT_ENTERED;
        s.initialized = true;
        emit DebtRestructuringInitialized();
    }

    function claimRestructuredCampaignTokens(uint256 seasonId) external nonReentrant returns (uint256 minted) {
        Layout storage s = _s();
        if (!s.initialized) revert NotInitialized();

        CampaignStorage.Layout storage cs = CampaignStorage.layout();
        if (cs.campaignToken == address(0) || cs.harvestManager == address(0)) revert InvalidState();
        // Emergency pause (producer or factory) freezes this mint path too —
        // it is the one user-facing entrypoint that mints CampaignToken.
        if (cs.paused || cs.factoryPaused) revert InvalidState();

        IHarvestManagerDebtRestructuring hm = IHarvestManagerDebtRestructuring(cs.harvestManager);
        (,,,,,, uint256 usdcDeadline, uint256 usdcDeposited, uint256 usdcOwed,,, bool reported) =
            hm.seasonHarvests(seasonId);
        if (!reported) revert SeasonNotReported();
        if (block.timestamp <= usdcDeadline) revert RestructuringNotOpen();

        (bool claimed, uint8 redemptionType,, uint256 usdcAmount, uint256 usdcClaimed) = hm.claims(seasonId, msg.sender);
        if (!claimed || redemptionType != REDEMPTION_USDC) revert NotUsdcRedemption();
        if (usdcAmount <= usdcClaimed) revert NoShortfall();

        uint256 entitlement = usdcAmount;
        if (usdcDeposited < usdcOwed) {
            entitlement = usdcAmount * usdcDeposited / usdcOwed;
        }
        uint256 claimable = entitlement - usdcClaimed;
        if (claimable >= 1e12) revert ClaimUSDCFirst();

        _requireCollateralExhausted(seasonId);

        uint256 shortfall = hm.restructureUSDCShortfall(seasonId, msg.sender);
        if (shortfall == 0) revert NoShortfall();

        uint256 pricePerToken = _readPricePerToken();
        if (pricePerToken == 0) revert PrincipalNotSet();

        minted = shortfall * 1e18 / pricePerToken;
        if (minted == 0) revert ZeroAmount();

        if (!s.seasonStarted[seasonId]) {
            s.seasonStarted[seasonId] = true;
            emit DebtRestructuringStarted(seasonId);
        }

        s.usdcShortfallConverted[seasonId][msg.sender] += shortfall;
        s.campaignTokensClaimed[seasonId][msg.sender] += minted;
        _increaseSaleCurrentSupply(minted);
        IGrowfiCampaignTokenMint(cs.campaignToken).mint(msg.sender, minted);

        emit CampaignTokensMintedForShortfall(msg.sender, seasonId, shortfall, minted, pricePerToken);
    }

    function quoteRestructuredCampaignTokens(uint256 seasonId, address holder)
        external
        view
        returns (uint256 usdcShortfall, uint256 campaignTokensOut)
    {
        CampaignStorage.Layout storage cs = CampaignStorage.layout();
        if (cs.harvestManager == address(0)) return (0, 0);
        IHarvestManagerDebtRestructuring hm = IHarvestManagerDebtRestructuring(cs.harvestManager);

        (,,,,,, uint256 usdcDeadline, uint256 usdcDeposited, uint256 usdcOwed,,, bool reported) =
            hm.seasonHarvests(seasonId);
        if (!reported || block.timestamp <= usdcDeadline) return (0, 0);

        (bool claimed, uint8 redemptionType,, uint256 usdcAmount, uint256 usdcClaimed) = hm.claims(seasonId, holder);
        if (!claimed || redemptionType != REDEMPTION_USDC || usdcAmount <= usdcClaimed) return (0, 0);

        uint256 entitlement = usdcAmount;
        if (usdcDeposited < usdcOwed) {
            entitlement = usdcAmount * usdcDeposited / usdcOwed;
        }
        uint256 claimable = entitlement - usdcClaimed;
        if (claimable >= 1e12) return (0, 0);
        (uint256 coverageHarvests, uint256 availableCollateral) = _collateralStatus();
        if (seasonId <= coverageHarvests && availableCollateral > 0) return (0, 0);

        usdcShortfall = usdcAmount - usdcClaimed;
        uint256 pricePerToken = _readPricePerToken();
        if (pricePerToken == 0) return (usdcShortfall, 0);
        campaignTokensOut = usdcShortfall * 1e18 / pricePerToken;
    }

    function debtRestructuringStarted(uint256 seasonId) external view returns (bool) {
        return _s().seasonStarted[seasonId];
    }

    function restructuredCampaignTokensClaimed(uint256 seasonId, address holder) external view returns (uint256) {
        return _s().campaignTokensClaimed[seasonId][holder];
    }

    function restructuredUsdcShortfall(uint256 seasonId, address holder) external view returns (uint256) {
        return _s().usdcShortfallConverted[seasonId][holder];
    }

    function _requireCollateralExhausted(uint256 seasonId) internal view {
        (uint256 coverageHarvests, uint256 availableCollateral) = _collateralStatus();
        if (seasonId <= coverageHarvests && availableCollateral > 0) revert CollateralAvailable();
    }

    function _collateralStatus() internal view returns (uint256 coverageHarvests, uint256 availableCollateral) {
        bytes32 slot = COLLATERAL_SLOT;
        uint256 locked;
        uint256 drawn;
        assembly {
            coverageHarvests := sload(add(slot, 3))
            locked := sload(add(slot, 4))
            drawn := sload(add(slot, 5))
        }
        if (locked > drawn) {
            availableCollateral = locked - drawn;
        }
    }

    function _readPricePerToken() internal view returns (uint256 price) {
        bytes32 slot = SALE_CLASSIC_SLOT;
        assembly {
            price := sload(slot)
        }
    }

    function _increaseSaleCurrentSupply(uint256 amount) internal {
        bytes32 slot = SALE_CLASSIC_SLOT;
        assembly {
            let currentSupplySlot := add(slot, 6)
            sstore(currentSupplySlot, add(sload(currentSupplySlot), amount))
        }
    }
}
