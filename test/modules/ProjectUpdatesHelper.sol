// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProjectUpdatesModule} from "../../src/modules/ProjectUpdatesModule.sol";

library ProjectUpdatesHelper {
    function selectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](7);
        uint256 i;
        s[i++] = ProjectUpdatesModule.postProjectUpdate.selector;
        s[i++] = ProjectUpdatesModule.setProjectUpdateHidden.selector;
        s[i++] = ProjectUpdatesModule.projectUpdate.selector;
        s[i++] = ProjectUpdatesModule.projectUpdateCount.selector;
        s[i++] = ProjectUpdatesModule.visibleProjectUpdateCount.selector;
        s[i++] = ProjectUpdatesModule.projectUpdateIdAt.selector;
        s[i++] = ProjectUpdatesModule.nextProjectUpdateId.selector;
    }
}
