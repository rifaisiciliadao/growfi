import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

export interface ProjectUpdateReactionRow {
  /** lowercase 0x... */
  address: string;
  emoji: string;
  updatedAt: number;
}

export interface ProjectUpdateReactionRecord {
  version: 1;
  /** lowercase campaign address */
  campaign: string;
  updateId: string;
  reactions: ProjectUpdateReactionRow[];
  updatedAt: number;
}

export interface ProjectUpdateReactionStore {
  get(campaign: string, updateId: string): Promise<ProjectUpdateReactionRecord>;
  set(input: {
    campaign: string;
    updateId: string;
    address: string;
    emoji: string;
  }): Promise<ProjectUpdateReactionRecord>;
  remove(input: {
    campaign: string;
    updateId: string;
    address: string;
  }): Promise<ProjectUpdateReactionRecord>;
}

interface StoreIO {
  loadRecord(campaign: string, updateId: string): Promise<ProjectUpdateReactionRecord | null>;
  saveRecord(record: ProjectUpdateReactionRecord): Promise<void>;
}

function emptyRecord(campaign: string, updateId: string): ProjectUpdateReactionRecord {
  return {
    version: 1,
    campaign: campaign.toLowerCase(),
    updateId,
    reactions: [],
    updatedAt: Date.now(),
  };
}

function sanitizeRecord(
  campaign: string,
  updateId: string,
  record: ProjectUpdateReactionRecord | null,
): ProjectUpdateReactionRecord {
  if (!record || !Array.isArray(record.reactions)) return emptyRecord(campaign, updateId);
  return {
    version: 1,
    campaign: campaign.toLowerCase(),
    updateId,
    reactions: record.reactions
      .filter((r) => r.address && r.emoji)
      .map((r) => ({
        address: r.address.toLowerCase(),
        emoji: r.emoji,
        updatedAt: Number(r.updatedAt) || 0,
      })),
    updatedAt: Number(record.updatedAt) || 0,
  };
}

function makeStore(io: StoreIO): ProjectUpdateReactionStore {
  const writeChains = new Map<string, Promise<unknown>>();

  function key(campaign: string, updateId: string) {
    return `${campaign.toLowerCase()}:${updateId}`;
  }

  async function load(campaign: string, updateId: string) {
    return sanitizeRecord(
      campaign,
      updateId,
      await io.loadRecord(campaign.toLowerCase(), updateId),
    );
  }

  function enqueue<T>(
    campaign: string,
    updateId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const k = key(campaign, updateId);
    const previous = writeChains.get(k) ?? Promise.resolve();
    const job = previous.then(fn);
    writeChains.set(
      k,
      job.then(
        () => undefined,
        () => undefined,
      ),
    );
    return job;
  }

  return {
    get: load,

    async set({ campaign, updateId, address, emoji }) {
      const lowerCampaign = campaign.toLowerCase();
      const lowerAddress = address.toLowerCase();
      return enqueue(lowerCampaign, updateId, async () => {
        const record = await load(lowerCampaign, updateId);
        const now = Date.now();
        const next: ProjectUpdateReactionRecord = {
          ...record,
          reactions: [
            ...record.reactions.filter((r) => r.address !== lowerAddress),
            { address: lowerAddress, emoji, updatedAt: now },
          ].sort((a, b) => a.address.localeCompare(b.address)),
          updatedAt: now,
        };
        await io.saveRecord(next);
        return next;
      });
    },

    async remove({ campaign, updateId, address }) {
      const lowerCampaign = campaign.toLowerCase();
      const lowerAddress = address.toLowerCase();
      return enqueue(lowerCampaign, updateId, async () => {
        const record = await load(lowerCampaign, updateId);
        const now = Date.now();
        const next: ProjectUpdateReactionRecord = {
          ...record,
          reactions: record.reactions.filter((r) => r.address !== lowerAddress),
          updatedAt: now,
        };
        await io.saveRecord(next);
        return next;
      });
    },
  };
}

export function buildInMemoryProjectUpdateReactionStore(): ProjectUpdateReactionStore {
  const records = new Map<string, ProjectUpdateReactionRecord>();
  return makeStore({
    async loadRecord(campaign, updateId) {
      return records.get(`${campaign.toLowerCase()}:${updateId}`) ?? null;
    },
    async saveRecord(record) {
      records.set(`${record.campaign}:${record.updateId}`, record);
    },
  });
}

export interface SpacesProjectUpdateReactionStoreOptions {
  s3: S3Client;
  bucket: string;
  prefix?: string;
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === "NoSuchKey" ||
    e.Code === "NoSuchKey" ||
    e.$metadata?.httpStatusCode === 404
  );
}

function recordKey(prefix: string, campaign: string, updateId: string): string {
  return `${prefix}/${campaign.toLowerCase()}/${updateId}.json`;
}

export function buildSpacesProjectUpdateReactionStore({
  s3,
  bucket,
  prefix = "project-update-reactions",
}: SpacesProjectUpdateReactionStoreOptions): ProjectUpdateReactionStore {
  return makeStore({
    async loadRecord(campaign, updateId) {
      try {
        const res = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: recordKey(prefix, campaign, updateId),
          }),
        );
        const text = (await res.Body?.transformToString()) ?? "";
        if (!text) return null;
        return JSON.parse(text) as ProjectUpdateReactionRecord;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async saveRecord(record) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: recordKey(prefix, record.campaign, record.updateId),
          Body: JSON.stringify(record),
          ContentType: "application/json",
          ACL: "private",
          CacheControl: "no-cache, no-store, must-revalidate",
        }),
      );
    },
  });
}
