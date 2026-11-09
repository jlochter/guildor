// JS engine must match the Python reference byte for byte.
//   node web/tests/conformance.mjs

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { canonicalJson, hashValue } from "../js/canonical.js";
import { play } from "../js/record.js";
import { Sandbox } from "../js/rulesets/sandbox.js";
import { sha256Hex, utf8 } from "../js/sha256.js";
import { encodeShare, recordFromShare } from "../js/share.js";
import { verify } from "../js/verify.js";

const vectors = JSON.parse(readFileSync(new URL("../../tests/vectors/sandbox.json", import.meta.url), "utf8"));

test("sha256 matches node:crypto", () => {
  const inputs = ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000), "⚔️ ünï"];
  for (const s of inputs) {
    assert.equal(sha256Hex(utf8(s)), createHash("sha256").update(s, "utf8").digest("hex"), JSON.stringify(s));
  }
});

test("records match Python vectors", () => {
  assert.ok(vectors.length > 0);
  for (const v of vectors) {
    const rec = play(new Sandbox(), v.seed, v.actions);
    assert.equal(canonicalJson(rec), canonicalJson(v.record), `seed ${JSON.stringify(v.seed)}`);
  }
});

test("share codes match Python and round-trip", () => {
  for (const v of vectors) {
    assert.equal(encodeShare(v.record), v.share);
    const { record, hashMatches } = recordFromShare(v.share);
    assert.ok(hashMatches);
    assert.equal(record.run_hash, v.record.run_hash);
  }
});

test("Python records verify in JS; tampering is caught", () => {
  for (const v of vectors) {
    assert.ok(verify(v.record).ok, v.seed);
    const forged = structuredClone(v.record);
    forged.score.damage += 1;
    const { run_hash, ...body } = forged;
    forged.run_hash = hashValue(body);
    assert.equal(verify(forged).ok, false);
  }
});

test("floats are rejected", () => {
  assert.throws(() => canonicalJson({ x: 1.5 }));
});
