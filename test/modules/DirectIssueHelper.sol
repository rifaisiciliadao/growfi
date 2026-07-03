// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DirectIssueModule} from "../../src/modules/DirectIssueModule.sol";

library DirectIssueHelper {
    function selectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](3);
        uint256 i;
        s[i++] = DirectIssueModule.issueCampaignTokens.selector;
        s[i++] = DirectIssueModule.issueCampaignTokensBatch.selector;
        s[i++] = DirectIssueModule.quoteDirectIssue.selector;
    }
}
