// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {GrowfiCampaignToken} from "./GrowfiCampaignToken.sol";
import {GrowfiYieldToken} from "./GrowfiYieldToken.sol";

interface IGrowfiFactoryTreasuryView {
    function growfiTreasury() external view returns (address);
}

/// @title GrowfiStakingVault — Staking, Dynamic Yield, Penalties
/// @notice Users stake $CAMPAIGN to earn $YIELD. Dynamic yield rate: 5x at 0% fill, 1x at 100%.
///         Synthetix-style accumulator for O(1) gas yield calculations.
///         Each stake() creates an independent position with its own penalty timeline.
/// @dev    Initializable so it can be deployed as an EIP-1167 clone.
contract GrowfiStakingVault is Initializable, ReentrancyGuard, PausableUpgradeable {
    using SafeERC20 for IERC20;

    // --- Constants ---

    uint256 public constant MAX_YIELD_RATE = 5e18; // 5 $YIELD/token/day at 0% fill
    uint256 public constant MIN_YIELD_RATE = 1e18; // 1 $YIELD/token/day at 100% fill
    uint256 public constant RATE_PRECISION = 1e18;
    uint256 public constant SECONDS_PER_DAY = 86_400;
    uint256 public constant MAX_POSITIONS_PER_USER = 50;

    // --- Structs ---

    struct Position {
        address owner;
        uint256 amount;
        uint256 startTime;
        uint256 rewardPerTokenPaid;
        uint256 seasonId;
        bool active;
    }

    struct Season {
        uint256 startTime;
        uint256 endTime;
        uint256 totalYieldMinted;
        uint256 rewardPerTokenAtEnd; // snapshot of accumulator when season ended
        /// @notice Running sum of all yield ACCRUED for this season — both minted and
        ///         still-owed (unclaimed). Grows with the accumulator, shrinks when a
        ///         position unstakes early (forfeits its pending yield).
        ///         Locked in at endSeason, used as the canonical snapshot denominator
        ///         for harvest redemption (immune to post-snapshot claim timing).
        uint256 totalYieldOwed;
        bool active;
        bool existed; // true once this seasonId has been used
    }

    // --- State ---

    GrowfiCampaignToken public campaignToken;
    GrowfiYieldToken public yieldToken;
    address public campaign;
    address public factory;
    uint256 public maxSupply;
    uint256 public seasonDuration;

    uint256 public totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;

    uint256 public nextPositionId;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositionIds;

    uint256 public currentSeasonId;
    mapping(uint256 => Season) public seasons;

    /// @dev Appended storage for the season-isolated accounting upgrade.
    ///      Existing proxies use totalStaked until the factory initializes this
    ///      value or the next season starts.
    uint256 private _currentSeasonStaked;
    bool public seasonStakeAccountingInitialized;

    // --- Events ---

    event Staked(
        address indexed user, uint256 indexed positionId, uint256 amount, uint256 newTotalStaked, uint256 newYieldRate
    );
    event Unstaked(
        address indexed user,
        uint256 indexed positionId,
        uint256 stakedAmount,
        uint256 penaltyAmount,
        uint256 returnedAmount,
        uint256 yieldForfeited,
        uint256 newTotalStaked,
        uint256 newYieldRate
    );
    event Restaked(address indexed user, uint256 indexed positionId, uint256 amount, uint256 newSeasonId);
    event YieldMinted(address indexed user, uint256 indexed positionId, uint256 yieldAmount, uint256 seasonId);
    event YieldRateUpdated(uint256 newYieldRate, uint256 totalStaked_, uint256 maxSupply_);
    event SeasonStarted(uint256 indexed seasonId, uint256 startTime);
    event SeasonEnded(uint256 indexed seasonId, uint256 endTime, uint256 totalYieldMinted);

    // --- Errors ---

    error OnlyCampaign();
    error UnauthorizedForceUnstake();
    error OnlyFactory();
    error NotPositionOwner();
    error PositionNotActive();
    error NoActiveSeason();
    error SeasonAlreadyActive();
    error ZeroAmount();
    error YieldTokenAlreadySet();
    error TooManyPositions();
    error SeasonAlreadyUsed();
    error RestakeSameSeason();
    error InvalidSeasonStake();
    error SeasonStakeAccountingAlreadyInitialized();
    error SeasonStakeAccountingMigrationRequiresPause();

    // --- Modifiers ---

    modifier onlyCampaign() {
        if (msg.sender != campaign) revert OnlyCampaign();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier updateReward() {
        _updateRewardPerToken();
        _;
    }

    // --- Constructor ---

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address campaignToken_,
        address campaign_,
        address factory_,
        uint256 maxSupply_,
        uint256 seasonDuration_
    ) external initializer {
        __Pausable_init();
        campaignToken = GrowfiCampaignToken(campaignToken_);
        campaign = campaign_;
        factory = factory_;
        maxSupply = maxSupply_;
        seasonDuration = seasonDuration_;
        seasonStakeAccountingInitialized = true;
    }

    /// @notice Initialize season-isolated stake accounting after upgrading an
    ///         existing proxy. The factory should call this at a season boundary
    ///         with zero, or with the exact current-season eligible stake.
    function initializeSeasonStakeAccounting(uint256 eligibleStake) external onlyFactory {
        if (seasonStakeAccountingInitialized) revert SeasonStakeAccountingAlreadyInitialized();
        if (!paused()) revert SeasonStakeAccountingMigrationRequiresPause();
        if (eligibleStake > totalStaked) revert InvalidSeasonStake();
        _currentSeasonStaked = eligibleStake;
        seasonStakeAccountingInitialized = true;
    }

    /// @notice Set the GrowfiYieldToken address. Can only be called once.
    function setYieldToken(address yieldToken_) external onlyCampaign {
        if (address(yieldToken) != address(0)) revert YieldTokenAlreadySet();
        yieldToken = GrowfiYieldToken(yieldToken_);
    }

    // --- Staking ---

    /// @notice Stake $CAMPAIGN tokens. Creates a new position.
    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward returns (uint256 positionId) {
        if (amount == 0) revert ZeroAmount();
        if (!seasons[currentSeasonId].active) revert NoActiveSeason();
        if (userPositionIds[msg.sender].length >= MAX_POSITIONS_PER_USER) revert TooManyPositions();

        // Transfer $CAMPAIGN from user
        IERC20(address(campaignToken)).safeTransferFrom(msg.sender, address(this), amount);

        totalStaked += amount;
        if (seasonStakeAccountingInitialized) {
            _currentSeasonStaked += amount;
        }

        positionId = nextPositionId++;
        positions[positionId] = Position({
            owner: msg.sender,
            amount: amount,
            startTime: block.timestamp,
            rewardPerTokenPaid: rewardPerTokenStored,
            seasonId: currentSeasonId,
            active: true
        });
        userPositionIds[msg.sender].push(positionId);

        uint256 newRate = currentYieldRate();
        emit Staked(msg.sender, positionId, amount, totalStaked, newRate);
        emit YieldRateUpdated(newRate, totalStaked, maxSupply);
    }

    /// @notice Unstake a specific position. Applies linear penalty, forfeits $YIELD.
    /// @dev    Not gated by `whenNotPaused`: users must always be able to exit their
    ///         principal even during an emergency pause. Pause only blocks NEW stakes.
    function unstake(uint256 positionId) external nonReentrant updateReward {
        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionNotActive();

        uint256 stakedAmount = pos.amount;

        // Calculate yield that would have been earned (forfeited)
        uint256 yieldForfeited = _earned(positionId);

        // Calculate penalty
        uint256 elapsed = block.timestamp - pos.startTime;
        uint256 penaltyAmount;
        uint256 returnedAmount;

        if (elapsed >= seasonDuration) {
            // No penalty after full season
            penaltyAmount = 0;
            returnedAmount = stakedAmount;
        } else {
            // Linear penalty: penaltyRate = 1 - (elapsed / seasonDuration)
            penaltyAmount = stakedAmount * (seasonDuration - elapsed) / seasonDuration;
            returnedAmount = stakedAmount - penaltyAmount;
        }

        // Forfeited yield is subtracted from the season's owed total so the
        // snapshot used by GrowfiHarvestManager reflects only yield that will be
        // minted, not yield that will never exist.
        if (yieldForfeited > 0) {
            Season storage posSeason = seasons[pos.seasonId];
            if (posSeason.totalYieldOwed >= yieldForfeited) {
                posSeason.totalYieldOwed -= yieldForfeited;
            } else {
                posSeason.totalYieldOwed = 0;
            }
        }

        // Deactivate position
        pos.active = false;
        pos.amount = 0;
        totalStaked -= stakedAmount;
        _removeCurrentSeasonStake(pos.seasonId, stakedAmount);

        // Burn penalty amount
        if (penaltyAmount > 0) {
            campaignToken.burn(address(this), penaltyAmount);
        }

        // Return remainder to user
        if (returnedAmount > 0) {
            IERC20(address(campaignToken)).safeTransfer(msg.sender, returnedAmount);
        }

        uint256 newRate = currentYieldRate();
        emit Unstaked(
            msg.sender, positionId, stakedAmount, penaltyAmount, returnedAmount, yieldForfeited, totalStaked, newRate
        );
        emit YieldRateUpdated(newRate, totalStaked, maxSupply);
    }

    /// @notice Penalty-free exit that returns the full CT principal and accrued YIELD.
    /// @dev The Campaign may force any position for repayment flows. The protocol
    ///      Treasury may force only positions that it owns, keeping staked Treasury
    ///      CampaignTokens fully available as redeemable backing.
    function forceUnstake(uint256 positionId) external nonReentrant updateReward {
        Position storage pos = positions[positionId];
        if (!pos.active) revert PositionNotActive();

        if (msg.sender != campaign) {
            if (pos.owner != msg.sender) revert UnauthorizedForceUnstake();

            address treasury;
            try IGrowfiFactoryTreasuryView(factory).growfiTreasury() returns (address configuredTreasury) {
                treasury = configuredTreasury;
            } catch {
                revert UnauthorizedForceUnstake();
            }
            if (treasury == address(0) || msg.sender != treasury) revert UnauthorizedForceUnstake();
        }

        address owner_ = pos.owner;
        uint256 stakedAmount = pos.amount;
        uint256 pending = _earned(positionId);

        if (pending > 0) {
            pos.rewardPerTokenPaid = rewardPerTokenStored;
            yieldToken.mint(owner_, pending);
            seasons[pos.seasonId].totalYieldMinted += pending;
            emit YieldMinted(owner_, positionId, pending, pos.seasonId);
        }

        pos.active = false;
        pos.amount = 0;
        totalStaked -= stakedAmount;
        _removeCurrentSeasonStake(pos.seasonId, stakedAmount);

        if (stakedAmount > 0) {
            IERC20(address(campaignToken)).safeTransfer(owner_, stakedAmount);
        }

        uint256 newRate = currentYieldRate();
        emit Unstaked(owner_, positionId, stakedAmount, 0, stakedAmount, 0, totalStaked, newRate);
        emit YieldRateUpdated(newRate, totalStaked, maxSupply);
    }

    /// @notice Restake a position into the next season. Cannot restake within the same season.
    function restake(uint256 positionId) external nonReentrant whenNotPaused updateReward {
        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionNotActive();
        if (!seasons[currentSeasonId].active) revert NoActiveSeason();
        if (pos.seasonId == currentSeasonId) revert RestakeSameSeason();

        // Claim any pending yield first
        uint256 pending = _earned(positionId);
        if (pending > 0) {
            yieldToken.mint(msg.sender, pending);
            seasons[pos.seasonId].totalYieldMinted += pending;
            emit YieldMinted(msg.sender, positionId, pending, pos.seasonId);
        }

        // Reset for new season
        pos.startTime = block.timestamp;
        pos.rewardPerTokenPaid = rewardPerTokenStored;
        pos.seasonId = currentSeasonId;
        if (seasonStakeAccountingInitialized) {
            _currentSeasonStaked += pos.amount;
        }

        emit Restaked(msg.sender, positionId, pos.amount, currentSeasonId);
    }

    /// @notice Restake all active positions for the caller.
    function restakeAll() external nonReentrant whenNotPaused updateReward {
        if (!seasons[currentSeasonId].active) revert NoActiveSeason();

        uint256[] storage ids = userPositionIds[msg.sender];
        for (uint256 i = 0; i < ids.length; i++) {
            Position storage pos = positions[ids[i]];
            if (!pos.active) continue;
            if (pos.seasonId == currentSeasonId) continue; // skip already in current season

            uint256 pending = _earned(ids[i]);
            if (pending > 0) {
                yieldToken.mint(msg.sender, pending);
                seasons[pos.seasonId].totalYieldMinted += pending;
                emit YieldMinted(msg.sender, ids[i], pending, pos.seasonId);
            }

            pos.startTime = block.timestamp;
            pos.rewardPerTokenPaid = rewardPerTokenStored;
            pos.seasonId = currentSeasonId;
            if (seasonStakeAccountingInitialized) {
                _currentSeasonStaked += pos.amount;
            }

            emit Restaked(msg.sender, ids[i], pos.amount, currentSeasonId);
        }
    }

    // --- Yield Claiming ---

    /// @notice Claim accumulated $YIELD for a specific position.
    function claimYield(uint256 positionId) external nonReentrant updateReward {
        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionNotActive();

        uint256 pending = _earned(positionId);
        if (pending > 0) {
            pos.rewardPerTokenPaid = rewardPerTokenStored;
            yieldToken.mint(msg.sender, pending);
            seasons[pos.seasonId].totalYieldMinted += pending;
            emit YieldMinted(msg.sender, positionId, pending, pos.seasonId);
        }
    }

    /// @notice Claim accumulated $YIELD across all active positions.
    function claimAllYield() external nonReentrant updateReward {
        uint256[] storage ids = userPositionIds[msg.sender];
        for (uint256 i = 0; i < ids.length; i++) {
            Position storage pos = positions[ids[i]];
            if (!pos.active) continue;

            uint256 pending = _earned(ids[i]);
            if (pending > 0) {
                pos.rewardPerTokenPaid = rewardPerTokenStored;
                yieldToken.mint(msg.sender, pending);
                seasons[pos.seasonId].totalYieldMinted += pending;
                emit YieldMinted(msg.sender, ids[i], pending, pos.seasonId);
            }
        }
    }

    // --- Season Management ---

    /// @notice Start a new season. Only callable by campaign (via factory/producer).
    function startSeason(uint256 seasonId) external onlyCampaign updateReward {
        if (seasons[currentSeasonId].active) revert SeasonAlreadyActive();
        if (seasons[seasonId].existed) revert SeasonAlreadyUsed();

        currentSeasonId = seasonId;
        _currentSeasonStaked = 0;
        seasonStakeAccountingInitialized = true;
        seasons[seasonId] = Season({
            startTime: block.timestamp,
            endTime: 0,
            totalYieldMinted: 0,
            rewardPerTokenAtEnd: 0,
            totalYieldOwed: 0,
            active: true,
            existed: true
        });
        lastUpdateTime = block.timestamp;

        emit SeasonStarted(seasonId, block.timestamp);
    }

    /// @notice End the current season. Stops yield accrual.
    function endSeason() external onlyCampaign updateReward {
        Season storage season = seasons[currentSeasonId];
        if (!season.active) revert NoActiveSeason();

        season.endTime = block.timestamp;
        season.rewardPerTokenAtEnd = rewardPerTokenStored;
        season.active = false;

        emit SeasonEnded(currentSeasonId, block.timestamp, season.totalYieldMinted);
    }

    // --- Pause ---

    function emergencyPause() external onlyFactory {
        _pause();
    }

    function emergencyUnpause() external onlyFactory {
        _unpause();
    }

    // --- Views ---

    /// @notice Current dynamic yield rate (18 decimals). 5e18 at 0% fill, 1e18 at 100%.
    function currentYieldRate() public view returns (uint256) {
        if (maxSupply == 0) return MIN_YIELD_RATE;
        // yieldRate = 5 - 4 * (current-season eligible stake / maxSupply)
        uint256 fillRatio = currentSeasonStaked() * RATE_PRECISION / maxSupply;
        uint256 decay = (MAX_YIELD_RATE - MIN_YIELD_RATE) * fillRatio / RATE_PRECISION;
        return MAX_YIELD_RATE - decay;
    }

    /// @notice Stake that is eligible to accrue in the current season.
    function currentSeasonStaked() public view returns (uint256) {
        return seasonStakeAccountingInitialized ? _currentSeasonStaked : totalStaked;
    }

    /// @notice Get earned $YIELD for a position (not yet claimed).
    function earned(uint256 positionId) external view returns (uint256) {
        Position storage pos = positions[positionId];
        if (!pos.active) return 0;

        uint256 applicableRpt;
        Season storage posSeason = seasons[pos.seasonId];
        if (pos.seasonId == currentSeasonId && posSeason.active) {
            applicableRpt = _rewardPerTokenCurrent();
        } else if (posSeason.rewardPerTokenAtEnd > 0) {
            applicableRpt = posSeason.rewardPerTokenAtEnd;
        } else {
            return 0;
        }

        if (applicableRpt <= pos.rewardPerTokenPaid) return 0;
        return pos.amount * (applicableRpt - pos.rewardPerTokenPaid) / RATE_PRECISION;
    }

    /// @notice Get all position IDs for a user.
    function getPositions(address user) external view returns (uint256[] memory) {
        return userPositionIds[user];
    }

    /// @notice Total yield ever accrued for a season (minted + still-owed, minus forfeits).
    ///         Frozen after `endSeason`; used as the canonical snapshot denominator for
    ///         harvest redemption so late claims cannot oversubscribe the USDC pool.
    function seasonTotalYieldOwed(uint256 seasonId) external view returns (uint256) {
        return seasons[seasonId].totalYieldOwed;
    }

    /// @notice Remove inactive positions from the caller's array to free slots for new stakes.
    function compactPositions() external {
        uint256[] storage ids = userPositionIds[msg.sender];
        uint256 writeIdx = 0;
        for (uint256 readIdx = 0; readIdx < ids.length; readIdx++) {
            if (positions[ids[readIdx]].active) {
                if (writeIdx != readIdx) {
                    ids[writeIdx] = ids[readIdx];
                }
                writeIdx++;
            }
        }
        // Trim the array
        while (ids.length > writeIdx) {
            ids.pop();
        }
    }

    // --- Internal ---

    function _updateRewardPerToken() internal {
        uint256 current = _rewardPerTokenCurrent();
        uint256 eligibleStake = currentSeasonStaked();
        if (current > rewardPerTokenStored && eligibleStake > 0 && seasons[currentSeasonId].active) {
            uint256 delta = current - rewardPerTokenStored;
            seasons[currentSeasonId].totalYieldOwed += delta * eligibleStake / RATE_PRECISION;
        }
        rewardPerTokenStored = current;
        lastUpdateTime = block.timestamp;
    }

    function _rewardPerTokenCurrent() internal view returns (uint256) {
        uint256 eligibleStake = currentSeasonStaked();
        if (eligibleStake == 0) return rewardPerTokenStored;
        if (!seasons[currentSeasonId].active) return rewardPerTokenStored;

        uint256 elapsed = block.timestamp - lastUpdateTime;
        // yieldRatePerSecond = currentYieldRate / SECONDS_PER_DAY
        // rewardPerToken += elapsed * yieldRatePerSecond * RATE_PRECISION / totalStaked
        uint256 rate = currentYieldRate();
        uint256 rewardAccrued = elapsed * rate / SECONDS_PER_DAY;
        return rewardPerTokenStored + rewardAccrued * RATE_PRECISION / eligibleStake;
    }

    function _removeCurrentSeasonStake(uint256 positionSeasonId, uint256 amount) internal {
        if (!seasonStakeAccountingInitialized || positionSeasonId != currentSeasonId) return;
        if (amount > _currentSeasonStaked) revert InvalidSeasonStake();
        _currentSeasonStaked -= amount;
    }

    function _earned(uint256 positionId) internal view returns (uint256) {
        Position storage pos = positions[positionId];
        if (!pos.active) return 0;

        // Cap yield to the position's season. If the position's season has ended,
        // use the snapshot taken at season end — not the live accumulator.
        uint256 applicableRpt;
        Season storage posSeason = seasons[pos.seasonId];
        if (pos.seasonId == currentSeasonId && posSeason.active) {
            // Position is in the current active season — use live accumulator
            applicableRpt = rewardPerTokenStored;
        } else if (posSeason.rewardPerTokenAtEnd > 0) {
            // Position's season has ended — cap at that season's end snapshot
            applicableRpt = posSeason.rewardPerTokenAtEnd;
        } else {
            // Season hasn't started accruing yet or no snapshot
            return 0;
        }

        if (applicableRpt <= pos.rewardPerTokenPaid) return 0;
        return pos.amount * (applicableRpt - pos.rewardPerTokenPaid) / RATE_PRECISION;
    }
}
