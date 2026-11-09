// Share links: the smallest thing that is still verifiable.
// A run is fully defined by (ruleset, seed, actions), so a link carries
// exactly that plus the claimed final hash. Opening it replays the game.
// Mirrors src/guildor/share.py.

import { canonicalJson } from "./canonical.js";
import { utf8 } from "./sha256.js";
import { play } from "./record.js";
import { load } from "./rulesets/index.js";

export const SHARE_FORMAT = "guildor.share/1";

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeShare(record) {
  const rules = load(record.ruleset.id, record.ruleset.version);
  const payload = {
    f: SHARE_FORMAT,
    r: record.ruleset.id,
    v: record.ruleset.version,
    s: record.seed,
    a: record.turns.map((t) => rules.packAction(t.action)),
    h: record.final_hash,
  };
  return b64urlEncode(utf8(canonicalJson(payload)));
}

export function decodeShare(code) {
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(code.trim())));
  } catch {
    throw new Error("share code is not valid");
  }
  if (payload?.f !== SHARE_FORMAT) throw new Error(`unsupported share format ${JSON.stringify(payload?.f)}`);
  return payload;
}

/** Rebuild the full run record from a share code. Links use the official spec only. */
export function recordFromShare(code) {
  const p = decodeShare(code);
  const rules = load(p.r, p.v);
  const record = play(rules, p.s, p.a.map((a) => rules.unpackAction(a)));
  return { record, claimedHash: p.h, hashMatches: record.final_hash === p.h };
}
