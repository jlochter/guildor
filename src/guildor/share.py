"""Share codes: (ruleset, seed, packed actions, claimed final hash).

Same format the website puts in ``#run=<code>`` links, so a run played in
the browser can be checked offline:

    python -m guildor verify-link "https://…/#run=eyJ…"
"""

from __future__ import annotations

import base64
import json
from typing import Any

from . import rulesets
from .canonical import canonical_bytes
from .record import play

SHARE_FORMAT = "guildor.share/1"


def encode_share(record: dict[str, Any]) -> str:
    rules = rulesets.load(record["ruleset"]["id"], record["ruleset"]["version"])
    payload = {
        "f": SHARE_FORMAT,
        "r": record["ruleset"]["id"],
        "v": record["ruleset"]["version"],
        "s": record["seed"],
        "a": [rules.pack_action(t["action"]) for t in record["turns"]],
        "h": record["final_hash"],
    }
    return base64.urlsafe_b64encode(canonical_bytes(payload)).decode().rstrip("=")


def decode_share(code: str) -> dict[str, Any]:
    code = code.strip()
    if "#run=" in code:
        code = code.split("#run=", 1)[1]
    try:
        raw = base64.urlsafe_b64decode(code + "=" * (-len(code) % 4))
        payload = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as e:
        raise ValueError("share code is not valid") from e
    if not isinstance(payload, dict) or payload.get("f") != SHARE_FORMAT:
        raise ValueError(f"unsupported share format {payload.get('f') if isinstance(payload, dict) else None!r}")
    return payload


def record_from_share(code: str) -> tuple[dict[str, Any], bool]:
    """Replay a share code. Returns (record, claimed_hash_matches)."""
    p = decode_share(code)
    rules = rulesets.load(p["r"], p["v"])
    record = play(rules, p["s"], [rules.unpack_action(a) for a in p["a"]])
    return record, record["final_hash"] == p["h"]
