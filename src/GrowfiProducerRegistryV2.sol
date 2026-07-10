// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GrowfiProducerRegistry} from "./GrowfiProducerRegistry.sol";

interface ILegacyGrowfiProducerRegistry {
    function owner() external view returns (address);
    function profileURI(address producer) external view returns (string memory);
    function version(address producer) external view returns (uint256);
    function kyced(address producer) external view returns (bool);
    function kycSetAt(address producer) external view returns (uint256);
}

/// @title GrowfiProducerRegistryV2
/// @notice Social-attestation registry with trustless migration from the
///         immutable pre-social mainnet ProducerRegistry.
contract GrowfiProducerRegistryV2 is GrowfiProducerRegistry {
    ILegacyGrowfiProducerRegistry public immutable legacyRegistry;
    mapping(address => bool) public legacyProducerMigrated;

    event LegacyProducerMigrated(address indexed producer, uint256 profileVersion, bool kyced, uint256 kycSetAt);

    error InvalidLegacyRegistry();

    constructor(address owner_, address legacyRegistry_) GrowfiProducerRegistry(owner_) {
        if (legacyRegistry_.code.length == 0) revert InvalidLegacyRegistry();
        legacyRegistry = ILegacyGrowfiProducerRegistry(legacyRegistry_);
        if (legacyRegistry.owner() != owner_) revert InvalidLegacyRegistry();
    }

    /// @notice Copy one producer's legacy profile and KYC state exactly once.
    /// @dev Anyone may call because every copied value is read from the fixed
    ///      legacy registry; the caller cannot provide or alter migrated data.
    function migrateLegacyProducer(address producer) external {
        if (producer == address(0)) revert ZeroAddress();
        if (legacyProducerMigrated[producer] || version[producer] != 0) revert NoChange();

        uint256 legacyVersion = legacyRegistry.version(producer);
        string memory legacyProfileURI = legacyRegistry.profileURI(producer);
        bool legacyKyced = legacyRegistry.kyced(producer);
        uint256 legacyKycSetAt = legacyRegistry.kycSetAt(producer);
        if (legacyVersion == 0 && legacyKycSetAt == 0) revert NoChange();
        if (legacyVersion != 0 && bytes(legacyProfileURI).length == 0) revert EmptyURI();

        legacyProducerMigrated[producer] = true;
        if (legacyVersion != 0) {
            profileURI[producer] = legacyProfileURI;
            version[producer] = legacyVersion;
            emit ProfileUpdated(producer, legacyVersion, legacyProfileURI);
        }
        kyced[producer] = legacyKyced;
        kycSetAt[producer] = legacyKycSetAt;
        if (legacyKycSetAt != 0) {
            emit KycSet(producer, legacyKyced, address(legacyRegistry));
        }
        emit LegacyProducerMigrated(producer, legacyVersion, legacyKyced, legacyKycSetAt);
    }
}
