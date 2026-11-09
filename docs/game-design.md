# Game design: working notes

Status: **open, nothing decided.** This is where we design the actual game. The `sandbox` ruleset in `src/guildor/rulesets/` is only a placeholder for testing the engine and the verifier.

## Fixed constraints (from the proposal)

- Text only, turn-based, no movement.
- **Few turns.** Each turn is one allocation decision: split energy and resources across the options available that turn.
- **Fixed rules carry each turn into the next.** For example, what you gather this turn arrives next turn, and warriors hired now need gear later.
- No undo.
- One delayed reward: the final boss battle. Score = damage dealt.
- Deterministic given a seed (see [verification.md](verification.md)). All randomness comes from the seed and integer math.
- Small enough that a solver can compute the optimum per seed, so we can report `damage / optimal`.

## Skeleton to fill in

### State
Resources (materials, gold, energy?), units (warriors by type), items or gear, knowledge about the boss, turn counter.

### Action per turn
An allocation vector over the options for that turn, for example `{gather, hire, craft, scout, train}`, summing to the turn's budget. Questions:
- Is the set of options the same every turn, or drawn from the seed each turn (a "market" of offers)?
- Can points be saved for later, or is anything unspent lost?

### Rules that carry over between turns
Candidates:
- Delays: gathering pays out next turn, and training takes 2 turns.
- Upkeep: warriors eat materials every turn.
- Compounding: investing early (tools) raises later yields.
- Decay: unused resources spoil.

### Boss and final battle
- Boss stats come from the seed and may be partly hidden: weaknesses, resistances, phases.
- Scouting spends budget to reveal a hidden attribute. This is the partial-information lever.
- The battle should be deterministic given the seed and the final state, or use a fixed number of seeded rounds. We need to calibrate it: not plain arithmetic, but not a lottery either.

### Score
- Raw: damage dealt (an integer).
- Normalized: damage ÷ solver optimum for that seed.
- Reported over N seeds as mean ± spread, with random, greedy, solver and human baselines.

## Solver budget (rough estimate to keep us honest)

With `T` turns, a budget `E` and `k` options, there are `C(E+k-1, k-1)` actions per turn. For `E=6, k=3` that's 28, and over 5 turns about 17M sequences, which is too many to brute-force naively but easy with DP over the reachable states. Each new option or a larger budget multiplies this quickly, so check every feature against this before adding it.

## Open questions (from the background doc)

- [ ] Can the model use tools or run code during play?
- [ ] How many turns, resource types and unit types still let us compute the optimum?
- [ ] Which baselines: random, greedy, solver, human?
- [ ] One episode, or several with memory carried between runs?
- [ ] How should the harness present rules and state (a fixed prompt template)?
