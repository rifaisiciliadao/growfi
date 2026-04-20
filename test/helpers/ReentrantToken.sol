// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ReentrantToken — hostile ERC20 used to prove ReentrancyGuard correctness
/// @notice On every transfer / transferFrom it invokes an attacker-configured
///         `(target, payload)`. If the protocol's nonReentrant modifier is
///         doing its job, the reentry call must revert. Tests assert that.
contract ReentrantToken is ERC20 {
    address public attackTarget;
    bytes public attackPayload;
    bool public armed;
    bool public swallow; // if true, silently absorb a failed reentry instead of bubbling
    bool public lastCallOk;
    bytes public lastCallRet;
    uint8 private _decimalsValue;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimalsValue = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimalsValue;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Arm the token so the next transfer / transferFrom will attempt
    ///         a reentrant call into `target` with `payload`. Disarms itself
    ///         after firing to avoid infinite recursion. When `swallow_` is
    ///         true, a failed reentry is absorbed silently (for tests that
    ///         want to observe post-state); when false, the reentry revert
    ///         bubbles up and aborts the outer call (for tests that want
    ///         to assert the guard trips).
    function arm(address target, bytes calldata payload, bool swallow_) external {
        attackTarget = target;
        attackPayload = payload;
        armed = true;
        swallow = swallow_;
    }

    function arm(address target, bytes calldata payload) external {
        attackTarget = target;
        attackPayload = payload;
        armed = true;
        swallow = false;
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        if (armed) {
            armed = false; // one-shot; prevent runaway recursion
            (bool ok, bytes memory ret) = attackTarget.call(attackPayload);
            lastCallOk = ok;
            lastCallRet = ret;
            if (!ok && !swallow) {
                // Bubble the revert reason so tests can assert on it.
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
    }
}
