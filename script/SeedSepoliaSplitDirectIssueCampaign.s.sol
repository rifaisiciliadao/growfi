// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {GrowfiCampaignFactory} from "../src/GrowfiCampaignFactory.sol";
import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {GrowfiCampaignToken} from "../src/GrowfiCampaignToken.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";
import {CollateralModule} from "../src/modules/CollateralModule.sol";
import {CampaignProceedsSplitModule} from "../src/modules/CampaignProceedsSplitModule.sol";
import {DirectIssueModule} from "../src/modules/DirectIssueModule.sol";

import {ProceedsSplitHelper} from "../test/modules/ProceedsSplitHelper.sol";
import {DirectIssueHelper} from "../test/modules/DirectIssueHelper.sol";

interface IMintableSeedUsdc {
    function mint(address to, uint256 amount) external;
}

/// @title SeedSepoliaSplitDirectIssueCampaign
/// @notice Creates a Sepolia seed campaign with 100% promoter proceeds split
///         and direct issue enabled. It deploys and approves fresh optional
///         module implementations, then verifies both direct issue and split
///         routing with an on-chain mint + buy.
contract SeedSepoliaSplitDirectIssueCampaign is Script {
    address internal constant DEFAULT_SEPOLIA_FACTORY = 0xa4DEd8Ab35e89bCAF1f7DFeb7aB2c1ED533b3f05;
    address internal constant DEFAULT_PROMOTER = 0x000000000000000000000000000000000000bEEF;

    bytes32 internal constant TYPE_PROCEEDS_SPLIT = keccak256("growfi.type.proceeds.split");
    bytes32 internal constant TYPE_DIRECT_ISSUE = keccak256("growfi.type.direct.issue");
    bytes32 internal constant KIND_PROCEEDS_SPLIT = keccak256("growfi.proceeds.split.v1");
    bytes32 internal constant KIND_DIRECT_ISSUE = keccak256("growfi.direct.issue.v1");

    uint256 internal constant PRICE_PER_TOKEN = 0.144e18;
    uint256 internal constant FIXED_RATE_USDC = 144_000;
    uint256 internal constant MIN_CAP = 1e18;
    uint256 internal constant MAX_CAP = 100e18;
    uint16 internal constant PROMOTER_BPS = 10_000;

    function run() public {
        require(block.chainid == 11_155_111, "Ethereum Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address factoryProxy = vm.envOr("FACTORY_ADDRESS", DEFAULT_SEPOLIA_FACTORY);
        address promoter = vm.envOr("TEST_PROMOTER", DEFAULT_PROMOTER);
        uint256 directIssueAmount = vm.envOr("DIRECT_ISSUE_AMOUNT", MIN_CAP);
        uint256 buyPaymentAmount = vm.envOr("BUY_PAYMENT_AMOUNT", FIXED_RATE_USDC);

        GrowfiCampaignFactory factory = GrowfiCampaignFactory(factoryProxy);
        require(factory.owner() == deployer, "deployer is not factory owner");
        require(directIssueAmount > 0, "direct issue amount required");
        require(directIssueAmount < MAX_CAP, "direct issue leaves no buy room");

        vm.startBroadcast(deployerPk);

        CampaignProceedsSplitModule proceedsSplitImpl = new CampaignProceedsSplitModule();
        DirectIssueModule directIssueImpl = new DirectIssueModule();

        factory.setModuleKindSelectors(KIND_PROCEEDS_SPLIT, ProceedsSplitHelper.selectors());
        factory.approveModuleImpl(KIND_PROCEEDS_SPLIT, address(proceedsSplitImpl), true);

        factory.setModuleKindSelectors(KIND_DIRECT_ISSUE, DirectIssueHelper.selectors());
        factory.approveModuleImpl(KIND_DIRECT_ISSUE, address(directIssueImpl), true);

        string memory nonce = string.concat(vm.toString(block.number), "-", vm.toString(block.timestamp));
        address campaign = factory.createCampaign(
            GrowfiCampaignFactory.CreateCampaignParams({
                producer: deployer,
                campaignTokenName: string.concat("Sepolia Split 100 Seed ", nonce),
                campaignTokenSymbol: "SPLIT100",
                yieldTokenName: string.concat("Sepolia Split 100 Yield ", nonce),
                yieldTokenSymbol: "ySPLIT",
                minProductClaim: 1e18,
                sale: SaleClassicModule.InitParams({
                    pricePerToken: PRICE_PER_TOKEN,
                    minCap: MIN_CAP,
                    maxCap: MAX_CAP,
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
            .attachModule(
                TYPE_PROCEEDS_SPLIT, KIND_PROCEEDS_SPLIT, address(proceedsSplitImpl), "growfi://proceeds-split/v1"
            );
        GrowfiCampaign(payable(campaign))
            .attachModule(TYPE_DIRECT_ISSUE, KIND_DIRECT_ISSUE, address(directIssueImpl), "growfi://direct-issue/v1");

        address usdc = factory.usdc();
        SaleClassicModule(payable(campaign))
            .addAcceptedToken(usdc, SaleClassicModule.PricingMode.Fixed, FIXED_RATE_USDC, address(0));
        CampaignProceedsSplitModule(payable(campaign)).setProceedsSplit(promoter, PROMOTER_BPS);

        (, address campaignToken,,,,,) = factory.campaigns(factory.campaignsLength() - 1);
        uint256 supplyBefore = SaleClassicModule(payable(campaign)).currentSupply();
        uint256 producerCtBefore = GrowfiCampaignToken(campaignToken).balanceOf(deployer);
        DirectIssueModule(payable(campaign)).issueCampaignTokens(deployer, directIssueAmount);
        require(
            SaleClassicModule(payable(campaign)).currentSupply() == supplyBefore + directIssueAmount,
            "direct issue supply mismatch"
        );
        require(
            GrowfiCampaignToken(campaignToken).balanceOf(deployer) == producerCtBefore + directIssueAmount,
            "direct issue balance mismatch"
        );

        if (SaleClassicModule(payable(campaign)).currentSupply() >= MIN_CAP) {
            SaleClassicModule(payable(campaign)).activateCampaign();
        }

        address feeRecipient = factory.protocolFeeRecipient();
        uint256 promoterBefore = IERC20(usdc).balanceOf(promoter);
        uint256 producerUsdcBefore = IERC20(usdc).balanceOf(deployer);
        uint256 feeBefore = IERC20(usdc).balanceOf(feeRecipient);

        IMintableSeedUsdc(usdc).mint(deployer, buyPaymentAmount);
        IERC20(usdc).approve(campaign, buyPaymentAmount);
        SaleClassicModule(payable(campaign)).buy(usdc, buyPaymentAmount);

        uint256 protocolFee = buyPaymentAmount * factory.FUNDING_FEE_BPS() / 10_000;
        uint256 promoterAmount = buyPaymentAmount - protocolFee;
        require(IERC20(usdc).balanceOf(promoter) - promoterBefore == promoterAmount, "bad promoter split");
        require(IERC20(usdc).balanceOf(feeRecipient) - feeBefore == protocolFee, "bad protocol fee");
        require(IERC20(usdc).balanceOf(deployer) == producerUsdcBefore, "producer received split proceeds");

        (bool active,, address configuredPromoter, uint16 promoterBps, uint16 producerBps) =
            CampaignProceedsSplitModule(payable(campaign)).proceedsSplit();
        require(active, "split inactive");
        require(configuredPromoter == promoter, "bad promoter");
        require(promoterBps == PROMOTER_BPS, "bad promoter bps");
        require(producerBps == 0, "bad producer bps");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia split 100 + direct issue seed ===");
        console.log("Factory proxy:             ", factoryProxy);
        console.log("Campaign:                  ", campaign);
        console.log("Campaign token:            ", campaignToken);
        console.log("Proceeds split impl:       ", address(proceedsSplitImpl));
        console.log("Direct issue impl:         ", address(directIssueImpl));
        console.log("Promoter:                  ", promoter);
        console.log("Promoter bps:              ", PROMOTER_BPS);
        console.log("Direct issue amount:       ", directIssueAmount);
        console.log("Buy payment amount:        ", buyPaymentAmount);
        console.log("Promoter received:         ", promoterAmount);
        console.log("Protocol fee received:     ", protocolFee);
    }
}
