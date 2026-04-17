import { MetadataSet as MetadataSetEvent } from "../generated/CampaignRegistry/CampaignRegistry";
import { Campaign } from "../generated/schema";

export function handleMetadataSet(event: MetadataSetEvent): void {
  const campaign = Campaign.load(event.params.campaign);
  if (campaign == null) return; // event for a campaign not deployed by our factory — ignore

  campaign.metadataURI = event.params.uri;
  campaign.metadataVersion = event.params.version;
  campaign.save();
}
