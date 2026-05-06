import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

export interface NotificationRow {
  /** lowercase 0x… */
  address: string;
  email: string;
  optedIn: boolean;
  /** Last signed message (for audit). */
  signedMessage: string;
  /** Last signature (for audit). */
  signature: string;
  signedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationIndexItem {
  address: string;
  email: string;
  optedIn: boolean;
  updatedAt: number;
}

export interface NotificationIndex {
  version: 1;
  items: NotificationIndexItem[];
}

export interface NotificationCursor {
  /** Last block whose Purchase events were processed. */
  lastPurchaseBlock: number;
  /** Last unix-secs cursor for Season.endTime. */
  lastSeasonEndedTs: number;
  /** Last unix-secs cursor for Season.reportedAt. */
  lastSeasonReportedTs: number;
  /** Last unix-secs cursor for Claim.claimedAt (USDC commits). */
  lastClaimCommittedTs: number;
  updatedAt: number;
}

export interface NotificationStore {
  getByAddress(address: string): Promise<NotificationRow | null>;
  upsert(input: {
    address: string;
    email: string;
    optedIn: boolean;
    signedMessage: string;
    signature: string;
    signedAt: number;
  }): Promise<NotificationRow>;
  remove(address: string): Promise<boolean>;
  listOptedIn(): Promise<NotificationIndexItem[]>;
  loadCursor(): Promise<NotificationCursor>;
  saveCursor(cursor: NotificationCursor): Promise<void>;
}

export function emptyIndex(): NotificationIndex {
  return { version: 1, items: [] };
}

export function emptyCursor(): NotificationCursor {
  return {
    lastPurchaseBlock: 0,
    lastSeasonEndedTs: 0,
    lastSeasonReportedTs: 0,
    lastClaimCommittedTs: 0,
    updatedAt: 0,
  };
}

interface StoreIO {
  loadIndex(): Promise<NotificationIndex>;
  saveIndex(idx: NotificationIndex): Promise<void>;
  loadRecord(address: string): Promise<NotificationRow | null>;
  saveRecord(row: NotificationRow): Promise<void>;
  deleteRecord(address: string): Promise<void>;
  loadCursor(): Promise<NotificationCursor>;
  saveCursor(c: NotificationCursor): Promise<void>;
}

function toSummary(row: NotificationRow): NotificationIndexItem {
  return {
    address: row.address,
    email: row.email,
    optedIn: row.optedIn,
    updatedAt: row.updatedAt,
  };
}

function makeStore(io: StoreIO): NotificationStore {
  let cachedIndex: NotificationIndex | null = null;
  let writeChain: Promise<unknown> = Promise.resolve();

  async function ensureIndex(): Promise<NotificationIndex> {
    if (cachedIndex) return cachedIndex;
    cachedIndex = await io.loadIndex();
    return cachedIndex;
  }

  function patchIndex(state: NotificationIndex, row: NotificationRow): NotificationIndex {
    const summary = toSummary(row);
    const seen = state.items.some((i) => i.address === row.address);
    const items = seen
      ? state.items.map((i) => (i.address === row.address ? summary : i))
      : [...state.items, summary];
    return { ...state, items };
  }

  function enqueue<T>(
    fn: () => Promise<{ index: NotificationIndex; result: T }>,
  ): Promise<T> {
    const job = writeChain.then(async () => {
      const { index, result } = await fn();
      cachedIndex = index;
      return result;
    });
    writeChain = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  return {
    async getByAddress(address) {
      return io.loadRecord(address.toLowerCase());
    },

    async upsert({ address, email, optedIn, signedMessage, signature, signedAt }) {
      const lower = address.toLowerCase();
      return enqueue(async () => {
        const idx = await ensureIndex();
        const existing = await io.loadRecord(lower);
        const now = Date.now();
        const row: NotificationRow = {
          address: lower,
          email,
          optedIn,
          signedMessage,
          signature,
          signedAt,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        await io.saveRecord(row);
        const next = patchIndex(idx, row);
        await io.saveIndex(next);
        return { index: next, result: row };
      });
    },

    async remove(address) {
      const lower = address.toLowerCase();
      return enqueue(async () => {
        const idx = await ensureIndex();
        const before = idx.items.length;
        await io.deleteRecord(lower);
        const next: NotificationIndex = {
          ...idx,
          items: idx.items.filter((i) => i.address !== lower),
        };
        await io.saveIndex(next);
        return { index: next, result: next.items.length !== before };
      });
    },

    async listOptedIn() {
      const idx = await ensureIndex();
      return idx.items.filter((i) => i.optedIn);
    },

    loadCursor: io.loadCursor,
    saveCursor: io.saveCursor,
  };
}

// --- in-memory implementation (used by tests) ---

export function buildInMemoryNotificationStore(): NotificationStore {
  let index: NotificationIndex = emptyIndex();
  let cursor: NotificationCursor = emptyCursor();
  const records = new Map<string, NotificationRow>();
  return makeStore({
    async loadIndex() {
      return index;
    },
    async saveIndex(next) {
      index = next;
    },
    async loadRecord(address) {
      return records.get(address) ?? null;
    },
    async saveRecord(row) {
      records.set(row.address, row);
    },
    async deleteRecord(address) {
      records.delete(address);
    },
    async loadCursor() {
      return cursor;
    },
    async saveCursor(c) {
      cursor = c;
    },
  });
}

// --- DO Spaces (S3) implementation ---

export interface SpacesNotificationStoreOptions {
  s3: S3Client;
  bucket: string;
  /** Prefix for the per-eth records, the index, and the cursor. Default: "notifications". */
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

function recordKey(prefix: string, address: string): string {
  return `${prefix}/${address.toLowerCase()}.json`;
}

function indexKey(prefix: string): string {
  return `${prefix}/_index.json`;
}

function cursorKey(prefix: string): string {
  return `${prefix}/_cursor.json`;
}

export function buildSpacesNotificationStore({
  s3,
  bucket,
  prefix = "notifications",
}: SpacesNotificationStoreOptions): NotificationStore {
  return makeStore({
    async loadIndex() {
      try {
        const res = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: indexKey(prefix) }),
        );
        const text = (await res.Body?.transformToString()) ?? "";
        if (!text) return emptyIndex();
        const parsed = JSON.parse(text) as NotificationIndex;
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
          return emptyIndex();
        }
        return parsed;
      } catch (err) {
        if (isNotFound(err)) return emptyIndex();
        throw err;
      }
    },
    async saveIndex(next) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: indexKey(prefix),
          Body: JSON.stringify(next),
          ContentType: "application/json",
          ACL: "private",
          CacheControl: "no-cache, no-store, must-revalidate",
        }),
      );
    },
    async loadRecord(address) {
      try {
        const res = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: recordKey(prefix, address),
          }),
        );
        const text = (await res.Body?.transformToString()) ?? "";
        if (!text) return null;
        return JSON.parse(text) as NotificationRow;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async saveRecord(row) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: recordKey(prefix, row.address),
          Body: JSON.stringify(row),
          ContentType: "application/json",
          ACL: "private",
          CacheControl: "no-cache, no-store, must-revalidate",
        }),
      );
    },
    async deleteRecord(address) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: recordKey(prefix, address),
        }),
      );
    },
    async loadCursor() {
      try {
        const res = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: cursorKey(prefix) }),
        );
        const text = (await res.Body?.transformToString()) ?? "";
        if (!text) return emptyCursor();
        const parsed = JSON.parse(text) as NotificationCursor;
        if (!parsed || typeof parsed !== "object") return emptyCursor();
        return {
          lastPurchaseBlock: Number(parsed.lastPurchaseBlock ?? 0),
          lastSeasonEndedTs: Number(parsed.lastSeasonEndedTs ?? 0),
          lastSeasonReportedTs: Number(parsed.lastSeasonReportedTs ?? 0),
          lastClaimCommittedTs: Number(parsed.lastClaimCommittedTs ?? 0),
          updatedAt: Number(parsed.updatedAt ?? 0),
        };
      } catch (err) {
        if (isNotFound(err)) return emptyCursor();
        throw err;
      }
    },
    async saveCursor(c) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: cursorKey(prefix),
          Body: JSON.stringify(c),
          ContentType: "application/json",
          ACL: "private",
          CacheControl: "no-cache, no-store, must-revalidate",
        }),
      );
    },
  });
}
