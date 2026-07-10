import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { BlockList, isIP } from "node:net";

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type ResolveHostname = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export type PinnedHttpRequest = (
  url: URL,
  resolved: ResolvedAddress,
  maxBytes: number,
  timeoutMs: number,
) => Promise<Response>;

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["2001::", 32],
  ["2002::", 16],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

export const resolveHostname: ResolveHostname = async (hostname) => {
  const resolved = await lookup(hostname, { all: true, verbatim: true });
  return resolved.map(({ address, family }) => ({ address, family }));
};

export async function assertPublicHttpUrl(
  input: string,
  resolver: ResolveHostname = resolveHostname,
): Promise<void> {
  await resolvePublicHttpUrl(input, resolver);
}

export async function fetchPublicHttpUrl(
  input: string,
  resolver: ResolveHostname = resolveHostname,
  requestPinned: PinnedHttpRequest = requestPinnedHttpUrl,
  maxBytes = 1_000_000,
  timeoutMs = 10_000,
): Promise<Response> {
  const { url, addresses } = await resolvePublicHttpUrl(input, resolver);
  let lastError: unknown = new Error("Proof URL host did not resolve");
  for (const resolved of addresses) {
    try {
      return await requestPinned(url, resolved, maxBytes, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function resolvePublicHttpUrl(
  input: string,
  resolver: ResolveHostname,
): Promise<{ url: URL; addresses: readonly ResolvedAddress[] }> {
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP(S) proof URLs are allowed");
  }
  if (url.username || url.password) {
    throw new Error("Proof URL credentials are not allowed");
  }
  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== expectedPort) {
    throw new Error("Non-standard proof URL ports are not allowed");
  }

  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new Error("Private proof URL host is not allowed");
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolver(hostname);
  if (addresses.length === 0) {
    throw new Error("Proof URL host did not resolve");
  }
  for (const resolved of addresses) {
    if (!isPublicAddress(resolved.address)) {
      throw new Error("Proof URL resolves to a non-public address");
    }
  }
  return { url, addresses };
}

export async function readBoundedText(response: Response, maxBytes = 1_000_000): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Proof response is too large");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Proof response is too large");
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

function isPublicAddress(input: string): boolean {
  const address = stripIpv6Brackets(input).toLowerCase();
  const family = isIP(address);
  if (family === 4) return !blockedAddresses.check(address, "ipv4");
  if (family !== 6) return false;

  const mapped = mappedIpv4Address(address);
  if (mapped) return isPublicAddress(mapped);
  return !blockedAddresses.check(address, "ipv6");
}

function mappedIpv4Address(address: string): string | null {
  const marker = address.match(/^(?:::|(?:0{1,4}:){5})ffff:(.+)$/);
  if (!marker) return null;
  const suffix = marker[1];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(suffix)) return suffix;
  const words = suffix.split(":");
  if (words.length !== 2 || words.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) {
    return null;
  }
  const value = parseInt(words[0], 16) * 0x1_0000 + parseInt(words[1], 16);
  return [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(".");
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

async function requestPinnedHttpUrl(
  url: URL,
  resolved: ResolvedAddress,
  maxBytes: number,
  timeoutMs: number,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const originalHostname = stripIpv6Brackets(url.hostname);
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: resolved.address,
      family: resolved.family,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        accept: "text/html,text/plain,*/*",
        "accept-encoding": "identity",
        host: url.host,
        "user-agent": "GrowFiSocialVerifier/1.0 (+https://growfi.dev)",
      },
      ...(url.protocol === "https:" && !isIP(originalHostname)
        ? { servername: originalHostname }
        : {}),
    };
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = send(options, (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > maxBytes) {
          response.destroy(new Error("Proof response is too large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        const status = response.statusCode ?? 502;
        const headers = new Headers();
        for (let i = 0; i < response.rawHeaders.length; i += 2) {
          headers.append(response.rawHeaders[i], response.rawHeaders[i + 1]);
        }
        const emptyBody = status === 204 || status === 205 || status === 304;
        resolve(new Response(emptyBody ? null : Buffer.concat(chunks), {
          status,
          headers,
        }));
      });
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Proof URL request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}
