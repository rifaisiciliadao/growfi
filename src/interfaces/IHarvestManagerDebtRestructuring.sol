// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHarvestManagerDebtRestructuring {
    function seasonHarvests(uint256 seasonId)
        external
        view
        returns (
            bytes32 merkleRoot,
            uint256 totalHarvestValueUSD,
            uint256 totalYieldSupply,
            uint256 totalProductUnits,
            uint256 claimStart,
            uint256 claimEnd,
            uint256 usdcDeadline,
            uint256 usdcDeposited,
            uint256 usdcOwed,
            uint256 protocolFeeCollected,
            uint256 protocolFeeTransferred,
            bool reported
        );

    function claims(uint256 seasonId, address holder)
        external
        view
        returns (bool claimed, uint8 redemptionType, uint256 amount, uint256 usdcAmount, uint256 usdcClaimed);

    function restructureUSDCShortfall(uint256 seasonId, address holder) external returns (uint256 shortfallAmount);
}
