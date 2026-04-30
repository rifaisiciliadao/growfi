import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

export type InviteStatus = "pending" | "approved" | "rejected";

export interface InviteRow {
  id: number;
  /** lowercase 0x… */
  address: string;
  email: string;
  telegram: string;
  status: InviteStatus;
  notes: string | null;
  ip: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Compact summary embedded in the index for fast admin listing. */
export interface InviteIndexItem {
  id: number;
  address: string;
  email: string;
  telegram: string;
  status: InviteStatus;
  createdAt: number;
  updatedAt: number;
}

export interface InviteIndex {
  version: 1;
  nextId: number;
  items: InviteIndexItem[];
}

export interface InviteStore {
  /** O(1) wallet-connect lookup: one GET on invites/<address>.json. */
  getByAddress(address: string): Promise<InviteRow | null>;

  insertRequest(input: {
    address: string;
    email: string;
    telegram: string;
    ip: string | null;
  }): Promise<InviteRow>;

  /** Returns the existing pending/approved record blocking a new request. */
  findActiveByEmailOrAddress(email: string, address: string): Promise<InviteRow | null>;

  countRecentByIp(ip: string, sinceMs: number): Promise<number>;

  list(opts: {
    status?: InviteStatus | "all";
    limit: number;
    offset: number;
  }): Promise<InviteIndexItem[]>;

  count(opts: { status?: InviteStatus | "all" }): Promise<number>;

  approve(address: string): Promise<InviteRow | null>;
  reject(address: string, notes: string | null): Promise<InviteRow | null>;
  remove(address: string): Promise<boolean>;
}

const INDEX_KEY_DEFAULT = "invites/_index.json";

interface StoreIO {
  loadIndex(): Promise<InviteIndex>;
  saveIndex(idx: InviteIndex): Promise<void>;
  loadRecord(address: string): Promise<InviteRow | null>;
  saveRecord(row: InviteRow): Promise<void>;
  deleteRecord(address: string): Promise<void>;
}

export function emptyIndex(): InviteIndex {
  return { version: 1, nextId: 1, items: [] };
}

function bySortedDesc<T extends { createdAt: number }>(a: T, b: T): number {
  return b.createdAt - a.createdAt;
}

function statusFilter<T extends { status: InviteStatus }>(
  status: InviteStatus | "all" | undefined,
) {
  return (r: T) => !status || status === "all" || r.status === status;
}

function toSummary(row: InviteRow): InviteIndexItem {
  return {
    id: row.id,
    address: row.address,
    email: row.email,
    telegram: row.telegram,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function makeStore(io: StoreIO): InviteStore {
  let cachedIndex: InviteIndex | null = null;
  let writeChain: Promise<unknown> = Promise.resolve();

  async function ensureIndex(): Promise<InviteIndex> {
    if (cachedIndex) return cachedIndex;
    cachedIndex = await io.loadIndex();
    return cachedIndex;
  }

  function patchIndex(
    state: InviteIndex,
    row: InviteRow,
    bumpId: boolean,
  ): InviteIndex {
    const summary = toSummary(row);
    const seen = state.items.some((i) => i.address === row.address);
    const items = seen
      ? state.items.map((i) => (i.address === row.address ? summary : i))
      : [...state.items, summary];
    return {
      ...state,
      nextId: bumpId ? state.nextId + 1 : state.nextId,
      items,
    };
  }

  function enqueue<T>(fn: () => Promise<{ index: InviteIndex; result: T }>): Promise<T> {
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

    async insertRequest({ address, email, telegram, ip }) {
      const lower = address.toLowerCase();
      return enqueue(async () => {
        const idx = await ensureIndex();
        const now = Date.now();
        const row: InviteRow = {
          id: idx.nextId,
          address: lower,
          email,
          telegram,
          status: "pending",
          notes: null,
          ip,
          createdAt: now,
          updatedAt: now,
        };
        await io.saveRecord(row);
        const next = patchIndex(idx, row, true);
        await io.saveIndex(next);
        return { index: next, result: row };
      });
    },

    async findActiveByEmailOrAddress(email, address) {
      const idx = await ensureIndex();
      const e = email.toLowerCase();
      const a = address.toLowerCase();
      const hit = idx.items
        .slice()
        .sort(bySortedDesc)
        .find(
          (r) =>
            (r.email.toLowerCase() === e || r.address === a) &&
            (r.status === "pending" || r.status === "approved"),
        );
      if (!hit) return null;
      return io.loadRecord(hit.address);
    },

    async countRecentByIp(ip, sinceMs) {
      const idx = await ensureIndex();
      // ip lives only on the per-eth record; load the candidates we have to
      // inspect (those still pending — rejected/old entries don't trigger the
      // limiter).
      let count = 0;
      for (const item of idx.items) {
        if (item.createdAt < sinceMs) continue;
        const row = await io.loadRecord(item.address);
        if (row?.ip === ip) count += 1;
      }
      return count;
    },

    async list({ status, limit, offset }) {
      const idx = await ensureIndex();
      return idx.items
        .filter(statusFilter(status))
        .sort(bySortedDesc)
        .slice(offset, offset + limit);
    },

    async count({ status }) {
      const idx = await ensureIndex();
      return idx.items.filter(statusFilter(status)).length;
    },

    async approve(address) {
      const lower = address.toLowerCase();
      return enqueue(async () => {
        const idx = await ensureIndex();
        const row = await io.loadRecord(lower);
        if (!row) return { index: idx, result: null };
        const updated: InviteRow = {
          ...row,
          status: "approved",
          updatedAt: Date.now(),
        };
        await io.saveRecord(updated);
        const next = patchIndex(idx, updated, false);
        await io.saveIndex(next);
        return { index: next, result: updated };
      });
    },

    async reject(address, notes) {
      const lower = address.toLowerCase();
      return enqueue(async () => {
        const idx = await ensureIndex();
        const row = await io.loadRecord(lower);
        if (!row) return { index: idx, result: null };
        const updated: InviteRow = {
          ...row,
          status: "rejected",
          notes,
          updatedAt: Date.now(),
        };
        await io.saveRecord(updated);
        const next = patchIndex(idx, updated, false);
        await io.saveIndex(next);
        return { index: next, result: updated };
      });
    },

    async remove(address) {
      const lower = address.toLowerCase();
      return enqueue(async () => {
        const idx = await ensureIndex();
        const before = idx.items.length;
        await io.deleteRecord(lower);
        const next: InviteIndex = {
          ...idx,
          items: idx.items.filter((i) => i.address !== lower),
        };
        await io.saveIndex(next);
        return { index: next, result: next.items.length !== before };
      });
    },
  };
}

// --- in-memory implementation (used by tests) ---

export function buildInMemoryStore(): InviteStore {
  let index: InviteIndex = emptyIndex();
  const records = new Map<string, InviteRow>();
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
  });
}

// --- DO Spaces (S3) implementation ---

export interface SpacesStoreOptions {
  s3: S3Client;
  bucket: string;
  /** Prefix for the per-eth records and the index. Default: "invites". */
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

export function buildSpacesStore({
  s3,
  bucket,
  prefix = "invites",
}: SpacesStoreOptions): InviteStore {
  return makeStore({
    async loadIndex() {
      try {
        const res = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: indexKey(prefix) }),
        );
        const text = (await res.Body?.transformToString()) ?? "";
        if (!text) return emptyIndex();
        const parsed = JSON.parse(text) as InviteIndex;
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
        return JSON.parse(text) as InviteRow;
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
  });
}
