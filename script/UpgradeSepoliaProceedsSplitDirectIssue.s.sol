// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {ModuleRegistry} from "../src/host/ModuleRegistry.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {CampaignProceedsSplitModule} from "../src/modules/CampaignProceedsSplitModule.sol";
import {DirectIssueModule} from "../src/modules/DirectIssueModule.sol";

import {SaleClassicHelper} from "../test/modules/SaleClassicHelper.sol";
import {ProceedsSplitHelper} from "../test/modules/ProceedsSplitHelper.sol";
import {DirectIssueHelper} from "../test/modules/DirectIssueHelper.sol";

interface IMintableTestUsdc {
    function mint(address to, uint256 amount) external;
}

/// @title UpgradeSepoliaProceedsSplitDirectIssue
/// @notice Testnet-only rollout for proceeds split + direct issue modules.
///         It updates the SaleClassic implementation used by existing
///         campaigns, registers the optional modules, and can run an on-chain
///         smoke campaign that exercises split routing and direct issue.
contract UpgradeSepoliaProceedsSplitDirectIssue is Script {
    address internal constant DEFAULT_SEPOLIA_FACTORY = 0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05;
    address internal constant DEFAULT_PROMOTER = 0x000000000000000000000000000000000000bEEF;

    bytes32 internal constant TYPE_SALE = keccak256("growfi.type.sale");
    bytes32 internal constant TYPE_PROCEEDS_SPLIT = keccak256("growfi.type.proceeds.split");
    bytes32 internal constant TYPE_DIRECT_ISSUE = keccak256("growfi.type.direct.issue");
    bytes32 internal constant KIND_SALE_CLASSIC = keccak256("growfi.sale.classic.v1");
    bytes32 internal constant KIND_PROCEEDS_SPLIT = keccak256("growfi.proceeds.split.v1");
    bytes32 internal constant KIND_DIRECT_ISSUE = keccak256("growfi.direct.issue.v1");

    uint256 internal constant SMOKE_PRICE_PER_TOKEN = 0.144e18;
    uint256 internal constant SMOKE_FIXED_RATE_USDC = 144_000;
    uint256 internal constant SMOKE_MIN_CAP = 1e18;
    uint256 internal constant SMOKE_MAX_CAP = 100e18;
    uint16 internal constant SMOKE_PROMOTER_BPS = 2_500;

    function run() public {
        require(block.chainid == 11_155_111, "Ethereum Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address factoryProxy = vm.envOr("FACTORY_ADDRESS", DEFAULT_SEPOLIA_FACTORY);
        address promoter = vm.envOr("TEST_PROMOTER", DEFAULT_PROMOTER);
        bool runSmoke = vm.envOr("RUN_SMOKE", uint256(1)) == 1;

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        require(factory.owner() == deployer, "deployer is not factory owner");

        vm.startBroadcast(deployerPk);

        SaleClassicModule saleImpl = new SaleClassicModule();
        CampaignProceedsSplitModule proceedsSplitImpl = new CampaignProceedsSplitModule();
        DirectIssueModule directIssueImpl = new DirectIssueModule();

        factory.setModuleKindSelectors(KIND_SALE_CLASSIC, SaleClassicHelper.selectors());
        factory.approveModuleImpl(KIND_SALE_CLASSIC, address(saleImpl), true);

        factory.setModuleKindSelectors(KIND_PROCEEDS_SPLIT, ProceedsSplitHelper.selectors());
        factory.approveModuleImpl(KIND_PROCEEDS_SPLIT, address(proceedsSplitImpl), true);

        factory.setModuleKindSelectors(KIND_DIRECT_ISSUE, DirectIssueHelper.selectors());
        factory.approveModuleImpl(KIND_DIRECT_ISSUE, address(directIssueImpl), true);

        _updateDefaultSaleModule(factory, address(saleImpl));
        uint256 replacedCampaigns = _replaceExistingSaleModules(factory, address(saleImpl));

        address smokeCampaign;
        if (runSmoke) {
            smokeCampaign = _runSmoke(factory, address(proceedsSplitImpl), address(directIssueImpl), promoter);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== GrowFi Sepolia proceeds split + direct issue rollout ===");
        console.log("Factory proxy:             ", factoryProxy);
        console.log("SaleClassic module impl:   ", address(saleImpl));
        console.log("Proceeds split impl:       ", address(proceedsSplitImpl));
        console.log("Direct issue impl:         ", address(directIssueImpl));
        console.log("Existing campaigns updated:", replacedCampaigns);
        console.log("Smoke campaign:            ", smokeCampaign);
    }

    function _updateDefaultSaleModule(GrowfiCampaignFactory factory, address saleImpl) internal {
        uint256 n = factory.defaultModulesLength();
        ModuleRegistry.DefaultModule[] memory defaults = new ModuleRegistry.DefaultModule[](n);

        for (uint256 i; i < n;) {
            defaults[i] = factory.defaultModuleAt(i);
            if (defaults[i].moduleType == TYPE_SALE) {
                defaults[i] = ModuleRegistry.DefaultModule({
                    moduleType: TYPE_SALE, kind: KIND_SALE_CLASSIC, impl: saleImpl, metadataURI: defaults[i].metadataURI
                });
            }
            unchecked {
                ++i;
            }
        }

        factory.setDefaultModules(defaults);
    }

    function _replaceExistingSaleModules(GrowfiCampaignFactory factory, address saleImpl)
        internal
        returns (uint256 replaced)
    {
        uint256 campaignCount = factory.getCampaignCount();
        for (uint256 i; i < campaignCount;) {
            (address campaign,,,,,,) = factory.campaigns(i);
            (address currentImpl,, string memory metadataURI,,) =
                GrowfiCampaign(payable(campaign)).moduleSlot(TYPE_SALE);
            require(currentImpl != address(0), "sale module missing");
            factory.replaceCampaignModule(campaign, TYPE_SALE, KIND_SALE_CLASSIC, saleImpl, metadataURI);

            unchecked {
                ++replaced;
                ++i;
            }
        }
    }

    function _runSmoke(
        GrowfiCampaignFactory factory,
        address proceedsSplitImpl,
        address directIssueImpl,
        address promoter
    ) internal returns (address campaign) {
        address producer = vm.addr(vm.envUint("PRIVATE_KEY"));
        address usdc = factory.usdc();
        string memory nonce = string.concat(vm.toString(block.number), "-", vm.toString(block.timestamp));

        campaign = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: producer,
                campaignTokenName: string.concat("Sepolia Split Direct Smoke ", nonce),
                campaignTokenSymbol: "SDT",
                yieldTokenName: string.concat("Sepolia Split Direct Yield ", nonce),
                yieldTokenSymbol: "ySDT",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: SMOKE_PRICE_PER_TOKEN,
                    minCap: SMOKE_MIN_CAP,
                    maxCap: SMOKE_MAX_CAP,
                    fundingDeadline: block.timestamp + 30 days,
                    seasonDuration: 365 days,
                    fundingFeeBps: 0,
                    sequencerUptimeFeed: address(0),
                    growMinter: address(0)
                }),
                collateral: CollateralModule.InitParams({
                    expectedAnnualHarvestUsd: 1e18,
                    expectedAnnualHarvest: 1e18,
                    firstHarvestYear: 2030,
                    coverageHarvests: 0
                })
            })
        );

        GrowfiCampaign(payable(campaign))
            .attachModule(TYPE_PROCEEDS_SPLIT, KIND_PROCEEDS_SPLIT, proceedsSplitImpl, "growfi://proceeds-split/v1");
        GrowfiCampaign(payable(campaign))
            .attachModule(TYPE_DIRECT_ISSUE, KIND_DIRECT_ISSUE, directIssueImpl, "growfi://direct-issue/v1");

        SaleClassicModule(payable(campaign))
            .addAcceptedToken(usdc, SaleClassicModule.PricingMode.Fixed, SMOKE_FIXED_RATE_USDC, address(0));
        CampaignProceedsSplitModule(payable(campaign)).setProceedsSplit(promoter, SMOKE_PROMOTER_BPS);

        DirectIssueModule(payable(campaign)).issueCampaignTokens(producer, SMOKE_MIN_CAP);
        SaleClassicModule(payable(campaign)).activateCampaign();

        address feeRecipient = factory.protocolFeeRecipient();
        uint256 promoterBefore = IERC20(usdc).balanceOf(promoter);
        uint256 feeBefore = IERC20(usdc).balanceOf(feeRecipient);

        IMintableTestUsdc(usdc).mint(producer, SMOKE_FIXED_RATE_USDC);
        IERC20(usdc).approve(campaign, SMOKE_FIXED_RATE_USDC);
        SaleClassicModule(payable(campaign)).buy(usdc, SMOKE_FIXED_RATE_USDC);

        uint256 protocolFee = SMOKE_FIXED_RATE_USDC * factory.FUNDING_FEE_BPS() / 10_000;
        uint256 promoterAmount = (SMOKE_FIXED_RATE_USDC - protocolFee) * SMOKE_PROMOTER_BPS / 10_000;
        require(IERC20(usdc).balanceOf(promoter) - promoterBefore == promoterAmount, "bad promoter split");
        require(IERC20(usdc).balanceOf(feeRecipient) - feeBefore == protocolFee, "bad protocol fee");
    }
}
