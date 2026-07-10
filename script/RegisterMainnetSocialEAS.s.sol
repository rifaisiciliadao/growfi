// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {GrowfiProducerRegistryV2} from "../src/GrowfiProducerRegistryV2.sol";

interface IEASSchemaRegistry {
    struct SchemaRecord {
        bytes32 uid;
        address resolver;
        bool revocable;
        string schema;
    }

    function getSchema(bytes32 uid) external view returns (SchemaRecord memory);
    function register(string calldata schema, address resolver, bool revocable) external returns (bytes32);
}

/// @title RegisterMainnetSocialEAS
/// @notice Deploys or resumes the mainnet ProducerRegistry V2 replacement,
///         migrates legacy producer state, registers the GrowFi social schema,
///         and authorizes the backend verifier. It does not publish a user
///         attestation.
contract RegisterMainnetSocialEAS is Script {
    address internal constant LEGACY_PRODUCER_REGISTRY = 0x651fb29e69Bde3ADE988e8E75e9A3012272D2de5;
    address internal constant EAS_SCHEMA_REGISTRY = 0xA7b39296258348C78294F95B872b282326A97BDF;
    address internal constant EXPECTED_OWNER = 0xA229F3c9851E26fC9eA18157b88cd1CDA6F90e55;
    address internal constant RESOLVER = address(0);
    bool internal constant REVOCABLE = true;
    string internal constant SOCIAL_SCHEMA =
        "string protocol,address grower,string platform,string handle,string profileUrl,string proofUrl,bytes32 proofHash,uint64 issuedAt,uint64 expiresAt,uint256 nonce";

    address internal constant LEGACY_PRODUCER_0 = 0x06a2608413384F4B9a52576f4f79ceb358c7FC42;
    address internal constant LEGACY_PRODUCER_1 = 0xC3FFeb3560EE7FF68C46c1D4162Ed61497ec5268;
    address internal constant LEGACY_PRODUCER_2 = 0xE6c30AD5AeE7AD22e9F39D51d67667587cdD05A1;

    function run() public {
        require(block.chainid == 1, "Ethereum mainnet only");

        bool forkSimulation = vm.envOr("FORK_SIMULATION", uint256(0)) == 1;
        address owner = vm.envOr("MAINNET_OWNER_ADDRESS", EXPECTED_OWNER);
        uint256 ownerPk;
        if (!forkSimulation) {
            ownerPk = vm.envUint("MAINNET_DEPLOYER_PRIVATE_KEY");
            require(vm.addr(ownerPk) == owner, "unexpected deployer key");
        }
        address verifier = vm.envAddress("SOCIAL_VERIFIER_ADDRESS");
        uint256 minVerifierBalance = vm.envOr("MIN_SOCIAL_VERIFIER_BALANCE_WEI", uint256(0.01 ether));

        address configuredRegistry = vm.envOr("MAINNET_PRODUCER_REGISTRY_V2_ADDRESS", address(0));
        GrowfiProducerRegistryV2 producerRegistry;
        IEASSchemaRegistry schemaRegistry = IEASSchemaRegistry(EAS_SCHEMA_REGISTRY);
        bytes32 schemaUid = keccak256(abi.encodePacked(SOCIAL_SCHEMA, RESOLVER, REVOCABLE));

        require(
            GrowfiProducerRegistryV2(LEGACY_PRODUCER_REGISTRY).owner() == owner,
            "EOA is not legacy ProducerRegistry owner"
        );
        require(verifier.balance >= minVerifierBalance, "verifier wallet needs funding");

        if (forkSimulation) {
            vm.startPrank(owner);
        } else {
            vm.startBroadcast(ownerPk);
        }
        if (configuredRegistry == address(0)) {
            producerRegistry = new GrowfiProducerRegistryV2(owner, LEGACY_PRODUCER_REGISTRY);
        } else {
            producerRegistry = GrowfiProducerRegistryV2(configuredRegistry);
            require(address(producerRegistry).code.length != 0, "ProducerRegistry V2 has no code");
            require(producerRegistry.owner() == owner, "unexpected ProducerRegistry V2 owner");
            require(
                address(producerRegistry.legacyRegistry()) == LEGACY_PRODUCER_REGISTRY,
                "unexpected legacy ProducerRegistry"
            );
        }
        _migrateLegacyProducers(producerRegistry);
        if (!producerRegistry.isSocialVerifier(verifier)) {
            producerRegistry.grantSocialVerifier(verifier);
        }

        IEASSchemaRegistry.SchemaRecord memory record = schemaRegistry.getSchema(schemaUid);
        if (record.uid == bytes32(0)) {
            bytes32 registeredUid = schemaRegistry.register(SOCIAL_SCHEMA, RESOLVER, REVOCABLE);
            require(registeredUid == schemaUid, "unexpected schema UID");
        }
        if (forkSimulation) {
            vm.stopPrank();
        } else {
            vm.stopBroadcast();
        }

        record = schemaRegistry.getSchema(schemaUid);
        require(record.uid == schemaUid, "schema registration missing");
        require(producerRegistry.isSocialVerifier(verifier), "verifier role missing");

        console.log("=== GrowFi mainnet social EAS prepared ===");
        console.log("Legacy registry:  ", LEGACY_PRODUCER_REGISTRY);
        console.log("ProducerRegistry: ", address(producerRegistry));
        console.log("SchemaRegistry:   ", EAS_SCHEMA_REGISTRY);
        console.log("Owner EOA:        ", owner);
        console.log("Verifier:         ", verifier);
        console.log("Fork simulation:  ", forkSimulation);
        console.logBytes32(schemaUid);
    }

    function _migrateLegacyProducers(GrowfiProducerRegistryV2 producerRegistry) internal {
        address[3] memory producers = [LEGACY_PRODUCER_0, LEGACY_PRODUCER_1, LEGACY_PRODUCER_2];
        for (uint256 i; i < producers.length; ++i) {
            if (!producerRegistry.legacyProducerMigrated(producers[i])) {
                producerRegistry.migrateLegacyProducer(producers[i]);
            }
        }
    }
}
