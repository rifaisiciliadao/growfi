// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {IGrowfiCampaignView} from "../src/interfaces/IGrowfiCampaignView.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";

contract MigrateMainnetTshirtHarvestCommitment is Script {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    address internal constant CAMPAIGN = 0x3Cae6813bbA201a1953Caac00A70f3B4e6DAB23f;
    address internal constant PRODUCER = 0xE6c30AD5AeE7AD22e9F39D51d67667587cdD05A1;
    address internal constant PREVIOUS_COLLATERAL_IMPL = 0x09cC36a83fd80C278B16A9F91b4360782bf4E9f6;
    address internal constant CURRENT_COLLATERAL_IMPL = 0x1e6D432813BA9B4477ACCC87788bf461c1A55B02;

    bytes32 internal constant TYPE_COLLATERAL = keccak256("growfi.type.collateral");
    bytes32 internal constant KIND_COLLATERAL = keccak256("growfi.collateral.v1");

    uint256 internal constant TARGET_ANNUAL_HARVEST_USD = 1_000e18;
    uint256 internal constant TARGET_ANNUAL_HARVEST_QUANTITY = 40e18;
    uint256 internal constant TARGET_FIRST_HARVEST_YEAR = 2026;
    uint256 internal constant TARGET_COVERAGE_HARVESTS = 0;

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(FACTORY);
        GrowfiCampaign campaign = GrowfiCampaign(payable(CAMPAIGN));
        IGrowfiCampaignView campaignView = IGrowfiCampaignView(CAMPAIGN);
        CollateralModule collateral = CollateralModule(payable(CAMPAIGN));

        address owner = factory.owner();
        require(campaign.producer() == PRODUCER, "unexpected producer");
        require(campaign.factory() == FACTORY, "unexpected factory");
        require(!campaign.paused(), "campaign paused");
        require(uint8(campaign.state()) <= 1, "campaign not funding or active");

        (address previousImpl, bytes32 kind, string memory metadataURI,, bool enabled) =
            campaign.moduleSlot(TYPE_COLLATERAL);
        require(previousImpl == PREVIOUS_COLLATERAL_IMPL, "unexpected collateral implementation");
        require(kind == KIND_COLLATERAL, "unexpected collateral kind");
        require(enabled, "collateral module disabled");
        require(collateral.collateralLocked() == 0, "collateral already locked");
        require(collateral.collateralDrawn() == 0, "collateral already drawn");
        require(factory.isModuleImplApproved(KIND_COLLATERAL, CURRENT_COLLATERAL_IMPL), "new impl not approved");

        uint256 previousAnnualUsd = collateral.expectedAnnualHarvestUsd();
        uint256 previousAnnualQuantity = collateral.expectedAnnualHarvest();
        uint256 previousFirstHarvestYear = collateral.firstHarvestYear();
        uint256 previousCoverageHarvests = collateral.coverageHarvests();
        uint256 previousPricePerToken = campaignView.pricePerToken();
        uint256 previousMinCap = campaignView.minCap();
        uint256 previousMaxCap = campaignView.maxCap();
        uint256 previousCurrentSupply = campaignView.currentSupply();

        require(previousAnnualUsd == 1_000e18, "unexpected annual USD value");
        require(previousAnnualQuantity == 50e18, "unexpected annual quantity");
        require(previousFirstHarvestYear == 2026, "unexpected first harvest year");
        require(previousCoverageHarvests == 0, "unexpected coverage");
        require(previousAnnualUsd * 1e18 / previousAnnualQuantity == 20e18, "unexpected current unit price");
        require(
            TARGET_ANNUAL_HARVEST_USD * 1e18 / TARGET_ANNUAL_HARVEST_QUANTITY == 25e18, "unexpected target unit price"
        );

        bool forkSimulation = vm.envOr("FORK_SIMULATION", uint256(0)) == 1;
        bool updateCommitment;

        if (forkSimulation) {
            vm.prank(owner);
            factory.replaceCampaignModule(
                CAMPAIGN, TYPE_COLLATERAL, KIND_COLLATERAL, CURRENT_COLLATERAL_IMPL, metadataURI
            );
            vm.prank(PRODUCER);
            collateral.updateHarvestCommitment(_targetCommitment());
            updateCommitment = true;
        } else {
            uint256 ownerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
            require(vm.addr(ownerPk) == owner, "deployer is not factory owner");
            vm.startBroadcast(ownerPk);
            factory.replaceCampaignModule(
                CAMPAIGN, TYPE_COLLATERAL, KIND_COLLATERAL, CURRENT_COLLATERAL_IMPL, metadataURI
            );
            vm.stopBroadcast();

            uint256 producerPk = vm.envOr("TSHIRT_PRODUCER_PRIVATE_KEY", uint256(0));
            if (producerPk != 0) {
                require(vm.addr(producerPk) == PRODUCER, "signer is not campaign producer");
                vm.startBroadcast(producerPk);
                collateral.updateHarvestCommitment(_targetCommitment());
                vm.stopBroadcast();
                updateCommitment = true;
            }
        }

        (address currentImpl,,,, bool currentEnabled) = campaign.moduleSlot(TYPE_COLLATERAL);
        require(currentImpl == CURRENT_COLLATERAL_IMPL, "collateral migration failed");
        require(currentEnabled, "collateral module not enabled");
        require(
            campaign.selectorToType(CollateralModule.updateHarvestCommitment.selector) == TYPE_COLLATERAL,
            "selector missing"
        );
        require(collateral.collateralLocked() == 0, "collateral lock changed");
        require(collateral.collateralDrawn() == 0, "collateral draw changed");
        require(campaignView.pricePerToken() == previousPricePerToken, "token price changed");
        require(campaignView.minCap() == previousMinCap, "min cap changed");
        require(campaignView.maxCap() == previousMaxCap, "max cap changed");
        require(campaignView.currentSupply() == previousCurrentSupply, "current supply changed");

        if (updateCommitment) {
            require(collateral.expectedAnnualHarvestUsd() == TARGET_ANNUAL_HARVEST_USD, "annual USD update failed");
            require(
                collateral.expectedAnnualHarvest() == TARGET_ANNUAL_HARVEST_QUANTITY, "annual quantity update failed"
            );
            require(collateral.firstHarvestYear() == TARGET_FIRST_HARVEST_YEAR, "first year update failed");
            require(collateral.coverageHarvests() == TARGET_COVERAGE_HARVESTS, "coverage update failed");
        } else {
            require(collateral.expectedAnnualHarvestUsd() == previousAnnualUsd, "annual USD changed during migration");
            require(
                collateral.expectedAnnualHarvest() == previousAnnualQuantity, "annual quantity changed during migration"
            );
            require(collateral.firstHarvestYear() == previousFirstHarvestYear, "first year changed during migration");
            require(collateral.coverageHarvests() == previousCoverageHarvests, "coverage changed during migration");
        }

        console.log("factory", FACTORY);
        console.log("campaign", CAMPAIGN);
        console.log("collateral implementation", currentImpl);
        console.log("commitment updated", updateCommitment);
    }

    function _targetCommitment() internal pure returns (CollateralModule.InitParams memory) {
        return CollateralModule.InitParams({
            expectedAnnualHarvestUsd: TARGET_ANNUAL_HARVEST_USD,
            expectedAnnualHarvest: TARGET_ANNUAL_HARVEST_QUANTITY,
            firstHarvestYear: TARGET_FIRST_HARVEST_YEAR,
            coverageHarvests: TARGET_COVERAGE_HARVESTS
        });
    }
}
