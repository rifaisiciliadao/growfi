import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { isAddress, recoverMessageAddress, type Hex } from "viem";
import type { NotificationStore } from "./notifications-store.js";

export interface NotificationRoutesDeps {
  store: NotificationStore;
  /** HMAC key for one-click unsubscribe links. */
  unsubSecret: string;
  /** Public URL of the frontend (for the unsubscribe confirmation redirect). */
  appUrl: string;
  /** Max age, in ms, accepted for the `issuedAt` field of a signed message. */
  signatureMaxAgeMs?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_SIG_MAX_AGE_MS = 10 * 60 * 1000;

interface SignedPayload {
  address: string;
  email: string;
  optedIn: boolean;
  issuedAt: string;
  nonce: string;
  signature: Hex;
}

function parseAddress(raw: string, reply: FastifyReply): string | null {
  const lower = String(raw ?? "").trim().toLowerCase();
  if (!isAddress(lower)) {
    reply.status(400).send({ error: "Indirizzo Ethereum non valido" });
    return null;
  }
  return lower;
}

/**
 * Canonical signed message. Order matters — frontend MUST build the same
 * string or signature recovery returns a different address.
 */
export function buildSignedMessage(p: {
  address: string;
  email: string;
  optedIn: boolean;
  issuedAt: string;
  nonce: string;
}): string {
  return [
    "GrowFi notifications",
    `Address: ${p.address.toLowerCase()}`,
    `Email: ${p.email}`,
    `Opted in: ${p.optedIn ? "true" : "false"}`,
    `Issued: ${p.issuedAt}`,
    `Nonce: ${p.nonce}`,
  ].join("\n");
}

function unsubToken(secret: string, address: string): string {
  const lower = address.toLowerCase();
  const mac = createHmac("sha256", secret).update(lower).digest("hex");
  return `${lower}.${mac}`;
}

function verifyUnsubToken(secret: string, token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const addr = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^[0-9a-f]{40}$/.test(addr.replace(/^0x/, ""))) return null;
  if (!/^[0-9a-f]{64}$/.test(mac)) return null;
  const expected = createHmac("sha256", secret).update(addr).digest("hex");
  // timing-safe — both sides are hex of equal length, so Buffer compare is fine.
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return addr;
}

/** Exported for tests & worker (digest email needs to embed unsubscribe links). */
export function buildUnsubscribeUrl(opts: {
  appUrl: string;
  apiBase?: string;
  unsubSecret: string;
  address: string;
}): string {
  const base = opts.apiBase ?? `${opts.appUrl.replace(/\/$/, "")}/api`;
  return `${base}/notifications/unsubscribe?token=${unsubToken(opts.unsubSecret, opts.address)}`;
}

