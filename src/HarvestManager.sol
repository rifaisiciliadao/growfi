// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {YieldToken} from "./YieldToken.sol";

/// @title HarvestManager — Harvest Reporting & Two-Step Redemption
/// @notice Producer reports harvest → holders burn $YIELD to redeem product (Merkle) or USDC.
///         2% protocol fee deducted on harvest report.
contract HarvestManager is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // --- Structs ---

    struct SeasonHarvest {
        bytes32 merkleRoot;
        uint256 totalHarvestValueUSD; // 70% of gross, 18 decimals
        uint256 totalYieldSupply; // snapshot of total $YIELD at report time
        uint256 totalProductUnits; // e.g., liters (18 decimals)
        uint256 claimStart;
        uint256 claimEnd;
        uint256 usdcDeadline; // claimEnd + 90 days
        uint256 usdcDeposited;
        uint256 usdcOwed;
        uint256 protocolFeeCollected;
        bool reported;
    }

    enum RedemptionType {
        None,
        Product,
        USDC
    }

    struct Claim {
        bool claimed;
        RedemptionType redemptionType;
        uint256 amount; // $YIELD burned
        uint256 usdcAmount; // USDC owed (only for USDC redemption), 18 decimals
        uint256 usdcClaimed; // USDC already claimed, 18 decimals
    }

    // --- State ---

    YieldToken public yieldToken;
    IERC20 public immutable usdc;
    address public immutable producer;
    address public immutable factory;
    address public immutable protocolFeeRecipient;
    uint256 public immutable protocolFeeBps; // 200 = 2%
    uint256 public immutable minProductClaim; // minimum product units for product redemption (18 decimals)
    bool private _yieldTokenSet;

    uint256 public constant USDC_DEPOSIT_WINDOW = 90 days;

    mapping(uint256 => SeasonHarvest) public seasonHarvests;
    mapping(uint256 => mapping(address => Claim)) public claims;

    // --- Events ---

    event HarvestReported(
        uint256 indexed seasonId,
        uint256 totalHarvestValueUSD,
        uint256 protocolFee,
        uint256 holderPool,
        uint256 totalProductUnits,
        bytes32 merkleRoot,
        uint256 claimStart,
        uint256 claimEnd,
        uint256 usdcDeadline
    );

    event ProductRedeemed(
        address indexed user, uint256 indexed seasonId, uint256 yieldBurned, uint256 productAmount, bytes32 merkleLeaf
    );

    event USDCRedeemed(address indexed user, uint256 indexed seasonId, uint256 yieldBurned, uint256 usdcAmount);

    event USDCDeposited(
        uint256 indexed seasonId, address indexed producer_, uint256 amount, uint256 totalDeposited, uint256 totalOwed
    );

    event USDCClaimed(address indexed user, uint256 indexed seasonId, uint256 amount);

    event ProtocolFeeCollected(uint256 indexed seasonId, uint256 amount, address recipient);

    // --- Errors ---

    error OnlyProducer();
    error OnlyFactory();
    error AlreadyReported();
    error NotReported();
    error ClaimWindowClosed();
    error ClaimWindowNotOpen();
    error AlreadyClaimed();
    error BelowMinProductClaim();
    error InvalidMerkleProof();
    error ZeroAmount();
    error USDCNotDeposited();
    error DepositWindowClosed();

    // --- Modifiers ---

    modifier onlyProducer() {
        if (msg.sender != producer) revert OnlyProducer();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    // --- Constructor ---

    constructor(
        address usdc_,
        address producer_,
        address factory_,
        address protocolFeeRecipient_,
        uint256 protocolFeeBps_,
        uint256 minProductClaim_
    ) {
        usdc = IERC20(usdc_);
        producer = producer_;
        factory = factory_;
        protocolFeeRecipient = protocolFeeRecipient_;
        protocolFeeBps = protocolFeeBps_;
        minProductClaim = minProductClaim_;
    }

    /// @notice Set the YieldToken address. Can only be called once by the factory.
    function setYieldToken(address yieldToken_) external onlyFactory {
        require(!_yieldTokenSet, "Already set");
        yieldToken = YieldToken(yieldToken_);
        _yieldTokenSet = true;
    }

    // --- Harvest Reporting ---

    /// @notice Producer reports the harvest for a season.
    /// @param seasonId Season identifier.
    /// @param totalValueUSD 70% of gross harvest value (18 decimals).
    /// @param merkleRoot Merkle root for product claims.
    /// @param totalUnits Total product units available (18 decimals, e.g., liters).
    function reportHarvest(uint256 seasonId, uint256 totalValueUSD, bytes32 merkleRoot, uint256 totalUnits)
        external
        onlyProducer
    {
        SeasonHarvest storage harvest = seasonHarvests[seasonId];
        if (harvest.reported) revert AlreadyReported();

        uint256 protocolFee = totalValueUSD * protocolFeeBps / 10_000;
        uint256 holderPool = totalValueUSD - protocolFee;

        uint256 totalYieldSupply = yieldToken.totalSupply();

        harvest.merkleRoot = merkleRoot;
        harvest.totalHarvestValueUSD = totalValueUSD;
        harvest.totalYieldSupply = totalYieldSupply;
        harvest.totalProductUnits = totalUnits;
        harvest.claimStart = block.timestamp;
        harvest.claimEnd = block.timestamp + 30 days;
        harvest.usdcDeadline = block.timestamp + 30 days + USDC_DEPOSIT_WINDOW;
        harvest.protocolFeeCollected = protocolFee;
        harvest.reported = true;

        emit HarvestReported(
            seasonId,
            totalValueUSD,
            protocolFee,
            holderPool,
            totalUnits,
            merkleRoot,
            harvest.claimStart,
            harvest.claimEnd,
            harvest.usdcDeadline
        );
        emit ProtocolFeeCollected(seasonId, protocolFee, protocolFeeRecipient);
    }

    // --- Redemption ---

    /// @notice Redeem $YIELD for physical product. Burns $YIELD, verifies Merkle proof.
    function redeemProduct(uint256 seasonId, uint256 yieldAmount, bytes32[] calldata merkleProof)
        external
        nonReentrant
        whenNotPaused
    {
        SeasonHarvest storage harvest = seasonHarvests[seasonId];
        if (!harvest.reported) revert NotReported();
        if (block.timestamp < harvest.claimStart || block.timestamp > harvest.claimEnd) revert ClaimWindowClosed();

        Claim storage claim = claims[seasonId][msg.sender];
        if (claim.claimed) revert AlreadyClaimed();
        if (yieldAmount == 0) revert ZeroAmount();

        // Calculate product amount
        uint256 productAmount = yieldAmount * harvest.totalProductUnits / harvest.totalYieldSupply;
        if (productAmount < minProductClaim) revert BelowMinProductClaim();

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, seasonId, productAmount));
        if (!MerkleProof.verify(merkleProof, harvest.merkleRoot, leaf)) revert InvalidMerkleProof();

        // Burn $YIELD
        yieldToken.burn(msg.sender, yieldAmount);

        claim.claimed = true;
        claim.redemptionType = RedemptionType.Product;
        claim.amount = yieldAmount;

        emit ProductRedeemed(msg.sender, seasonId, yieldAmount, productAmount, leaf);
    }

    /// @notice Redeem $YIELD for USDC. Burns $YIELD, registers USDC claim.
    function redeemUSDC(uint256 seasonId, uint256 yieldAmount) external nonReentrant whenNotPaused {
        SeasonHarvest storage harvest = seasonHarvests[seasonId];
        if (!harvest.reported) revert NotReported();
        if (block.timestamp < harvest.claimStart || block.timestamp > harvest.claimEnd) revert ClaimWindowClosed();

        Claim storage claim = claims[seasonId][msg.sender];
        if (claim.claimed) revert AlreadyClaimed();
        if (yieldAmount == 0) revert ZeroAmount();

        // Calculate USDC amount: yieldAmount * holderPool / totalYieldSupply
        uint256 holderPool = harvest.totalHarvestValueUSD - harvest.protocolFeeCollected;
        uint256 usdcAmount = yieldAmount * holderPool / harvest.totalYieldSupply;

        // Burn $YIELD
        yieldToken.burn(msg.sender, yieldAmount);

        claim.claimed = true;
        claim.redemptionType = RedemptionType.USDC;
        claim.amount = yieldAmount;
        claim.usdcAmount = usdcAmount;

        harvest.usdcOwed += usdcAmount;

        emit USDCRedeemed(msg.sender, seasonId, yieldAmount, usdcAmount);
    }

    /// @notice Claim deposited USDC after producer has deposited. Can be called multiple times as producer deposits more.
    function claimUSDC(uint256 seasonId) external nonReentrant {
        Claim storage claim = claims[seasonId][msg.sender];
        if (claim.redemptionType != RedemptionType.USDC) revert NotReported();
        if (claim.usdcAmount == 0) revert ZeroAmount();

        SeasonHarvest storage harvest = seasonHarvests[seasonId];
        if (harvest.usdcDeposited == 0) revert USDCNotDeposited();

        // Calculate pro-rata entitlement based on current deposits
        uint256 entitlement = claim.usdcAmount;
        if (harvest.usdcDeposited < harvest.usdcOwed) {
            entitlement = claim.usdcAmount * harvest.usdcDeposited / harvest.usdcOwed;
        }

        // Only transfer the difference from what was already claimed
        uint256 claimable = entitlement - claim.usdcClaimed;
        if (claimable == 0) revert ZeroAmount();

        claim.usdcClaimed += claimable;

        // Transfer USDC (18 decimals → 6 decimals)
        uint256 usdcToTransfer = claimable / 1e12;
        usdc.safeTransfer(msg.sender, usdcToTransfer);

        emit USDCClaimed(msg.sender, seasonId, usdcToTransfer);
    }

    // --- Producer USDC Deposit ---

    /// @notice Producer deposits USDC to cover USDC redemption claims.
    function depositUSDC(uint256 seasonId, uint256 amount) external onlyProducer nonReentrant {
        SeasonHarvest storage harvest = seasonHarvests[seasonId];
        if (!harvest.reported) revert NotReported();
        if (block.timestamp > harvest.usdcDeadline) revert DepositWindowClosed();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        harvest.usdcDeposited += uint256(amount) * 1e12; // 6 decimals → 18 decimals for comparison

        emit USDCDeposited(seasonId, msg.sender, amount, harvest.usdcDeposited, harvest.usdcOwed);
    }

    // --- Pause ---

    function emergencyPause() external onlyFactory {
        _pause();
    }

    function emergencyUnpause() external onlyFactory {
        _unpause();
    }

    // --- Views ---

    function getYieldFloorPrice(uint256 seasonId) external view returns (uint256) {
        SeasonHarvest storage harvest = seasonHarvests[seasonId];
        if (!harvest.reported || harvest.totalYieldSupply == 0) return 0;
        uint256 holderPool = harvest.totalHarvestValueUSD - harvest.protocolFeeCollected;
        return holderPool * 1e18 / harvest.totalYieldSupply;
    }
}
