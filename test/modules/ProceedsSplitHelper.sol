// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CampaignProceedsSplitModule} from "../../src/modules/CampaignProceedsSplitModule.sol";

library ProceedsSplitHelper {
    function selectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](4);
        uint256 i;
        s[i++] = CampaignProceedsSplitModule.setProceedsSplit.selector;
        s[i++] = CampaignProceedsSplitModule.clearProceedsSplit.selector;
        s[i++] = CampaignProceedsSplitModule.proceedsSplit.selector;
        s[i++] = CampaignProceedsSplitModule.previewProceedsSplit.selector;
    }
}
