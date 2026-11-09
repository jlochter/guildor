// Session + hash-chained run record. Mirrors src/guildor/record.py.

import { hashValue } from "./canonical.js";
import { rulesetHash } from "./ruleset.js";

export const FORMAT = "guildor.run/1";

const clone = (v) => JSON.parse(JSON.stringify(v));

export const genesisHash = (rHash, seed, state) => hashValue({ ruleset: rHash, seed, state });
export const stepHash = (prev, action, state) => hashValue({ prev, action, state });

export class Session {
  constructor(rules, seed) {
    this.rules = rules;
    this.seed = seed;
    this.rHash = rulesetHash(rules);
    this.state = rules.initialState(seed);
    this.head = genesisHash(this.rHash, seed, this.state);
    this.genesis = this.head;
    this.turns = [];
  }

  get done() {
    return this.rules.isTerminal(this.state);
  }

  observe() {
    return this.rules.observe(clone(this.state));
  }

  step(action) {
    action = clone(action);
    this.state = this.rules.apply(this.seed, this.state, action);
    this.head = stepHash(this.head, action, this.state);
    this.turns.push({ turn: this.state.turn, action, state_hash: this.head });
    return this.state;
  }

  record() {
    if (!this.done) throw new Error("game not finished");
    const body = {
      format: FORMAT,
      ruleset: { id: this.rules.id, version: this.rules.version, spec: this.rules.spec(), hash: this.rHash },
      seed: this.seed,
      genesis_hash: this.genesis,
      turns: clone(this.turns),
      final_hash: this.head,
      final_state: clone(this.state),
      score: this.rules.score(this.seed, this.state),
    };
    return { ...body, run_hash: hashValue(body) };
  }
}

export function play(rules, seed, actions) {
  const s = new Session(rules, seed);
  for (const a of actions) s.step(a);
  return s.record();
}
