import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Staked as StakedEvent,
  Unstaked as UnstakedEvent,
  Restaked as RestakedEvent,
  YieldMinted as YieldMintedEvent,
  YieldRateUpdated as YieldRateUpdatedEvent,
  SeasonStarted as SeasonStartedEvent,
  SeasonEnded as SeasonEndedEvent,
} from "../generated/templates/StakingVault/StakingVault";
import {
  Position,
  CampaignStaker,
  Season,
  YieldRateSnapshot,
  Campaign,
  ContractIndex,
  User,
  GlobalStats,
} from "../generated/schema";

const GLOBAL_ID = Bytes.fromUTF8("global");

function campaignFromVault(vaultAddress: Bytes): Campaign | null {
  const idx = ContractIndex.load(vaultAddress);
  if (idx == null) return null;
  return Campaign.load(idx.campaign);
}

function positionId(campaignId: Bytes, pid: BigInt): Bytes {
  return campaignId.concatI32(pid.toI32());
}

function seasonEntityId(campaignId: Bytes, sid: BigInt): Bytes {
  return campaignId.concatI32(sid.toI32());
}

function campaignStakerId(campaignId: Bytes, user: Bytes): Bytes {
  return campaignId.concat(user);
}

function loadOrCreateUser(addr: Bytes, timestamp: BigInt): User {
  let user = User.load(addr);
  if (user == null) {
    user = new User(addr);
    user.purchasesCount = 0;
    user.positionsCount = 0;
    user.totalInvested = BigInt.zero();
    user.firstSeenAt = timestamp;

    const stats = GlobalStats.load(GLOBAL_ID);
    if (stats != null) {
      stats.userCount = stats.userCount + 1;
      stats.save();
    }
  }
  return user;
}

function loadOrCreateCampaignStaker(
  campaignId: Bytes,
  user: Bytes,
  timestamp: BigInt,
): CampaignStaker {
  const id = campaignStakerId(campaignId, user);
  let staker = CampaignStaker.load(id);
  if (staker == null) {
    staker = new CampaignStaker(id);
    staker.campaign = campaignId;
    staker.user = user;
    staker.activePositionCount = 0;
    staker.totalStaked = BigInt.zero();
    staker.firstStakedAt = timestamp;
  }
  staker.lastUpdatedAt = timestamp;
  return staker;
}

export function handleStaked(event: StakedEvent): void {
  const campaign = campaignFromVault(event.address);
  if (campaign == null) return;

  const pos = new Position(positionId(campaign.id, event.params.positionId));
  pos.campaign = campaign.id;
  pos.positionId = event.params.positionId;
  pos.user = event.params.user;
  pos.amount = event.params.amount;
  pos.startTime = event.block.timestamp;
  // On-chain, stake() sets pos.seasonId = currentSeasonId at that block.
  // We mirror that by reading campaign.currentSeasonId (kept in sync by
  // handleSeasonStarted / handleSeasonEnded).
  pos.seasonId = campaign.currentSeasonId;
  pos.yieldClaimed = BigInt.zero();
  pos.active = true;
  pos.createdAt = event.block.timestamp;
  pos.createdAtTx = event.transaction.hash;
  pos.save();

  const user = loadOrCreateUser(event.params.user, event.block.timestamp);
  if (user.positionsCount == 0) {
    const stats = GlobalStats.load(GLOBAL_ID);
    if (stats != null) {
      stats.totalStakers = stats.totalStakers + 1;
      stats.save();
    }
  }
  user.positionsCount = user.positionsCount + 1;
  user.save();

  const staker = loadOrCreateCampaignStaker(
    campaign.id,
    event.params.user,
    event.block.timestamp,
  );
  if (staker.activePositionCount == 0) {
    campaign.activeStakerCount = campaign.activeStakerCount + 1;
  }
  staker.activePositionCount = staker.activePositionCount + 1;
  staker.totalStaked = staker.totalStaked.plus(event.params.amount);
  staker.save();

  campaign.totalStaked = event.params.newTotalStaked;
  campaign.currentYieldRate = event.params.newYieldRate;
  campaign.save();
}

