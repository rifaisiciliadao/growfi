import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicHttpUrl, fetchPublicHttpUrl } from "./public-http.js";

test("fetchPublicHttpUrl connects to the validated address without a second DNS lookup", async () => {
  let resolutions = 0;
  const response = await fetchPublicHttpUrl(
    "https://proof.example/status/1",
    async () => {
      resolutions += 1;
      return [{ address: "93.184.216.34", family: 4 }];
    },
    async (url, resolved) => {
      assert.equal(url.hostname, "proof.example");
      assert.deepEqual(resolved, { address: "93.184.216.34", family: 4 });
      return new Response("verified", { status: 200 });
    },
  );

  assert.equal(resolutions, 1);
  assert.equal(await response.text(), "verified");
});

test("fetchPublicHttpUrl rejects any hostname resolution containing a private address", async () => {
  let requested = false;
  await assert.rejects(
    fetchPublicHttpUrl(
      "https://proof.example/status/1",
      async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "169.254.169.254", family: 4 },
      ],
      async () => {
        requested = true;
        return new Response("unexpected");
      },
    ),
    /non-public address/,
  );
  assert.equal(requested, false);
});

test("assertPublicHttpUrl rejects hexadecimal IPv4-mapped loopback addresses", async () => {
  await assert.rejects(
    assertPublicHttpUrl("http://[::ffff:127.0.0.1]/latest/meta-data"),
    /non-public address/,
  );
});

test("assertPublicHttpUrl rejects IPv4 translation addresses", async () => {
  await assert.rejects(
    assertPublicHttpUrl("http://[64:ff9b::a9fe:a9fe]/latest/meta-data"),
    /non-public address/,
  );
});
