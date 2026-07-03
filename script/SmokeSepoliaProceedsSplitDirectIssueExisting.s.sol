// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {GrowfiCampaign} from "../src/GrowfiCampaign.sol";
import {CampaignProceedsSplitModule} from "../src/modules/CampaignProceedsSplitModule.sol";
import {DirectIssueModule} from "../src/modules/DirectIssueModule.sol";
import {SaleClassicModule} from "../src/modules/SaleClassicModule.sol";

interface IMintableSmokeUsdc {
    function mint(address to, uint256 amount) external;
}

/// @title SmokeSepoliaProceedsSplitDirectIssueExisting
/// @notice Cheap testnet smoke against an existing producer-owned campaign.
///         Attaches the optional modules if missing, proves direct issue with
///         a 1 wei CT mint, proves split routing with a tiny USDC buy, then
///         clears the split so the demo campaign is not left rerouted.
contract SmokeSepoliaProceedsSplitDirectIssueExisting is Script {
    address internal constant DEFAULT_CAMPAIGN = 0x3280d078424FDE86fdE23688561FF377278071de;
    address internal constant DEFAULT_USDC = 0x32C344Dc9713d904442d0E5B0d2b7994E52B0d4E;
    address internal constant DEFAULT_PROMOTER = 0x000000000000000000000000000000000000bEEF;

    bytes32 internal constant TYPE_PROCEEDS_SPLIT = keccak256("growfi.type.proceeds.split");
    bytes32 internal constant TYPE_DIRECT_ISSUE = keccak256("growfi.type.direct.issue");
    bytes32 internal constant KIND_PROCEEDS_SPLIT = keccak256("growfi.proceeds.split.v1");
    bytes32 internal constant KIND_DIRECT_ISSUE = keccak256("growfi.direct.issue.v1");

    uint256 internal constant PAYMENT_AMOUNT = 144_000;
    uint16 internal constant PROMOTER_BPS = 2_500;

    function run() public {
        require(block.chainid == 11_155_111, "Ethereum Sepolia only");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address campaign = vm.envOr("SMOKE_CAMPAIGN", DEFAULT_CAMPAIGN);
        address usdc = vm.envOr("USDC_ADDRESS", DEFAULT_USDC);
        address promoter = vm.envOr("TEST_PROMOTER", DEFAULT_PROMOTER);
        address proceedsSplitImpl = vm.envAddress("PROCEEDS_SPLIT_IMPL");
        address directIssueImpl = vm.envAddress("DIRECT_ISSUE_IMPL");

        require(GrowfiCampaign(payable(campaign)).producer() == deployer, "deployer is not producer");
        require(SaleClassicModule(payable(campaign)).getSellBackQueueDepth() == 0, "queue must be empty");

        vm.startBroadcast(deployerPk);

        _attachIfMissing(campaign, TYPE_PROCEEDS_SPLIT, KIND_PROCEEDS_SPLIT, proceedsSplitImpl);
        _attachIfMissing(campaign, TYPE_DIRECT_ISSUE, KIND_DIRECT_ISSUE, directIssueImpl);

        uint256 supplyBefore = SaleClassicModule(payable(campaign)).currentSupply();
        DirectIssueModule(payable(campaign)).issueCampaignTokens(deployer, 1);
        require(SaleClassicModule(payable(campaign)).currentSupply() == supplyBefore + 1, "direct issue failed");

        CampaignProceedsSplitModule(payable(campaign)).setProceedsSplit(promoter, PROMOTER_BPS);

        address feeRecipient = GrowfiCampaign(payable(campaign)).protocolFeeRecipient();
        uint256 promoterBefore = IERC20(usdc).balanceOf(promoter);
        uint256 feeBefore = IERC20(usdc).balanceOf(feeRecipient);

        IMintableSmokeUsdc(usdc).mint(deployer, PAYMENT_AMOUNT);
        IERC20(usdc).approve(campaign, PAYMENT_AMOUNT);
        SaleClassicModule(payable(campaign)).buy(usdc, PAYMENT_AMOUNT);

        uint256 protocolFee = PAYMENT_AMOUNT * SaleClassicModule(payable(campaign)).fundingFeeBps() / 10_000;
        uint256 promoterAmount = (PAYMENT_AMOUNT - protocolFee) * PROMOTER_BPS / 10_000;
        require(IERC20(usdc).balanceOf(promoter) - promoterBefore == promoterAmount, "bad promoter split");
        require(IERC20(usdc).balanceOf(feeRecipient) - feeBefore == protocolFee, "bad protocol fee");

        CampaignProceedsSplitModule(payable(campaign)).clearProceedsSplit();

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia proceeds split + direct issue smoke ===");
        console.log("Campaign:              ", campaign);
        console.log("Proceeds split impl:   ", proceedsSplitImpl);
        console.log("Direct issue impl:     ", directIssueImpl);
        console.log("Promoter:              ", promoter);
        console.log("Direct issue amount:   ", uint256(1));
        console.log("Buy payment amount:    ", PAYMENT_AMOUNT);
        console.log("Promoter received:     ", promoterAmount);
        console.log("Protocol fee received: ", protocolFee);
    }

    function _attachIfMissing(address campaign, bytes32 moduleType, bytes32 kind, address impl) internal {
        (address current,,,,) = GrowfiCampaign(payable(campaign)).moduleSlot(moduleType);
        if (current == address(0)) {
            GrowfiCampaign(payable(campaign)).attachModule(moduleType, kind, impl, "");
        }
    }
}
