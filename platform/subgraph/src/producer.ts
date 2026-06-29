import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ProfileUpdated as ProfileUpdatedEvent,
  KycSet as KycSetEvent,
  SocialAttestationRevoked as SocialAttestationRevokedEvent,
  SocialAttestationSet as SocialAttestationSetEvent,
} from "../generated/ProducerRegistry/ProducerRegistry";
import { Producer } from "../generated/schema";

function getOrCreateProducer(id: Bytes): Producer {
  let producer = Producer.load(id);
  if (producer == null) {
    producer = new Producer(id);
    producer.version = BigInt.zero();
    producer.kyced = false;
    producer.socialVerified = false;
  }
  return producer;
}

export function handleProfileUpdated(event: ProfileUpdatedEvent): void {
  let producer = getOrCreateProducer(event.params.producer);
  producer.profileURI = event.params.uri;
  producer.version = event.params.version;
  producer.updatedAt = event.block.timestamp;
  producer.save();
}

export function handleKycSet(event: KycSetEvent): void {
  let producer = getOrCreateProducer(event.params.producer);
  producer.kyced = event.params.kyced;
  producer.kycSetAt = event.block.timestamp;
  producer.save();
}

export function handleSocialAttestationSet(event: SocialAttestationSetEvent): void {
  let producer = getOrCreateProducer(event.params.producer);
  producer.socialVerified = true;
  producer.socialVerifiedAt = event.block.timestamp;
  producer.socialExpiresAt = event.params.expiresAt;
  producer.socialPlatform = event.params.platform;
  producer.socialHandle = event.params.handle;
  producer.socialProfileUrl = event.params.profileUrl;
  producer.socialProofUrl = event.params.proofUrl;
  producer.socialProofHash = event.params.proofHash;
  producer.socialAttestationUID = event.params.attestationUID;
  producer.socialVerifier = event.params.verifier;
  producer.save();
}

export function handleSocialAttestationRevoked(event: SocialAttestationRevokedEvent): void {
  let producer = getOrCreateProducer(event.params.producer);
  producer.socialVerified = false;
  producer.socialExpiresAt = null;
  producer.socialProofHash = null;
  producer.socialAttestationUID = null;
  producer.socialVerifier = event.params.by;
  producer.save();
}
