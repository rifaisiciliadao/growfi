// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "../../src/interfaces/AggregatorV3Interface.sol";

/// @notice Mirrors Chainlink's L2 sequencer-uptime feed shape.
///         `answer == 0` → sequencer up, `answer == 1` → sequencer down.
///         `startedAt` is when the current status began (used for grace period).
contract MockSequencerFeed is AggregatorV3Interface {
    int256 private _answer;
    uint256 private _startedAt;

    constructor(int256 answer_, uint256 startedAt_) {
        _answer = answer_;
        _startedAt = startedAt_;
    }

    function setState(int256 answer_, uint256 startedAt_) external {
        _answer = answer_;
        _startedAt = startedAt_;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, _answer, _startedAt, block.timestamp, 1);
    }

    function decimals() external pure override returns (uint8) {
        return 0;
    }
}
