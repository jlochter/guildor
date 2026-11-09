// Replay verifier. Mirrors src/guildor/verify.py.

import { hashValue, canonicalJson } from "./canonical.js";
import { FORMAT, genesisHash, stepHash } from "./record.js";
import { IllegalAction, rulesetHash } from "./ruleset.js";
import { load } from "./rulesets/index.js";

/**
 * @returns {{ok: boolean, score: object|null, errors: string[], replay: Array<{turn:number, state:object, hash:string, match:boolean}>}}
 */
export function verify(record, expectedRulesetHash = null) {
  const errors = [];
  const replay = [];
  const fail = (msg) => {
    errors.push(msg);
    return { ok: false, score: null, errors, replay };
  };

  if (!record || typeof record !== "object") return fail("not a run record");
  if (record.format !== FORMAT) return fail(`unsupported format ${JSON.stringify(record.format)}`);

  const { run_hash, ...body } = record;
  try {
    if (hashValue(body) !== run_hash) errors.push("run_hash mismatch: record was edited after it was written");
  } catch (e) {
    return fail(`record is not canonical JSON: ${e.message}`);
  }

  const meta = record.ruleset ?? {};
  let rules;
  try {
    rules = load(meta.id, meta.version, meta.spec);
  } catch (e) {
    return fail(`cannot load ruleset: ${e.message}`);
  }
  if (canonicalJson(rules.spec()) !== canonicalJson(meta.spec)) return fail("ruleset spec has unknown or missing keys");
  const rHash = rulesetHash(rules);
  if (rHash !== meta.hash) errors.push("ruleset hash mismatch");
  if (expectedRulesetHash && rHash !== expectedRulesetHash) errors.push("run was not played under the expected ruleset");

  const seed = record.seed;
  if (typeof seed !== "string") return fail("seed must be a string");
  let state = rules.initialState(seed);
  let head = genesisHash(rHash, seed, state);
  if (head !== record.genesis_hash) errors.push("genesis_hash mismatch");

  const turns = Array.isArray(record.turns) ? record.turns : [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    try {
      state = rules.apply(seed, state, t.action);
    } catch (e) {
      if (e instanceof IllegalAction) return fail(`turn ${i + 1}: illegal action: ${e.message}`);
      throw e;
    }
    head = stepHash(head, t.action, state);
    const match = head === t.state_hash;
    replay.push({ turn: i + 1, action: t.action, state, hash: head, match });
    if (!match) return fail(`turn ${i + 1}: state_hash diverges from replay`);
  }

  if (!rules.isTerminal(state)) return fail("game did not reach a terminal state");
  if (head !== record.final_hash) errors.push("final_hash mismatch");
  if (canonicalJson(state) !== canonicalJson(record.final_state)) errors.push("final_state does not match replay");

  const score = rules.score(seed, state);
  if (canonicalJson(score) !== canonicalJson(record.score)) {
    errors.push(`claimed score ${JSON.stringify(record.score)} != replayed score ${JSON.stringify(score)}`);
  }
  return { ok: errors.length === 0, score, errors, replay };
}
