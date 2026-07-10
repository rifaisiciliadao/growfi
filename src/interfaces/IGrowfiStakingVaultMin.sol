// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IGrowfiStakingVaultMin {
    function stake(uint256 amount) external returns (uint256 positionId);
    function forceUnstake(uint256 positionId) external;
    function claimYield(uint256 positionId) external;
    function yieldToken() external view returns (address);
    function getPositions(address user) external view returns (uint256[] memory);
    function positions(uint256 positionId)
        external
        view
        returns (
            address owner,
            uint256 amount,
            uint256 startTime,
            uint256 rewardPerTokenPaid,
            uint256 seasonId,
            bool active
        );
}
