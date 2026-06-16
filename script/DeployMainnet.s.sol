// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiCampaignToken} from "../src/GrowfiCampaignToken.sol";
import {GrowfiStakingVault} from "../src/GrowfiStakingVault.sol";
import {GrowfiYieldToken} from "../src/GrowfiYieldToken.sol";
import {GrowfiHarvestManager} from "../src/GrowfiHarvestManager.sol";
import {GrowfiCampaignRegistry} from "../src/GrowfiCampaignRegistry.sol";
import {GrowfiProducerRegistry} from "../src/GrowfiProducerRegistry.sol";
import {GrowfiToken} from "../src/GrowfiToken.sol";
import {GrowfiTreasury} from "../src/GrowfiTreasury.sol";
import {GrowfiMinter} from "../src/GrowfiMinter.sol";
import {GrowfiFeeSplitter} from "../src/GrowfiFeeSplitter.sol";
import {GrowfiStakingPool} from "../src/GrowfiStakingPool.sol";

import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {RepaymentModule} from "../src/modules/RepaymentModule.sol";
import {EcommerceModule} from "../src/modules/EcommerceModule.sol";
import {DebtRestructuringModule} from "../src/modules/DebtRestructuringModule.sol";

import {SaleClassicHelper} from "../test/modules/SaleClassicHelper.sol";
import {CollateralHelper} from "../test/modules/CollateralHelper.sol";
import {RepaymentHelper} from "../test/modules/RepaymentHelper.sol";
import {EcommerceHelper} from "../test/modules/EcommerceHelper.sol";
import {DebtRestructuringHelper} from "../test/modules/DebtRestructuringHelper.sol";

