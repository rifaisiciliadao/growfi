// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {GrowfiCampaignFactory} from "../../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../../src/GrowfiCampaign.sol";
import {IGrowfiCampaignFull} from "../../src/interfaces/IGrowfiCampaignFull.sol";
import {SaleClassicModule} from "../../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../../src/modules/CollateralModule.sol";
import {ProjectUpdatesModule} from "../../src/modules/ProjectUpdatesModule.sol";

import {MockERC20} from "../helpers/MockERC20.sol";
import {Deployer} from "../helpers/Deployer.sol";
import {ProjectUpdatesHelper} from "./ProjectUpdatesHelper.sol";

contract ProjectUpdatesModuleTest is Test {
    bytes32 internal constant TYPE_PROJECT_UPDATES = keccak256("growfi.type.project.updates");
    bytes32 internal constant KIND_PROJECT_UPDATES = keccak256("growfi.project.updates.v1");

    GrowfiCampaignFactory internal factory;
    MockERC20 internal usdc;
    IGrowfiCampaignFull internal campaign;
    ProjectUpdatesModule internal updatesImpl;
    address internal campaignAddr;

    address internal owner = address(this);
    address internal producer = makeAddr("producer");
    address internal alice = makeAddr("alice");
    address internal feeRecipient = makeAddr("feeRecipient");

    event ProjectUpdatePosted(
        uint256 indexed updateId, address indexed author, string metadataURI, bytes32 contentHash
    );
    event ProjectUpdateHidden(uint256 indexed updateId, address indexed author, bool hidden);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        factory = Deployer.deployProtocol(owner, feeRecipient, address(usdc), address(0));
        updatesImpl = new ProjectUpdatesModule();

        vm.startPrank(owner);
        factory.setModuleKindSelectors(KIND_PROJECT_UPDATES, ProjectUpdatesHelper.selectors());
        factory.approveModuleImpl(KIND_PROJECT_UPDATES, address(updatesImpl), true);
        vm.stopPrank();

        _createCampaign();

        vm.prank(producer);
        GrowfiCampaign(payable(campaignAddr))
            .attachModule(TYPE_PROJECT_UPDATES, KIND_PROJECT_UPDATES, address(updatesImpl), "");
    }

    function test_postProjectUpdateStoresEvidenceAndEmits() public {
        bytes32 contentHash = keccak256("update-json");
        string memory uri = "https://cdn.growfi.dev/project-updates/1.json";

        vm.expectEmit(true, true, false, true, campaignAddr);
        emit ProjectUpdatePosted(1, producer, uri, contentHash);

        vm.prank(producer);
        uint256 id = ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate(uri, contentHash);

        assertEq(id, 1);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).projectUpdateCount(), 1);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).visibleProjectUpdateCount(), 1);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).projectUpdateIdAt(0), 1);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).nextProjectUpdateId(), 2);

        ProjectUpdatesModule.UpdateRecord memory record =
            ProjectUpdatesModule(payable(campaignAddr)).projectUpdate(1);
        assertEq(record.id, 1);
        assertEq(record.author, producer);
        assertEq(record.metadataURI, uri);
        assertEq(record.contentHash, contentHash);
        assertEq(record.postedAt, block.timestamp);
        assertFalse(record.hidden);
        assertTrue(record.exists);
    }

    function test_multipleUpdatesIncrementIds() public {
        vm.startPrank(producer);
        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate("ipfs://one", keccak256("one"));
        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate("ipfs://two", keccak256("two"));
        vm.stopPrank();

        assertEq(ProjectUpdatesModule(payable(campaignAddr)).projectUpdateCount(), 2);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).visibleProjectUpdateCount(), 2);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).projectUpdateIdAt(0), 1);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).projectUpdateIdAt(1), 2);
    }

    function test_hideAndUnhideProjectUpdate() public {
        vm.prank(producer);
        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate("ipfs://one", keccak256("one"));

        vm.expectEmit(true, true, false, true, campaignAddr);
        emit ProjectUpdateHidden(1, producer, true);
        vm.prank(producer);
        ProjectUpdatesModule(payable(campaignAddr)).setProjectUpdateHidden(1, true);

        ProjectUpdatesModule.UpdateRecord memory hidden =
            ProjectUpdatesModule(payable(campaignAddr)).projectUpdate(1);
        assertTrue(hidden.hidden);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).visibleProjectUpdateCount(), 0);

        vm.prank(producer);
        ProjectUpdatesModule(payable(campaignAddr)).setProjectUpdateHidden(1, false);
        ProjectUpdatesModule.UpdateRecord memory visible =
            ProjectUpdatesModule(payable(campaignAddr)).projectUpdate(1);
        assertFalse(visible.hidden);
        assertEq(ProjectUpdatesModule(payable(campaignAddr)).visibleProjectUpdateCount(), 1);
    }

    function test_rejectsNonProducerAndBadInputs() public {
        vm.prank(alice);
        vm.expectRevert(ProjectUpdatesModule.OnlyProducer.selector);
        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate("ipfs://one", keccak256("one"));

        vm.startPrank(producer);
        vm.expectRevert(ProjectUpdatesModule.InvalidMetadataURI.selector);
        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate("", keccak256("one"));

        string memory tooLong = new string(513);
        vm.expectRevert(ProjectUpdatesModule.InvalidMetadataURI.selector);
        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate(tooLong, keccak256("one"));

        vm.expectRevert(ProjectUpdatesModule.InvalidContentHash.selector);
        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate("ipfs://one", bytes32(0));

        vm.expectRevert(ProjectUpdatesModule.UpdateMissing.selector);
        ProjectUpdatesModule(payable(campaignAddr)).setProjectUpdateHidden(9, true);

        ProjectUpdatesModule(payable(campaignAddr)).postProjectUpdate("ipfs://one", keccak256("one"));
        vm.expectRevert(ProjectUpdatesModule.NoChange.selector);
        ProjectUpdatesModule(payable(campaignAddr)).setProjectUpdateHidden(1, false);
        vm.stopPrank();
    }

    function _createCampaign() internal {
        uint256 nonce = factory.campaignsLength();
        vm.prank(producer);
        factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: producer,
                campaignTokenName: string.concat("Campaign ", vm.toString(nonce)),
                campaignTokenSymbol: "CMP",
                yieldTokenName: string.concat("Yield ", vm.toString(nonce)),
                yieldTokenSymbol: "yCMP",
                minProductClaim: 5e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: 0.144e18,
                    minCap: 1_000e18,
                    maxCap: 5_000e18,
                    fundingDeadline: block.timestamp + 90 days,
                    seasonDuration: 365 days,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 5_000e18,
                    expectedAnnualHarvest: 1_000e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: 0
                })
            })
        );

        (address c,,,,,,) = factory.campaigns(nonce);
        campaignAddr = c;
        campaign = IGrowfiCampaignFull(payable(c));
    }
}
