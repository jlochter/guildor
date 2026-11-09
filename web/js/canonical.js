// Canonical JSON + hashing. Must produce byte-identical output to
// src/guildor/canonical.py (json.dumps sort_keys, compact, ensure_ascii=False).
// Keys are sorted by UTF-16 code unit; Python sorts by code point. They only
// differ for non-BMP characters, which keys never contain (ASCII only).

import { sha256Hex, utf8 } from "./sha256.js";

export class CanonicalError extends TypeError {}

export function canonicalJson(v, path = "$") {
  if (v === null) return "null";
  switch (typeof v) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(v)) {
        throw new CanonicalError(`non-integer number at ${path}: use integers`);
      }
      return String(v);
    case "string":
      return JSON.stringify(v);
    case "object": {
      if (Array.isArray(v)) {
        return "[" + v.map((x, i) => canonicalJson(x, `${path}[${i}]`)).join(",") + "]";
      }
      const keys = Object.keys(v).sort();
      return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(v[k], `${path}.${k}`)).join(",") + "}";
    }
    default:
      throw new CanonicalError(`unsupported type at ${path}: ${typeof v}`);
  }
}

export const hashValue = (v) => "sha256:" + sha256Hex(utf8(canonicalJson(v)));
