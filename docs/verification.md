# Scoring and verification

**Goal:** given a run file, anyone can check, without trusting whoever produced it, that the game was played under the official rules and that the score follows from the moves made.

**Idea:** the score is never trusted. The engine is a deterministic function, so a run is fully defined by `(ruleset, seed, actions)`. The verifier replays those actions from scratch and recomputes every state and the score. A hash chain over the states lets you find the exact turn where a forged file stops matching the replay.

Implemented in [`src/guildor/record.py`](../src/guildor/record.py) and [`src/guildor/verify.py`](../src/guildor/verify.py), and tested in [`tests/test_verify.py`](../tests/test_verify.py).

## Determinism rules for rule code

Replay only works if every implementation computes the same thing. Rule code must follow these rules:

- **Integers only.** Floats are rejected by the canonical encoder. Use fixed point (for example basis points, `1.5x` → `15000`) and integer division with a documented rounding rule.
- **No ambient randomness.** All randomness comes from `Rng(seed, label)`: SplitMix64 seeded by `SHA-256(seed | label)`. Labels such as `"yield/3"` or `"boss/weakness"` give each random event its own stream, so adding a draw in one place doesn't shift the numbers anywhere else. The generator is small enough to port to JS or Rust and get identical output.
- **No clocks, I/O or iteration over unordered sets.**
- **Pure `apply(seed, state, action) -> state`.** Everything that affects the future lives in `state`.

## Canonical encoding

`H(x) = "sha256:" + hex(SHA-256(canonical_json(x)))`, where canonical JSON means sorted keys, no whitespace, UTF-8, and only dicts, lists, strings, ints, bools and null. Any port that follows this produces byte-identical hashes, and the test suite can double as a conformance suite for ports.

## Hash chain

```
R  = H({id, version, spec})                 # ruleset fingerprint
h0 = H({ruleset: R, seed, state: s0})
ht = H({prev: h(t-1), action: a_t, state: s_t})
run_hash = H(record without run_hash)
```

Replaying the seed and actions already proves correctness. The chain adds:

- **Pinpointing.** The verifier reports "turn 3 diverges", not just "invalid".
- **Step-by-step commitment.** A harness can stream `ht` live, for example to a log or a server, so a run can't be rewritten after the fact.
- **Partial checks.** A prefix of the run can be verified without the rest.
- **Port conformance.** A second implementation must reproduce every `ht`, not only the final score.

## Run record (`guildor.run/1`)

```jsonc
{
  "format": "guildor.run/1",
  "ruleset": { "id": "guildor.sandbox", "version": "0.1.0", "spec": { ... }, "hash": "sha256:…" },
  "seed": "test-seed-1",
  "genesis_hash": "sha256:…",
  "turns": [ { "turn": 1, "action": { "gather": 6, "hire": 0, "craft": 0 }, "state_hash": "sha256:…" }, … ],
  "final_hash": "sha256:…",
  "final_state": { ... },        // convenience, re-derived by the verifier
  "score": { "damage": 24 },     // convenience, re-derived by the verifier
  "run_hash": "sha256:…"
}
```

See [`examples/sandbox-run.json`](../examples/sandbox-run.json). To verify it:

```bash
PYTHONPATH=src python -m guildor verify examples/sandbox-run.json
```

## Share links (`guildor.share/1`)

A full record is long, but a run is fully defined by the rules, the seed and the actions. A share link carries exactly those, plus the claimed final hash:

```
https://jlochter.github.io/guildor/#run=<base64url(canonical_json(payload))>

payload = { f: "guildor.share/1", r: ruleset id, v: ruleset version,
            s: seed, a: [[gather, hire, craft], …], h: final_hash }
```

Opening the link rebuilds the full record by replay and checks that the replayed `final_hash` equals `h`. If they differ, the link was altered. Links always use the official constants for that ruleset version.

What a link can and can't prove: editing `a` without `h` is caught. Editing both gives a *different but legal* game, which is no forgery, since anyone could have played those moves. The hash proves which moves led to which score, not who made them (see the threat model below).

Python and the browser share one format. `python -m guildor verify-link URL` checks a link offline, and `tests/vectors/sandbox.json` pins Python and JS to the same bytes.

## Threat model

| Attack | Caught by | Status |
|---|---|---|
| Edit score or final state | Replay recomputes both | ✅ tested |
| Edit, swap or drop an action | Replay; chain shows the turn | ✅ tested |
| Illegal action (overspending energy) | `apply` raises `IllegalAction` | ✅ tested |
| Change the seed to a luckier one | Genesis and chain mismatch | ✅ tested |
| Stop before the final turn | Terminal check | ✅ tested |
| Self-chosen easier constants, fully re-played | `expected_ruleset_hash` pins the official config | ✅ tested |
| **Seed shopping**: replay until a lucky seed comes up | The benchmark assigns seeds. Publish `H(seed list)` before the eval and reveal the seeds after (commit-reveal), and report every attempt. | 📝 protocol |
| **Hidden information leaks**: the model sees the seed and derives hidden facts | The seed stays with the harness; the model only sees `observe(state)`. Reveal seeds after the eval. | 📝 protocol |
| **Moves came from a solver, not the model** | Replay can't tell who chose the moves. A trusted harness must sign the record together with `H(transcript)` (prompts and responses). | 🔜 planned: `attestation` field |

The last row is the important caveat. Hashes prove that **a valid game produced this score**. They don't prove **who played it**. That needs a trusted harness: we run the games, or the submitter's harness signs with a key we issued, ideally with the model transcript hashed into the record.

## Planned extensions

- `attestation: { harness_id, transcript_hash, sig }`: Ed25519 or HMAC over `run_hash`.
- `normalized` score: `damage / optimal_damage(seed)`, where the optimum is computed by the solver and cached per seed.
- A suite record that aggregates N runs into a mean and spread with one Merkle root over their `run_hash`es.
