// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {EcommerceModule} from "../src/modules/EcommerceModule.sol";

import {EcommerceHelper} from "../test/modules/EcommerceHelper.sol";

/// @title UpgradeMainnetEcommerceFee
/// @notice Upgrades the factory so the ecommerce protocol fee is protocol-owned,
///         deploys the fixed-fee EcommerceModule, and prepares future campaign attaches.
contract UpgradeMainnetEcommerceFee is Script {
    address internal constant FACTORY = 0x81c2ecb09B8062cC9F3A4F8682318456304f4aE2;
    address internal constant CURRENT_ECOMMERCE_IMPL = 0x881883a9fd1c296D198EE9937603E8Eec1AE5E70;

    bytes32 internal constant KIND_ECOMMERCE = keccak256("growfi.ecommerce.v1");
    bytes32 internal constant ERC1967_ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        uint256 deployerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address factoryProxy = vm.envOr("MAINNET_FACTORY_ADDRESS", FACTORY);
        address oldEcommerceImpl = vm.envOr("MAINNET_OLD_ECOMMERCE_IMPL", CURRENT_ECOMMERCE_IMPL);
        uint256 ecommerceFeeBpsRaw = vm.envOr("MAINNET_ECOMMERCE_PROTOCOL_FEE_BPS", uint256(300));
        require(ecommerceFeeBpsRaw <= type(uint16).max, "fee bps overflow");
        uint16 ecommerceFeeBps = uint16(ecommerceFeeBpsRaw);

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        address owner = factory.owner();
        require(deployer == owner, "deployer is not factory owner");
        require(ProxyAdmin(_proxyAdmin(factoryProxy)).owner() == deployer, "deployer is not proxy admin owner");

        vm.startBroadcast(deployerPk);

        GrowfiCampaignFactory factoryImpl = new GrowfiCampaignFactory();
        EcommerceModule ecommerceImpl = new EcommerceModule();

        ProxyAdmin(_proxyAdmin(factoryProxy))
            .upgradeAndCall(ITransparentUpgradeableProxy(factoryProxy), address(factoryImpl), bytes(""));

        factory.setEcommerceProtocolFeeBps(ecommerceFeeBps);
        factory.setModuleKindSelectors(KIND_ECOMMERCE, EcommerceHelper.selectors());
        factory.approveModuleImpl(KIND_ECOMMERCE, address(ecommerceImpl), true);
        factory.approveModuleImpl(KIND_ECOMMERCE, oldEcommerceImpl, false);

        uint256 campaignCount = factory.getCampaignCount();

        vm.stopBroadcast();

        console.log("");
        console.log("=== GrowFi mainnet ecommerce fee upgrade ===");
        console.log("Factory proxy:                 ", factoryProxy);
        console.log("Factory impl:                  ", address(factoryImpl));
        console.log("Ecommerce module impl:         ", address(ecommerceImpl));
        console.log("Old ecommerce module impl:     ", oldEcommerceImpl);
        console.log("Ecommerce protocol fee bps:    ", ecommerceFeeBps);
        console.log("Campaign count:                ", campaignCount);
    }

    function _proxyAdmin(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967_ADMIN_SLOT))));
    }
}
