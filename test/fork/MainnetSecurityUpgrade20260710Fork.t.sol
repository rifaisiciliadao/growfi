// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {ModuleRegistry} from "../../src/host/ModuleRegistry.sol";
import {GrowfiCampaignFactory} from "../../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../../src/GrowfiCampaign.sol";
import {GrowfiHarvestManager} from "../../src/GrowfiHarvestManager.sol";
import {GrowfiStakingVault} from "../../src/GrowfiStakingVault.sol";
import {GrowfiTreasury} from "../../src/GrowfiTreasury.sol";
import {SaleClassicModule} from "../../src/modules/SaleClassicModule.sol";
import {SaleClassicHelper} from "../modules/SaleClassicHelper.sol";

contract MainnetSecurityUpgrade20260710ForkTest is Test {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    uint256 internal constant CAMPAIGN_COUNT = 2;
    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    bool internal runFork;
    GrowfiCampaignFactory internal factory;

    struct CampaignSnapshot {
        address campaign;
        address vault;
        address harvestManager;
        address saleImpl;
        string saleMetadata;
        uint256 totalStaked;
        uint256 currentSeasonId;
        uint256 rewardPerTokenStored;
        uint256 seasonYieldOwed;
        uint256 currentSupply;
        uint256 pricePerToken;
    }

    function setUp() public {
        runFork = vm.envOr("RUN_MAINNET_FORK_TESTS", false);
        if (!runFork) return;
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string("https://ethereum-rpc.publicnode.com"));
        uint256 forkBlock = vm.envOr("MAINNET_FORK_BLOCK", uint256(0));
        if (forkBlock == 0) {
            vm.createSelectFork(rpc);
        } else {
            vm.createSelectFork(rpc, forkBlock);
        }
        factory = GrowfiCampaignFactory(FACTORY);
    }

    modifier forkOnly() {
        if (!runFork) return;
        _;
    }

    function test_mainnetFork_securityRolloutPreservesLiveState() public forkOnly {
        _runAndAssertRollout();
    }

    function test_mainnetFork_securityRolloutCanResumeAfterCompletion() public forkOnly {
        _runAndAssertRollout();
        _runAndAssertRollout();
    }

    function _runAndAssertRollout() internal {
        assertEq(factory.getCampaignCount(), CAMPAIGN_COUNT);
        address owner = factory.owner();
        assertEq(factory.proxyAdminOwner(), owner);

        address treasuryProxy = factory.growfiTreasury();
        address growTokenBefore = factory.growfiToken();
        address minterBefore = factory.growfiMinter();
        address feeSplitterBefore = factory.growfiFeeSplitter();
        address usdcBefore = factory.usdc();
        uint256 floorBefore = GrowfiTreasury(treasuryProxy).intrinsicFloorPrice();

        CampaignSnapshot[] memory snapshots = new CampaignSnapshot[](CAMPAIGN_COUNT);
        for (uint256 i; i < CAMPAIGN_COUNT; ++i) {
            (address campaign,,, address vault, address harvestManager,,) = factory.campaigns(i);
            GrowfiStakingVault stakingVault = GrowfiStakingVault(vault);
            uint256 seasonId = stakingVault.currentSeasonId();
            (,,,, uint256 seasonYieldOwed,,) = stakingVault.seasons(seasonId);
            (address oldSaleImpl,, string memory metadataURI,,) =
                GrowfiCampaign(payable(campaign)).moduleSlot(TYPE_SALE);
            snapshots[i] = CampaignSnapshot({
                campaign: campaign,
                vault: vault,
                harvestManager: harvestManager,
                saleImpl: oldSaleImpl,
                saleMetadata: metadataURI,
                totalStaked: stakingVault.totalStaked(),
                currentSeasonId: seasonId,
                rewardPerTokenStored: stakingVault.rewardPerTokenStored(),
                seasonYieldOwed: seasonYieldOwed,
                currentSupply: SaleClassicModule(payable(campaign)).currentSupply(),
                pricePerToken: SaleClassicModule(payable(campaign)).pricePerToken()
            });
            assertEq(seasonId, 1);
            assertEq(ProxyAdmin(_proxyAdmin(vault)).owner(), owner);
        }

        GrowfiCampaignFactory factoryImpl = new GrowfiCampaignFactory();
        GrowfiTreasury treasuryImpl = new GrowfiTreasury();
        GrowfiStakingVault vaultImpl = new GrowfiStakingVault();
        SaleClassicModule saleImpl = new SaleClassicModule();

        vm.prank(owner);
        _upgradeProxy(FACTORY, address(factoryImpl));

        vm.startPrank(owner);
        for (uint256 i; i < CAMPAIGN_COUNT; ++i) {
            factory.pauseCampaign(i);
        }
        vm.stopPrank();

        for (uint256 i; i < CAMPAIGN_COUNT; ++i) {
            CampaignSnapshot memory snap = snapshots[i];
            assertTrue(GrowfiCampaign(payable(snap.campaign)).paused());
            assertTrue(GrowfiStakingVault(snap.vault).paused());
            assertTrue(GrowfiHarvestManager(snap.harvestManager).paused());
        }

        vm.prank(owner);
        _upgradeProxy(treasuryProxy, address(treasuryImpl));

        bytes32 saleKind = factory.KIND_SALE_CLASSIC_V1();
        vm.startPrank(owner);
        factory.setStakingVaultImpl(address(vaultImpl));
        factory.setModuleKindSelectors(saleKind, SaleClassicHelper.selectors());
        factory.approveModuleImpl(saleKind, address(saleImpl), true);
        _updateDefaultSale(factory, saleKind, address(saleImpl));
        vm.stopPrank();

        for (uint256 i; i < CAMPAIGN_COUNT; ++i) {
            CampaignSnapshot memory snap = snapshots[i];
            vm.prank(owner);
            _upgradeProxy(snap.vault, address(vaultImpl));
            if (!GrowfiStakingVault(snap.vault).seasonStakeAccountingInitialized()) {
                vm.prank(owner);
                factory.initializeCampaignSeasonStakeAccounting(i, snap.totalStaked);
            }
            vm.prank(owner);
            factory.replaceCampaignModule(snap.campaign, TYPE_SALE, saleKind, address(saleImpl), snap.saleMetadata);
        }

        vm.startPrank(owner);
        for (uint256 i; i < CAMPAIGN_COUNT; ++i) {
            address oldSale = snapshots[i].saleImpl;
            if (oldSale != address(0) && oldSale != address(saleImpl)) {
                factory.approveModuleImpl(saleKind, oldSale, false);
            }
        }
        for (uint256 i; i < CAMPAIGN_COUNT; ++i) {
            factory.unpauseCampaign(i);
        }
        vm.stopPrank();

        assertEq(factory.owner(), owner);
        assertEq(factory.getCampaignCount(), CAMPAIGN_COUNT);
        assertEq(factory.growfiTreasury(), treasuryProxy);
        assertEq(factory.growfiToken(), growTokenBefore);
        assertEq(factory.growfiMinter(), minterBefore);
        assertEq(factory.growfiFeeSplitter(), feeSplitterBefore);
        assertEq(factory.usdc(), usdcBefore);
        assertEq(factory.stakingVaultImpl(), address(vaultImpl));
        assertEq(GrowfiTreasury(treasuryProxy).intrinsicFloorPrice(), floorBefore);

        for (uint256 i; i < CAMPAIGN_COUNT; ++i) {
            CampaignSnapshot memory snap = snapshots[i];
            GrowfiCampaign campaign = GrowfiCampaign(payable(snap.campaign));
            GrowfiStakingVault stakingVault = GrowfiStakingVault(snap.vault);
            (,,,, uint256 seasonYieldOwed,,) = stakingVault.seasons(snap.currentSeasonId);
            (address currentSale,,,, bool enabled) = campaign.moduleSlot(TYPE_SALE);

            assertFalse(campaign.paused());
            assertFalse(stakingVault.paused());
            assertFalse(GrowfiHarvestManager(snap.harvestManager).paused());
            assertTrue(stakingVault.seasonStakeAccountingInitialized());
            assertEq(stakingVault.currentSeasonStaked(), snap.totalStaked);
            assertEq(stakingVault.totalStaked(), snap.totalStaked);
            assertEq(stakingVault.currentSeasonId(), snap.currentSeasonId);
            assertEq(stakingVault.rewardPerTokenStored(), snap.rewardPerTokenStored);
            assertEq(seasonYieldOwed, snap.seasonYieldOwed);
            assertEq(currentSale, address(saleImpl));
            assertTrue(enabled);
            assertEq(SaleClassicModule(payable(snap.campaign)).currentSupply(), snap.currentSupply);
            assertEq(SaleClassicModule(payable(snap.campaign)).pricePerToken(), snap.pricePerToken);
        }
    }

    function _updateDefaultSale(GrowfiCampaignFactory target, bytes32 saleKind, address saleImpl) internal {
        uint256 n = target.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);
        for (uint256 i; i < n; ++i) {
            defaults[i] = target.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: saleKind, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
            }
        }
        target.setDefaultModules(defaults);
    }

    function _upgradeProxy(address proxy, address implementation) internal {
        ProxyAdmin(_proxyAdmin(proxy)).upgradeAndCall(ITransparentUpgradeableProxy(proxy), implementation, bytes(""));
    }

    function _proxyAdmin(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967_ADMIN_SLOT))));
    }
}