export function handleUnstaked(event: UnstakedEvent): void {
  const campaign = campaignFromVault(event.address);
  if (campaign == null) return;

  const pos = Position.load(positionId(campaign.id, event.params.positionId));
  if (pos != null) {
    pos.active = false;
    pos.unstakedAt = event.block.timestamp;
    pos.unstakedAtTx = event.transaction.hash;
    pos.penaltyBurned = event.params.penaltyAmount;
    pos.save();
  }

  const staker = CampaignStaker.load(
    campaignStakerId(campaign.id, event.params.user),
  );
  if (staker != null) {
    if (staker.activePositionCount > 0) {
      staker.activePositionCount = staker.activePositionCount - 1;
      if (staker.activePositionCount == 0 && campaign.activeStakerCount > 0) {
        campaign.activeStakerCount = campaign.activeStakerCount - 1;
      }
    }
    staker.totalStaked = event.params.stakedAmount.gt(staker.totalStaked)
      ? BigInt.zero()
      : staker.totalStaked.minus(event.params.stakedAmount);
    staker.lastUpdatedAt = event.block.timestamp;
    staker.save();
  }

  campaign.totalStaked = event.params.newTotalStaked;
  campaign.currentYieldRate = event.params.newYieldRate;
  campaign.save();
}

export function handleRestaked(event: RestakedEvent): void {
  const campaign = campaignFromVault(event.address);
  if (campaign == null) return;

  const pos = Position.load(positionId(campaign.id, event.params.positionId));
  if (pos != null) {
    pos.seasonId = event.params.newSeasonId;
    pos.startTime = event.block.timestamp;
    // Reset yieldClaimed so snapshots of the NEW season don't carry
    // over earnings from the previous one. The previous season's
    // yield was minted at restake time and is tracked via YieldMinted
    // events but grouped by position, so we accept the trade-off of
    // not attributing those events to a specific season.
    pos.yieldClaimed = BigInt.zero();
    pos.save();
  }
}

export function handleYieldMinted(event: YieldMintedEvent): void {
  const campaign = campaignFromVault(event.address);
  if (campaign == null) return;

  const pos = Position.load(positionId(campaign.id, event.params.positionId));
  if (pos != null) {
    pos.yieldClaimed = pos.yieldClaimed.plus(event.params.yieldAmount);
    pos.save();
  }
}

export function handleYieldRateUpdated(event: YieldRateUpdatedEvent): void {
  const campaign = campaignFromVault(event.address);
  if (campaign == null) return;

  campaign.currentYieldRate = event.params.newYieldRate;
  campaign.totalStaked = event.params.totalStaked_;
  campaign.save();

  const snap = new YieldRateSnapshot(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  );
  snap.campaign = campaign.id;
  snap.yieldRate = event.params.newYieldRate;
  snap.totalStaked = event.params.totalStaked_;
  snap.maxSupply = event.params.maxSupply_;
  snap.timestamp = event.block.timestamp;
  snap.save();
}

export function handleSeasonStarted(event: SeasonStartedEvent): void {
  const campaign = campaignFromVault(event.address);
  if (campaign == null) return;

  campaign.currentSeasonId = event.params.seasonId;
  campaign.save();

  const season = new Season(seasonEntityId(campaign.id, event.params.seasonId));
  season.campaign = campaign.id;
  season.seasonId = event.params.seasonId;
  season.startTime = event.params.startTime;
  season.active = true;
  season.usdcDeposited = BigInt.zero();
  season.usdcOwed = BigInt.zero();
  season.reported = false;
  season.save();
}

export function handleSeasonEnded(event: SeasonEndedEvent): void {
  const campaign = campaignFromVault(event.address);
  if (campaign == null) return;

  const season = Season.load(
    seasonEntityId(campaign.id, event.params.seasonId),
  );
  if (season != null) {
    season.active = false;
    season.endTime = event.params.endTime;
    season.totalYieldSupply = event.params.totalYieldMinted;
    season.save();
  }
}
