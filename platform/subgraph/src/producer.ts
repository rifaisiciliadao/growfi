import { ProfileUpdated as ProfileUpdatedEvent } from "../generated/ProducerRegistry/ProducerRegistry";
import { Producer } from "../generated/schema";

export function handleProfileUpdated(event: ProfileUpdatedEvent): void {
  let producer = Producer.load(event.params.producer);
  if (producer == null) {
    producer = new Producer(event.params.producer);
  }
  producer.profileURI = event.params.uri;
  producer.version = event.params.version;
  producer.updatedAt = event.block.timestamp;
  producer.save();
}
