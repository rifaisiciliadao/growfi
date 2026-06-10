// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DebtRestructuringModule} from "../../src/modules/DebtRestructuringModule.sol";

library DebtRestructuringHelper {
    function selectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](7);
        uint256 i;
        s[i++] = DebtRestructuringModule.initializeDebtRestructuring.selector;
        s[i++] = DebtRestructuringModule.initializeDebtRestructuringByProducer.selector;
        s[i++] = DebtRestructuringModule.claimRestructuredCampaignTokens.selector;
        s[i++] = DebtRestructuringModule.quoteRestructuredCampaignTokens.selector;
        s[i++] = DebtRestructuringModule.debtRestructuringStarted.selector;
        s[i++] = DebtRestructuringModule.restructuredCampaignTokensClaimed.selector;
        s[i++] = DebtRestructuringModule.restructuredUsdcShortfall.selector;
    }
}