/// @title DeployMainnet
/// @notice Ethereum mainnet protocol deploy only. This script does not create
///         campaigns and intentionally never calls `createCampaign`.
contract DeployMainnet is Script {
    address internal constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant MAINNET_USDC_USD_FEED = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address internal constant MAINNET_FEE_RECEIVER_SAFE = 0x1f91747D9BF455842CD7f1555f52Ae581F6AA9b9;

    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant TYPE_COLLATERAL = keccak256("growfi.type.collateral");
    bytes32 internal constant KIND_REPAYMENT = keccak256("growfi.repayment.v1");
    bytes32 internal constant KIND_ECOMMERCE = keccak256("growfi.ecommerce.v1");
    bytes32 internal constant KIND_DEBT_RESTRUCTURING = keccak256("growfi.debt.restructuring.v1");

    uint256 internal constant GENESIS_DEPLOYER = 0;
    uint256 internal constant GENESIS_TREASURY = 100_000e18;
    uint256 internal constant BOOT_PRICE = 1e17;
    uint256 internal constant MARKUP_BPS = 1_000;
    uint256 internal constant TREASURY_BPS = 3_000;

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        uint256 deployerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address owner = vm.envOr("MAINNET_OWNER_ADDRESS", deployer);
        address ops = vm.envOr("MAINNET_OPS_ADDRESS", MAINNET_FEE_RECEIVER_SAFE);
        address feeRecipient = vm.envOr("MAINNET_FEE_RECIPIENT", MAINNET_FEE_RECEIVER_SAFE);

        vm.startBroadcast(deployerPk);

        address[5] memory impls;
        impls[0] = address(new GrowfiCampaign());
        impls[1] = address(new GrowfiCampaignToken());
        impls[2] = address(new GrowfiStakingVault());
        impls[3] = address(new GrowfiYieldToken());
        impls[4] = address(new GrowfiHarvestManager());

        GrowfiCampaignFactory factoryImpl = new GrowfiCampaignFactory();
        bytes memory factoryInit =
            abi.encodeCall(GrowfiCampaignFactory.initialize, (deployer, feeRecipient, MAINNET_USDC, address(0), impls));
        GrowfiCampaignFactory factory = GrowfiCampaignFactory(
            address(new TransparentUpgradeableProxy(address(factoryImpl), deployer, factoryInit))
        );

        address saleImpl = address(new SaleClassicModule());
        address collateralImpl = address(new CollateralModule());
        address repaymentImpl = address(new RepaymentModule());
        address ecommerceImpl = address(new EcommerceModule());
        address debtRestructuringImpl = address(new DebtRestructuringModule());

        bytes32 saleKind = factory.KIND_SALE_CLASSIC_V1();
        bytes32 collateralKind = factory.KIND_COLLATERAL_V1();

        factory.setModuleKindSelectors(saleKind, SaleClassicHelper.selectors());
        factory.approveModuleImpl(saleKind, saleImpl, true);

        factory.setModuleKindSelectors(collateralKind, CollateralHelper.selectors());
        factory.approveModuleImpl(collateralKind, collateralImpl, true);

        factory.setModuleKindSelectors(KIND_REPAYMENT, RepaymentHelper.selectors());
        factory.approveModuleImpl(KIND_REPAYMENT, repaymentImpl, true);

        factory.setModuleKindSelectors(KIND_ECOMMERCE, EcommerceHelper.selectors());
        factory.approveModuleImpl(KIND_ECOMMERCE, ecommerceImpl, true);

        factory.setModuleKindSelectors(KIND_DEBT_RESTRUCTURING, DebtRestructuringHelper.selectors());
        factory.approveModuleImpl(KIND_DEBT_RESTRUCTURING, debtRestructuringImpl, true);

        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](2);
        defaults[0] =
            ModuleRegistry.DefaultModule({moduleType: TYPE_SALE, kind: saleKind, impl: saleImpl, metadataURI: ""});
        defaults[1] = ModuleRegistry.DefaultModule({
            moduleType: TYPE_COLLATERAL, kind: collateralKind, impl: collateralImpl, metadataURI: ""
        });
        factory.setDefaultModules(defaults);

        GrowfiCampaignRegistry campaignRegistry = new GrowfiCampaignRegistry(factory);
        GrowfiProducerRegistry producerRegistry = new GrowfiProducerRegistry(deployer);

        GrowfiToken tImpl = new GrowfiToken();
        bytes memory tInit = abi.encodeCall(
            GrowfiToken.initialize,
            ("GrowFi", "GROW", address(factory), deployer, GENESIS_DEPLOYER, MARKUP_BPS, BOOT_PRICE)
        );
        GrowfiToken growToken = GrowfiToken(address(new TransparentUpgradeableProxy(address(tImpl), deployer, tInit)));

        GrowfiTreasury trImpl = new GrowfiTreasury();
        bytes memory trInit = abi.encodeCall(GrowfiTreasury.initialize, (address(factory), address(growToken)));
        GrowfiTreasury growTreasury =
            GrowfiTreasury(address(new TransparentUpgradeableProxy(address(trImpl), deployer, trInit)));

        GrowfiMinter mImpl = new GrowfiMinter();
        GrowfiMinter.BondingCurveParams memory curve = GrowfiMinter.BondingCurveParams({
            tier1RateBps: 10_000, tier2RateBps: 7_000, tier3RateBps: 4_000, tier2to3ThresholdBps: 5_000
        });
        bytes memory mInit = abi.encodeCall(GrowfiMinter.initialize, (address(factory), address(growToken), curve));
        GrowfiMinter growMinter =
            GrowfiMinter(address(new TransparentUpgradeableProxy(address(mImpl), deployer, mInit)));

        GrowfiFeeSplitter fsImpl = new GrowfiFeeSplitter();
        bytes memory fsInit =
            abi.encodeCall(GrowfiFeeSplitter.initialize, (address(factory), address(growTreasury), ops, TREASURY_BPS));
        GrowfiFeeSplitter feeSplitter =
            GrowfiFeeSplitter(address(new TransparentUpgradeableProxy(address(fsImpl), deployer, fsInit)));

        GrowfiStakingPool spImpl = new GrowfiStakingPool();
        bytes memory spInit = abi.encodeCall(
            GrowfiStakingPool.initialize, (address(factory), address(growToken), MAINNET_USDC, address(growTreasury))
        );
        GrowfiStakingPool stakingPool =
            GrowfiStakingPool(address(new TransparentUpgradeableProxy(address(spImpl), deployer, spInit)));

        factory.setGrowfiContracts(address(growToken), address(growMinter), address(growTreasury), address(feeSplitter));
        factory.setProtocolFeeRecipient(address(feeSplitter));
        factory.setGrowfiTokenMinter(address(growMinter));
        factory.setGrowfiTokenTreasury(address(growTreasury));
        factory.addGrowfiTreasuryStablecoin(MAINNET_USDC, 1e12, MAINNET_USDC_USD_FEED, 1 days, 9_500, 10_500);
        factory.setGrowfiTreasuryStakingPool(address(stakingPool));
        factory.setGrowfiTreasuryAutomationEnabled(true);
        factory.setGrowfiMinterExcluded(address(growTreasury), true);
        factory.mintGrowfiTokenTreasuryGenesis(GENESIS_TREASURY);

        if (owner != deployer) {
            factory.transferOwnership(owner);
            producerRegistry.transferOwnership(owner);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== GrowFi Ethereum mainnet deploy ===");
        console.log("Chain id:                    ", block.chainid);
        console.log("Deploy block:                ", block.number);
        console.log("Deployer:                    ", deployer);
        console.log("Owner:                       ", owner);
        console.log("Operations:                  ", ops);
        console.log("Fee receiver safe:           ", MAINNET_FEE_RECEIVER_SAFE);
        console.log("USDC:                        ", MAINNET_USDC);
        console.log("USDC/USD feed:               ", MAINNET_USDC_USD_FEED);
        console.log("");
        console.log("Factory proxy:               ", address(factory));
        console.log("Factory impl:                ", address(factoryImpl));
        console.log("Campaign impl:               ", impls[0]);
        console.log("CampaignToken impl:          ", impls[1]);
        console.log("StakingVault impl:           ", impls[2]);
        console.log("YieldToken impl:             ", impls[3]);
        console.log("HarvestManager impl:         ", impls[4]);
        console.log("SaleClassic module impl:     ", saleImpl);
        console.log("Collateral module impl:      ", collateralImpl);
        console.log("Repayment module impl:       ", repaymentImpl);
        console.log("Ecommerce module impl:       ", ecommerceImpl);
        console.log("Debt restructuring impl:     ", debtRestructuringImpl);
        console.log("CampaignRegistry:            ", address(campaignRegistry));
        console.log("ProducerRegistry:            ", address(producerRegistry));
        console.log("");
        console.log("GrowfiToken:                 ", address(growToken));
        console.log("GrowfiTreasury:              ", address(growTreasury));
        console.log("GrowfiMinter:                ", address(growMinter));
        console.log("GrowfiFeeSplitter:           ", address(feeSplitter));
        console.log("GrowfiStakingPool:           ", address(stakingPool));
        console.log("");
        console.log("Campaign count:              ", factory.getCampaignCount());
    }
}
