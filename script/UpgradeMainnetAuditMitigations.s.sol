// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiToken} from "../src/GrowfiToken.sol";
import {GrowfiTreasury} from "../src/GrowfiTreasury.sol";
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

/// @title UpgradeMainnetAuditMitigations
/// @notice Patches the 2026-06-16 mainnet launch before any campaign exists.
///         It deploys the audit-mitigated host/modules and upgrades the GROW
///         Token/Treasury proxies. It intentionally never creates campaigns.
contract UpgradeMainnetAuditMitigations is Script {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    address internal constant OLD_SALE_IMPL = 0xC1Dd8228A100Ff90450C1D2984c797F76FbFD281;
    address internal constant OLD_COLLATERAL_IMPL = 0x6Cbd67988f0E7b976A51E5de6D498339477D6bEf;
    address internal constant OLD_REPAYMENT_IMPL = 0x2224A91Fd2603bCd33c920b02eDCf6dF7D2696FD;
    address internal constant OLD_ECOMMERCE_IMPL = 0x412337b6940B908093A0223b25798Cd00B2eC072;
    address internal constant OLD_DEBT_RESTRUCTURING_IMPL = 0x91811Da0B10e6927882dadC458f0fBB7Cf55f3b5;

    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant TYPE_COLLATERAL = keccak256("growfi.type.collateral");
    bytes32 internal constant KIND_REPAYMENT = keccak256("growfi.repayment.v1");
    bytes32 internal constant KIND_ECOMMERCE = keccak256("growfi.ecommerce.v1");
    bytes32 internal constant KIND_DEBT_RESTRUCTURING = keccak256("growfi.debt.restructuring.v1");
    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        uint256 deployerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
        address factoryProxy = vm.envOr("MAINNET_FACTORY_ADDRESS", FACTORY);

        vm.startBroadcast(deployerPk);

        GrowfiCampaign campaignImpl = new GrowfiCampaign();
        GrowfiToken tokenImpl = new GrowfiToken();
        GrowfiTreasury treasuryImpl = new GrowfiTreasury();
        SaleClassicModule saleImpl = new SaleClassicModule();
        CollateralModule collateralImpl = new CollateralModule();
        RepaymentModule repaymentImpl = new RepaymentModule();
        EcommerceModule ecommerceImpl = new EcommerceModule();
        DebtRestructuringModule debtRestructuringImpl = new DebtRestructuringModule();

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        require(factory.getCampaignCount() == 0, "campaigns already exist");

        address tokenProxy = factory.growfiToken();
        address treasuryProxy = factory.growfiTreasury();
        _upgradeProxy(tokenProxy, address(tokenImpl));
        _upgradeProxy(treasuryProxy, address(treasuryImpl));

        factory.setCampaignImpl(address(campaignImpl));

        bytes32 saleKind = factory.KIND_SALE_CLASSIC_V1();
        factory.setModuleKindSelectors(saleKind, SaleClassicHelper.selectors());
        factory.approveModuleImpl(saleKind, address(saleImpl), true);
        factory.approveModuleImpl(saleKind, OLD_SALE_IMPL, false);

        bytes32 collateralKind = factory.KIND_COLLATERAL_V1();
        factory.setModuleKindSelectors(collateralKind, CollateralHelper.selectors());
        factory.approveModuleImpl(collateralKind, address(collateralImpl), true);
        factory.approveModuleImpl(collateralKind, OLD_COLLATERAL_IMPL, false);

        factory.setModuleKindSelectors(KIND_REPAYMENT, RepaymentHelper.selectors());
        factory.approveModuleImpl(KIND_REPAYMENT, address(repaymentImpl), true);
        factory.approveModuleImpl(KIND_REPAYMENT, OLD_REPAYMENT_IMPL, false);

        factory.setModuleKindSelectors(KIND_ECOMMERCE, EcommerceHelper.selectors());
        factory.approveModuleImpl(KIND_ECOMMERCE, address(ecommerceImpl), true);
        factory.approveModuleImpl(KIND_ECOMMERCE, OLD_ECOMMERCE_IMPL, false);

        factory.setModuleKindSelectors(KIND_DEBT_RESTRUCTURING, DebtRestructuringHelper.selectors());
        factory.approveModuleImpl(KIND_DEBT_RESTRUCTURING, address(debtRestructuringImpl), true);
        factory.approveModuleImpl(KIND_DEBT_RESTRUCTURING, OLD_DEBT_RESTRUCTURING_IMPL, false);

        _updateDefaultModules(factory, saleKind, address(saleImpl), collateralKind, address(collateralImpl));

        vm.stopBroadcast();

        console.log("");
        console.log("=== GrowFi mainnet audit mitigation patch ===");
        console.log("Factory proxy:                  ", factoryProxy);
        console.log("Campaign impl:                  ", address(campaignImpl));
        console.log("GrowfiToken proxy:              ", tokenProxy);
        console.log("GrowfiToken impl:               ", address(tokenImpl));
        console.log("GrowfiTreasury proxy:           ", treasuryProxy);
        console.log("GrowfiTreasury impl:            ", address(treasuryImpl));
        console.log("SaleClassic module impl:        ", address(saleImpl));
        console.log("Collateral module impl:         ", address(collateralImpl));
        console.log("Repayment module impl:          ", address(repaymentImpl));
        console.log("Ecommerce module impl:          ", address(ecommerceImpl));
        console.log("Debt restructuring module impl: ", address(debtRestructuringImpl));
        console.log("Campaign count:                 ", factory.getCampaignCount());
    }

    function _updateDefaultModules(
        GrowfiCampaignFactory factory,
        bytes32 saleKind,
        address saleImpl,
        bytes32 collateralKind,
        address collateralImpl
    ) internal {
        uint256 n = factory.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);

        for (uint256 i; i < n;) {
            defaults[i] = factory.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: saleKind, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
            }
            if (defaults[i].moduleType == TYPE_COLLATERAL) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_COLLATERAL,
                    kind: collateralKind,
                    impl: collateralImpl,
                    metadataURI: defaults[i].metadataURI
                });
            }
            unchecked {
                ++i;
            }
        }

        factory.setDefaultModules(defaults);
    }

    function _upgradeProxy(address proxy, address implementation) internal {
        address admin = _proxyAdmin(proxy);
        ProxyAdmin(admin).upgradeAndCall(ITransparentUpgradeableProxy(proxy), implementation, bytes(""));
    }

    function _proxyAdmin(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967_ADMIN_SLOT))));
    }
}
