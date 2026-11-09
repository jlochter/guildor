"""Regenerate tests/vectors/sandbox.json, the shared Python/JS conformance set.

    PYTHONPATH=src python tests/make_vectors.py

The JS engine (web/tests/conformance.mjs) must reproduce every record and
share code byte for byte. Regenerate only on an intentional rules change
(and bump the ruleset version when you do).
"""

import json
import random
from pathlib import Path

from guildor import play
from guildor.rulesets.sandbox import ALLOC_KEYS, Sandbox
from guildor.share import encode_share

OUT = Path(__file__).parent / "vectors" / "sandbox.json"


def random_actions(rng: random.Random, rules: Sandbox) -> list[dict]:
    spec = rules.spec()
    out = []
    for _ in range(spec["turns"]):
        cuts = sorted(rng.randint(0, spec["energy"]) for _ in range(len(ALLOC_KEYS) - 1))
        parts = [b - a for a, b in zip([0, *cuts], [*cuts, spec["energy"]])]
        out.append(dict(zip(ALLOC_KEYS, parts)))
    return out


def main() -> None:
    rng = random.Random(1234)  # only used to pick test inputs, not by the engine
    rules = Sandbox()
    seeds = ["test-seed-1", "daily-2026-11-09", "", "ünïcødé ⚔️ seed", "x" * 200]
    seeds += [f"vec-{i}" for i in range(15)]
    cases = []
    for seed in seeds:
        actions = random_actions(rng, rules)
        rec = play(rules, seed, actions)
        cases.append({"seed": seed, "actions": actions, "record": rec, "share": encode_share(rec)})
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(cases, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(cases)} vectors to {OUT}")


if __name__ == "__main__":
    main()
