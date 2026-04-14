// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {CampaignToken} from "./CampaignToken.sol";
import {YieldToken} from "./YieldToken.sol";
import {Campaign} from "./Campaign.sol";
import {StakingVault} from "./StakingVault.sol";
import {HarvestManager} from "./HarvestManager.sol";

/// @title CampaignFactory — Deployer & Registry
/// @notice Deploys and wires all campaign contracts. Stores registry of all campaigns.
///         Owner is the protocol multisig.
contract CampaignFactory is Ownable {
    // --- Constants ---

    uint256 public constant PROTOCOL_FEE_BPS = 200; // 2%

    // --- Structs ---

    struct CampaignContracts {
        address campaign;
        address campaignToken;
        address yieldToken;
        address stakingVault;
        address harvestManager;
        address producer;
        uint256 createdAt;
    }

    // --- State ---

    address public protocolFeeRecipient;
    address public immutable usdc;

    CampaignContracts[] public campaigns;
    mapping(address => bool) public isCampaign;

    // --- Events ---

    event CampaignCreated(
        address indexed campaign,
        address indexed producer,
        address campaignToken,
        address yieldToken,
        address stakingVault,
        address harvestManager,
        uint256 pricePerToken,
        uint256 minCap,
        uint256 maxCap,
        uint256 fundingDeadline,
        uint256 seasonDuration,
        uint256 minProductClaim,
        uint256 createdAt
    );

    event ProtocolFeeRecipientUpdated(address oldRecipient, address newRecipient);

    // --- Constructor ---

    constructor(address owner_, address protocolFeeRecipient_, address usdc_) Ownable(owner_) {
        protocolFeeRecipient = protocolFeeRecipient_;
        usdc = usdc_;
    }

    // --- Campaign Creation ---

    struct CreateCampaignParams {
        address producer;
        string tokenName;
        string tokenSymbol;
        string yieldName;
        string yieldSymbol;
        uint256 pricePerToken;
        uint256 minCap;
        uint256 maxCap;
        uint256 fundingDeadline;
        uint256 seasonDuration;
        uint256 minProductClaim;
    }

    /// @notice Deploy a full campaign suite. Deployment order resolves circular deps via setters.
    function createCampaign(CreateCampaignParams calldata params) external onlyOwner returns (address) {
        require(params.producer != address(0), "Zero producer");
        require(params.pricePerToken > 0, "Zero price");
        require(params.maxCap > 0, "Zero maxCap");
        require(params.minCap <= params.maxCap, "minCap > maxCap");
        require(params.fundingDeadline > block.timestamp, "Deadline in past");
        require(params.seasonDuration >= 30 days, "Season too short");

        // 1. Deploy Campaign (without CampaignToken — will be set via setter)
        Campaign campaign = new Campaign(
            params.producer,
            address(this),
            params.pricePerToken,
            params.minCap,
            params.maxCap,
            params.fundingDeadline,
            params.seasonDuration,
            PROTOCOL_FEE_BPS,
            protocolFeeRecipient
        );

        // 2. Deploy CampaignToken pointing to Campaign
        CampaignToken campaignToken = new CampaignToken(params.tokenName, params.tokenSymbol, address(campaign));

        // 3. Wire Campaign ↔ CampaignToken
        campaign.setCampaignToken(address(campaignToken));

        // 4. Deploy StakingVault
        StakingVault stakingVault = new StakingVault(
            address(campaignToken), address(campaign), address(this), params.maxCap, params.seasonDuration
        );

        // 5. Wire CampaignToken ↔ StakingVault (via Campaign, which is the authorized caller)
        campaign.setStakingVault(address(stakingVault));

        // 6. Deploy HarvestManager (without YieldToken — will be set via setter)
        HarvestManager harvestManager = new HarvestManager(
            usdc, params.producer, address(this), protocolFeeRecipient, PROTOCOL_FEE_BPS, params.minProductClaim
        );

        // 7. Deploy YieldToken pointing to StakingVault + HarvestManager
        YieldToken yieldToken =
            new YieldToken(params.yieldName, params.yieldSymbol, address(stakingVault), address(harvestManager));

        // 8. Wire HarvestManager ↔ YieldToken
        harvestManager.setYieldToken(address(yieldToken));

        // 9. Wire StakingVault ↔ YieldToken (via Campaign, which is the authorized caller)
        campaign.setYieldToken(address(yieldToken));

        // Register
        campaigns.push(
            CampaignContracts({
                campaign: address(campaign),
                campaignToken: address(campaignToken),
                yieldToken: address(yieldToken),
                stakingVault: address(stakingVault),
                harvestManager: address(harvestManager),
                producer: params.producer,
                createdAt: block.timestamp
            })
        );
        isCampaign[address(campaign)] = true;

        emit CampaignCreated(
            address(campaign),
            params.producer,
            address(campaignToken),
            address(yieldToken),
            address(stakingVault),
            address(harvestManager),
            params.pricePerToken,
            params.minCap,
            params.maxCap,
            params.fundingDeadline,
            params.seasonDuration,
            params.minProductClaim,
            block.timestamp
        );

        return address(campaign);
    }

    // --- Admin ---

    function setProtocolFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Zero address");
        emit ProtocolFeeRecipientUpdated(protocolFeeRecipient, newRecipient);
        protocolFeeRecipient = newRecipient;
    }

    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    // --- Emergency ---

    /// @notice Pause all contracts for a specific campaign.
    function pauseCampaign(uint256 campaignIndex) external onlyOwner {
        CampaignContracts storage c = campaigns[campaignIndex];
        Campaign(c.campaign).emergencyPause();
        StakingVault(c.stakingVault).emergencyPause();
        HarvestManager(c.harvestManager).emergencyPause();
    }

    /// @notice Unpause all contracts for a specific campaign.
    function unpauseCampaign(uint256 campaignIndex) external onlyOwner {
        CampaignContracts storage c = campaigns[campaignIndex];
        Campaign(c.campaign).emergencyUnpause();
        StakingVault(c.stakingVault).emergencyUnpause();
        HarvestManager(c.harvestManager).emergencyUnpause();
    }
}
