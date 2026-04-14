// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title CampaignToken — "The Seat"
/// @notice Per-campaign staking token. Strictly deflationary: supply can only decrease.
/// @dev Mintable only by Campaign contract. Burnable by Campaign + StakingVault.
contract CampaignToken is ERC20, ERC20Permit, ERC20Votes {
    address public immutable campaign;
    address public stakingVault;

    error OnlyCampaign();
    error OnlyCampaignOrVault();
    error StakingVaultAlreadySet();

    modifier onlyCampaign() {
        if (msg.sender != campaign) revert OnlyCampaign();
        _;
    }

    modifier onlyCampaignOrVault() {
        if (msg.sender != campaign && msg.sender != stakingVault) revert OnlyCampaignOrVault();
        _;
    }

    constructor(string memory name_, string memory symbol_, address campaign_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        campaign = campaign_;
    }

    /// @notice Set the StakingVault address. Can only be called once by the Campaign.
    function setStakingVault(address stakingVault_) external onlyCampaign {
        if (stakingVault != address(0)) revert StakingVaultAlreadySet();
        stakingVault = stakingVault_;
    }

    /// @notice Mint new tokens. Only callable by Campaign during initial sales.
    function mint(address to, uint256 amount) external onlyCampaign {
        _mint(to, amount);
    }

    /// @notice Burn tokens from an account. Callable by Campaign (buyback/sellback) or StakingVault (penalties).
    function burn(address from, uint256 amount) external onlyCampaignOrVault {
        _burn(from, amount);
    }

    // --- Overrides required by Solidity for ERC20 + ERC20Votes ---

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
