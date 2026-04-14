// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title YieldToken — "The Fruit"
/// @notice Per-campaign harvest claim token. Minted by StakingVault, burned on redemption.
/// @dev Fresh $YIELD minted each season. No carry-over between seasons.
contract YieldToken is ERC20 {
    address public immutable stakingVault;
    address public immutable harvestManager;

    error OnlyStakingVault();
    error OnlyVaultOrHarvest();

    modifier onlyStakingVault() {
        if (msg.sender != stakingVault) revert OnlyStakingVault();
        _;
    }

    modifier onlyVaultOrHarvest() {
        if (msg.sender != stakingVault && msg.sender != harvestManager) revert OnlyVaultOrHarvest();
        _;
    }

    constructor(string memory name_, string memory symbol_, address stakingVault_, address harvestManager_)
        ERC20(name_, symbol_)
    {
        stakingVault = stakingVault_;
        harvestManager = harvestManager_;
    }

    /// @notice Mint yield tokens. Only callable by StakingVault during staking.
    function mint(address to, uint256 amount) external onlyStakingVault {
        _mint(to, amount);
    }

    /// @notice Burn yield tokens. Callable by StakingVault (forfeit) or HarvestManager (redemption).
    function burn(address from, uint256 amount) external onlyVaultOrHarvest {
        _burn(from, amount);
    }
}
