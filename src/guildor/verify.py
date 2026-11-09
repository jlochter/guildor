"""Verify a run record by replaying it from scratch.

Usage:  python -m guildor verify path/to/run.json
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from typing import Any

from . import rulesets
from .canonical import hash_value
from .record import FORMAT, genesis_hash, step_hash
from .ruleset import IllegalAction, ruleset_hash


@dataclass
class VerifyResult:
    ok: bool
    score: dict[str, int] | None = None
    errors: list[str] = field(default_factory=list)


def verify(
    record: dict[str, Any], expected_ruleset_hash: str | None = None
) -> VerifyResult:
    """Replay ``record`` and check every hash, the final state and the score.

    Pass ``expected_ruleset_hash`` (the official benchmark config) to also
    reject runs played under self-chosen constants: a record with edited
    constants is internally consistent, so replay alone can't catch it.
    """
    errs: list[str] = []

    def fail(msg: str) -> VerifyResult:
        errs.append(msg)
        return VerifyResult(ok=False, errors=errs)

    if record.get("format") != FORMAT:
        return fail(f"unsupported format {record.get('format')!r}")

    # 1. Envelope integrity: catches edits anywhere in the file.
    body = {k: v for k, v in record.items() if k != "run_hash"}
    try:
        if hash_value(body) != record.get("run_hash"):
            errs.append("run_hash mismatch: record was edited after it was written")
    except TypeError as e:
        return fail(f"record is not canonical JSON: {e}")

    # 2. Rules: same id, version and constants as claimed.
    meta = record["ruleset"]
    try:
        rules = rulesets.load(meta["id"], meta["version"], meta["spec"])
    except (KeyError, TypeError) as e:
        return fail(f"cannot load ruleset: {e}")
    if rules.spec() != meta["spec"]:
        return fail("ruleset spec has unknown or missing keys")
    if ruleset_hash(rules) != meta["hash"]:
        errs.append("ruleset hash mismatch")
    if expected_ruleset_hash and ruleset_hash(rules) != expected_ruleset_hash:
        errs.append("run was not played under the expected ruleset")

    # 3. Replay from the seed. This is the check that matters: state and
    #    score are recomputed, never read from the record.
    seed = record["seed"]
    state = rules.initial_state(seed)
    head = genesis_hash(ruleset_hash(rules), seed, state)
    if head != record["genesis_hash"]:
        errs.append("genesis_hash mismatch")

    for i, t in enumerate(record["turns"]):
        try:
            state = rules.apply(seed, state, t["action"])
        except IllegalAction as e:
            return fail(f"turn {i + 1}: illegal action: {e}")
        head = step_hash(head, t["action"], state)
        if head != t["state_hash"]:
            return fail(f"turn {i + 1}: state_hash diverges from replay")

    if not rules.is_terminal(state):
        return fail("game did not reach a terminal state")
    if head != record["final_hash"]:
        errs.append("final_hash mismatch")
    if state != record["final_state"]:
        errs.append("final_state does not match replay")

    score = rules.score(seed, state)
    if score != record["score"]:
        errs.append(f"claimed score {record['score']} != replayed score {score}")

    return VerifyResult(ok=not errs, score=score, errors=errs)


def main(argv: list[str] | None = None) -> int:
    """Verify one run file. Exit code 0 = valid, 1 = invalid, 2 = usage."""
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print("usage: python -m guildor verify RUN.json", file=sys.stderr)
        return 2
    with open(argv[0], encoding="utf-8") as f:
        res = verify(json.load(f))
    if res.ok:
        print(f"OK  score={res.score}")
        return 0
    print("INVALID")
    for e in res.errors:
        print(f"  - {e}")
    return 1
