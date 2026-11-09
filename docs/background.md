# Background: why a game-based LLM benchmark

Summary of the discussion in the
[Game-Based LLM Benchmark — Background & Proposal](https://claude.ai/artifact/WgBSUTGgSLH39KhZZxr6ko)
doc (2026-11-06). That doc is the long form, with the LinkedIn post draft; this file keeps the parts that drive design decisions.

## 1. What benchmarks do

A benchmark is a standardized test with known answers, so every model gets the same questions under the same protocol and the results can be compared across models and over time.

A run has four steps:

1. **Pick the test set.** Each set targets one capability: knowledge, math, coding, long context, tool use or safety.
2. **Fix the protocol.** Zero-shot or few-shot, reasoning on or off, number of attempts, temperature. Small changes here can move scores a lot.
3. **Score.** Exact match, execution against tests (pass@k), a judge model or humans, or human preference turned into Elo ratings.
4. **Compare.** Publish the results next to earlier and competing models.

| Category | Examples |
|---|---|
| Knowledge and reasoning | MMLU, GPQA |
| Math | GSM8K, MATH, AIME |
| Coding | HumanEval, SWE-bench |
| Agentic | Terminal, browser and tool-use environments |
| Safety | Refusals, jailbreaks, dangerous capabilities |

Known weaknesses: contamination, saturation (top models pass ~90%), optimizing for the test (Goodhart's law), protocols that differ between labs, and a gap between benchmark tasks and real use.

## 2. Contamination

Popular benchmarks get copied into repos, papers and forums, and from there into training data, sometimes as paraphrases or worked solutions.

- **GSM1k**, a fresh human-written copy of GSM8K, showed accuracy drops of up to 8% for some model families ([Zhang et al., 2024](https://arxiv.org/abs/2405.00332)).
- On dated coding sets such as LiveCodeBench, some models score much higher on problems published before their training cutoff.
- Models can sometimes complete benchmark questions word for word from a prefix.

Mitigations include private held-out sets, live benchmarks, canary strings, n-gram decontamination, separate scores for clean and possibly contaminated items, perturbation tests and independent reproduction. None of them is bulletproof.

## 3. Games as benchmarks

Games are hard to contaminate: there is no answer key, content can be generated per seed, and success depends on many decisions in a row. They don't saturate easily, and they test long-horizon planning, adapting to feedback and consistency, which are known LLM weak spots.

| | BALROG | TextArena | ARC-AGI-3 |
|---|---|---|---|
| Game type | Exploration, survival, puzzles | Board, logic, social | Abstract interactive puzzles |
| Opponent | Environment | Models or humans | Environment |
| Rules known? | Yes (often in pretraining) | Yes, explained | No, must be discovered |
| Measures | Long-horizon planning | Strategy, theory of mind | Learning novel tasks efficiently |
| Metric | % progress | TrueSkill | Efficiency vs. humans |

- **BALROG** ([paper](https://arxiv.org/abs/2411.13543)): six environments from BabyAI to NetHack. It found a "knowing-doing gap": models know the rules but don't apply them.
- **TextArena** ([paper](https://arxiv.org/abs/2504.11442)): 100+ competitive text games, rated with TrueSkill.
- **ARC-AGI-3** ([paper](https://arxiv.org/abs/2603.24621)): games with no instructions. At launch humans solved 100% and AI was near 0%.

Resource-management benchmarks, the closest to this project:

- **HeroBench** ([paper](https://arxiv.org/abs/2508.12782)): hierarchical planning and resource management in an RPG-like world.
- **AdvGameBench** ([paper](https://www.arxiv.org/pdf/2506.12012)): resource-limited tower defense, auto-battler and turn-based combat.
- **Vending-Bench** ([paper](https://arxiv.org/abs/2502.15840)): long runs in which agents derail by forgetting orders or looping.
- **Factorio Learning Environment** ([NeurIPS 2025](https://proceedings.neurips.cc/paper_files/paper/2025/hash/75f3a62e55187bc3e5e5961fa2a46bcf-Abstract-Datasets_and_Benchmarks_Track.html)): long-term planning and resource optimization.
- **TextStarCraft II** ([NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/file/f0ebc318e2df08360b2df559e81602e5-Paper-Conference.pdf)): macro strategy in text.
- **Slay the Spire / SpireBench**: LLMs fight well turn by turn but fall behind on long-term strategy, and they don't learn from experience.

## 4. The proposal: guild preparation for a final boss

The theme isn't new. What's new is a benchmark of **planning under one delayed reward, with irreversible decisions, partial information and an optimum we can compute**.

**Concept.** A text-only, turn-based game with no movement. Each turn the agent splits its resources across the options available that turn: gathering materials, collecting items, hiring warriors and equipping them. There is no undo. After a fixed number of turns the guild fights the villain, and the score is the damage dealt.

**What sets it apart**

1. **One delayed reward.** No feedback until the final battle, which tests long-horizon credit assignment. Over repeated runs it can also show whether a model learns *why* it failed.
2. **Irreversible decisions.** Tests commitment and coherence across turns, where Vending-Bench agents derailed.
3. **Computable optimum.** The game is small enough for a solver (dynamic programming or search), so we can report damage ÷ optimal damage next to random, greedy and human baselines.
4. **Original content generated per seed.** There is nothing to remember from pretraining.
5. **Partial information.** For example, paying to scout the villain's weaknesses, so the game takes judgment and not just arithmetic.

**Design risks**

- **It turns into a pure optimization puzzle.** If every rule and number is visible, a model that writes code can build a solver. We need to decide whether that's allowed. If not, add hidden information, random events and risk trade-offs.
- **The metric is noisy.** One battle has high variance, so run many seeds and report the mean and spread.
- **The battle needs calibrating.** Too deterministic and it's just arithmetic; too random and planning stops mattering.
- **The interface affects results.** How rules and actions are described changes scores (TextArena saw this), so keep the harness fixed and documented.

**Open questions**

- [ ] Are tool use and code execution allowed during play?
- [ ] How many turns, resource types and unit types still let us compute the optimum?
- [ ] Which baselines: random, greedy, solver, human?
- [ ] One episode, or several with memory carried between runs?