export function registerNotificationRoutes(
  app: FastifyInstance,
  deps: NotificationRoutesDeps,
): void {
  const { store, unsubSecret, appUrl } = deps;
  const sigMaxAge = deps.signatureMaxAgeMs ?? DEFAULT_SIG_MAX_AGE_MS;

  /**
   * Public read — returns only opt-in status and a hint that an email is on
   * file. The email itself is intentionally NOT exposed: anyone could query
   * `/me?address=0x...` for an arbitrary wallet, so leaking the email would
   * be a privacy regression. The user's own form re-collects the email on
   * change anyway.
   */
  app.get<{ Querystring: { address?: string } }>(
    "/api/notifications/me",
    async (req, reply) => {
      const raw = (req.query.address ?? "").trim();
      if (!raw) return reply.send({ optedIn: false, hasEmail: false });
      const lower = parseAddress(raw, reply);
      if (lower === null) return;
      const row = await store.getByAddress(lower);
      if (!row) {
        return reply.send({ optedIn: false, hasEmail: false, address: lower });
      }
      return reply.send({
        optedIn: row.optedIn,
        hasEmail: Boolean(row.email),
        address: row.address,
        updatedAt: row.updatedAt,
      });
    },
  );

  /**
   * Save / update notification preferences. Always signature-gated — any
   * mutation must come from the wallet whose address is being modified.
   */
  app.put<{
    Body: Partial<SignedPayload>;
  }>("/api/notifications/me", async (req, reply) => {
    const body = req.body ?? {};
    const addressRaw = (body.address ?? "").trim();
    const email = (body.email ?? "").trim();
    const optedIn = body.optedIn === true;
    const issuedAt = (body.issuedAt ?? "").trim();
    const nonce = (body.nonce ?? "").trim();
    const signature = (body.signature ?? "").trim() as Hex;

    if (!isAddress(addressRaw.toLowerCase())) {
      return reply.status(400).send({ error: "Indirizzo Ethereum non valido" });
    }
    if (optedIn && !EMAIL_RE.test(email)) {
      return reply.status(400).send({ error: "Email non valida" });
    }
    if (!issuedAt || !nonce) {
      return reply
        .status(400)
        .send({ error: "Manca issuedAt o nonce nel payload firmato" });
    }
    if (!signature || !signature.startsWith("0x")) {
      return reply.status(400).send({ error: "Firma mancante o non valida" });
    }

    const issuedMs = Date.parse(issuedAt);
    if (!Number.isFinite(issuedMs)) {
      return reply.status(400).send({ error: "issuedAt non è un timestamp valido" });
    }
    const ageMs = Date.now() - issuedMs;
    if (ageMs > sigMaxAge) {
      return reply.status(400).send({
        error: "Firma scaduta. Riprova: il messaggio dev'essere firmato di recente.",
      });
    }
    if (ageMs < -sigMaxAge) {
      return reply.status(400).send({ error: "Timestamp del messaggio nel futuro" });
    }

    const address = addressRaw.toLowerCase();
    const message = buildSignedMessage({
      address,
      email,
      optedIn,
      issuedAt,
      nonce,
    });

    let recovered: string;
    try {
      recovered = (await recoverMessageAddress({
        message,
        signature,
      })).toLowerCase();
    } catch {
      return reply.status(400).send({ error: "Firma non verificabile" });
    }
    if (recovered !== address) {
      return reply.status(401).send({
        error: "La firma non corrisponde all'indirizzo dichiarato",
      });
    }

    const row = await store.upsert({
      address,
      email,
      optedIn,
      signedMessage: message,
      signature,
      signedAt: issuedMs,
    });

    return reply.send({
      ok: true,
      address: row.address,
      optedIn: row.optedIn,
      hasEmail: Boolean(row.email),
      updatedAt: row.updatedAt,
    });
  });

  /** Hard delete via signed message — the user explicitly removes their record. */
  app.delete<{
    Body: Partial<Omit<SignedPayload, "email" | "optedIn">>;
  }>("/api/notifications/me", async (req, reply) => {
    const body = req.body ?? {};
    const addressRaw = (body.address ?? "").trim();
    const issuedAt = (body.issuedAt ?? "").trim();
    const nonce = (body.nonce ?? "").trim();
    const signature = (body.signature ?? "").trim() as Hex;

    if (!isAddress(addressRaw.toLowerCase())) {
      return reply.status(400).send({ error: "Indirizzo Ethereum non valido" });
    }
    if (!issuedAt || !nonce || !signature) {
      return reply.status(400).send({ error: "Payload firmato incompleto" });
    }
    const issuedMs = Date.parse(issuedAt);
    if (!Number.isFinite(issuedMs) || Math.abs(Date.now() - issuedMs) > sigMaxAge) {
      return reply.status(400).send({ error: "Firma scaduta o non valida" });
    }
    const address = addressRaw.toLowerCase();
    // Delete-message uses a fixed sentinel so it's distinguishable from a save.
    const message = [
      "GrowFi notifications",
      `Address: ${address}`,
      `Action: delete`,
      `Issued: ${issuedAt}`,
      `Nonce: ${nonce}`,
    ].join("\n");

    let recovered: string;
    try {
      recovered = (await recoverMessageAddress({
        message,
        signature,
      })).toLowerCase();
    } catch {
      return reply.status(400).send({ error: "Firma non verificabile" });
    }
    if (recovered !== address) {
      return reply.status(401).send({ error: "Firma non corrispondente" });
    }
    const ok = await store.remove(address);
    return reply.send({ ok });
  });

  /**
   * One-click unsubscribe from a digest email. HMAC token avoids the need to
   * sign with the wallet — the user just received the email, that's enough
   * proof of ownership for an opt-out (it can never escalate privileges).
   * Idempotent: re-clicking returns the same confirmation.
   */
  app.get<{ Querystring: { token?: string } }>(
    "/api/notifications/unsubscribe",
    async (req, reply) => {
      const token = (req.query.token ?? "").trim();
      const addr = token ? verifyUnsubToken(unsubSecret, token) : null;
      if (!addr) {
        reply.type("text/html; charset=utf-8");
        return reply.status(400).send(unsubscribePage({
          ok: false,
          appUrl,
          message: "Link non valido o scaduto.",
        }));
      }
      const existing = await store.getByAddress(addr);
      if (existing && existing.optedIn) {
        await store.upsert({
          address: existing.address,
          email: existing.email,
          optedIn: false,
          signedMessage: existing.signedMessage,
          signature: existing.signature,
          signedAt: existing.signedAt,
        });
      }
      reply.type("text/html; charset=utf-8");
      return reply.send(unsubscribePage({
        ok: true,
        appUrl,
        message: "Disiscritto. Non riceverai più email da GrowFi su questo indirizzo.",
      }));
    },
  );
}

function unsubscribePage(opts: { ok: boolean; appUrl: string; message: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>GrowFi · ${opts.ok ? "Unsubscribed" : "Error"}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f6f7f4; color:#1a2e1f; }
  .card { max-width:480px; margin:80px auto; background:#fff; border-radius:14px; padding:36px; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center; }
  h1 { font-size:22px; margin:0 0 12px 0; }
  p { color:#5a6a5d; line-height:1.5; }
  a { display:inline-block; margin-top:18px; padding:10px 18px; background:#2e6b3a; color:#fff; border-radius:10px; text-decoration:none; }
</style>
</head>
<body>
  <div class="card">
    <div style="font-size:14px; font-weight:700; color:#2e6b3a; letter-spacing:0.04em;">GROWFI</div>
    <h1>${opts.ok ? "You're unsubscribed" : "Something went wrong"}</h1>
    <p>${opts.message}</p>
    <a href="${opts.appUrl}">Open GrowFi</a>
  </div>
</body>
</html>`;
}
