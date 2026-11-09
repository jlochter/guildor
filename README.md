# Guildor

A text-only, turn-based guild-management game built as a **contamination-resistant LLM benchmark**. Over a small number of turns the agent splits energy and resources between gathering materials, hiring warriors and equipping them. Then the guild fights one final boss, and the score is the damage dealt.

What makes it a benchmark and not just a game:

- **One delayed reward.** No feedback until the final battle.
- **Irreversible decisions.** Fixed rules carry each turn into the next, and there is no undo.
- **Partial information.** For example, scouting the boss's weaknesses costs resources.
- **Content generated per seed.** There is nothing to memorize from pretraining.
- **Computable optimum.** Scores can be reported as `damage / optimal`.
- **Verifiable runs.** Every run is a deterministic replay with a hash chain, so a score can't be faked by editing a file.

## Play

**https://jlochter.github.io/guildor/** (published from `web/` by GitHub Actions on every push to `main`).

- Pick an allocation each turn, then see your damage at the end.
- **Daily** seed: everyone plays the same game each UTC day. **Random** gives a fresh seed, and `#play/<seed>` plays a specific one.
- At the end you get the **run proof** (final hash), a **share link** and a downloadable **run file**.
- Opening a share link replays the whole game in the viewer's browser and shows ✓ or the turn where the run stops matching. The **Verify a run** page also accepts pasted or uploaded run files.

To run it locally (ES modules need a server, not `file://`):

```bash
python -m http.server 8765 -d web
```

## Docs

| File | What's in it |
|---|---|
| [docs/background.md](docs/background.md) | Why benchmarks get contaminated, prior game benchmarks (BALROG, TextArena, ARC-AGI-3, Vending-Bench…), and the proposal |
| [docs/game-design.md](docs/game-design.md) | Working notes on the actual game (open) |
| [docs/verification.md](docs/verification.md) | Determinism rules, hash chain, run-record format, threat model |

The original discussion is in the [Game-Based LLM Benchmark — Background & Proposal](https://claude.ai/artifact/WgBSUTGgSLH39KhZZxr6ko) doc.

## Layout

```
src/guildor/
  canonical.py      canonical JSON + SHA-256 (no floats allowed)
  rng.py            portable seeded RNG (SplitMix64 per labelled stream)
  ruleset.py        Ruleset protocol every game version implements
  record.py         Session: play turn by turn, emit a hash-chained run record
  verify.py         replay a record from scratch and check every hash and the score
  share.py          share-link codes (same format as the website)
  rulesets/
    sandbox.py      PLACEHOLDER rules for exercising the pipeline
web/                the static site (GitHub Pages), no build step
  index.html, style.css
  js/               JS port of the engine (sha256, canonical, rng, record, verify, share)
  js/app.js         UI: play, result, verify
  tests/            conformance: JS must match the Python vectors byte for byte
tests/              Python unittest suite (honest run passes, every tamper fails)
  vectors/          shared Python/JS test vectors (regenerate with tests/make_vectors.py)
examples/           sample run records
runs/               local run outputs (git-ignored)
docs/
.github/workflows/  test + deploy to Pages
```

**There are two engines, Python (the reference) and JavaScript (the browser), and they must agree exactly.** Any rules change goes into both `src/guildor/rulesets/` and `web/js/rulesets/`, with a version bump, followed by `python tests/make_vectors.py`. CI fails if the two produce different hashes.

## Quick start

Requires Python 3.11+ and no dependencies.

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
```

```bash
node --test web/tests/conformance.mjs
```

```bash
PYTHONPATH=src python -m guildor verify examples/sandbox-run.json
```

```bash
PYTHONPATH=src python -m guildor verify-link "https://jlochter.github.io/guildor/#run=…"
```

Play from code:

```python
from guildor import Session, verify
from guildor.rulesets.sandbox import Sandbox

s = Session(Sandbox(), seed="my-seed")
while not s.done:
    obs = s.observe()                     # what the agent sees
    s.step({"gather": 2, "hire": 2, "craft": 2})
record = s.record()                       # JSON-serializable, hash-chained
assert verify(record).ok
```

## Status

- [x] Deterministic engine core, run records, replay verifier
- [x] Playable web version on GitHub Pages, with share links and an in-browser verifier
- [ ] Game design (see [docs/game-design.md](docs/game-design.md))
- [ ] Real ruleset v1
- [ ] Solver for the optimal score per seed
- [ ] Baselines: random, greedy, human
- [ ] LLM harness (fixed prompt template, transcript hashing, signed attestation)
