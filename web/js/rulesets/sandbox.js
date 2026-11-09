// PLACEHOLDER rules. Line-for-line port of src/guildor/rulesets/sandbox.py;
// any change here must be made there too (tests/vectors enforce it).

import { Rng } from "../rng.js";
import { IllegalAction } from "../ruleset.js";

export const ALLOC_KEYS = ["gather", "hire", "craft"];

const DEFAULT_SPEC = {
  turns: 5,
  energy: 6,
  start_materials: 4,
  yield_min: 1,
  yield_max: 3,
  hire_cost: 2,
  craft_cost: 3,
  warrior_dmg: 2,
  gear_dmg: 3,
};

export class Sandbox {
  static id = "guildor.sandbox";
  static version = "0.1.0";

  constructor(overrides = {}) {
    const unknown = Object.keys(overrides).filter((k) => !(k in DEFAULT_SPEC));
    if (unknown.length) throw new TypeError(`unknown spec keys: ${unknown.sort()}`);
    this.id = Sandbox.id;
    this.version = Sandbox.version;
    this._spec = { ...DEFAULT_SPEC, ...overrides };
  }

  spec() {
    return { ...this._spec };
  }

  _yield(seed, turn) {
    const s = this._spec;
    return new Rng(seed, `yield/${turn}`).randint(s.yield_min, s.yield_max);
  }

  initialState(seed) {
    return {
      turn: 0,
      materials: this._spec.start_materials,
      incoming: 0,
      warriors: 0,
      gear: 0,
      yield: this._yield(seed, 0),
    };
  }

  observe(state) {
    return { ...state, turns_left: this._spec.turns - state.turn, energy: this._spec.energy };
  }

  /** Validate and resolve hire/craft against current materials (shared by apply and the UI preview). */
  resolve(state, action) {
    const s = this._spec;
    let mats = state.materials;
    const hired = Math.min(action.hire, Math.floor(mats / s.hire_cost));
    mats -= hired * s.hire_cost;
    const crafted = Math.min(action.craft, Math.floor(mats / s.craft_cost));
    mats -= crafted * s.craft_cost;
    return { hired, crafted, materialsLeft: mats, gathered: action.gather * state.yield };
  }

  apply(seed, state, action) {
    const s = this._spec;
    if (this.isTerminal(state)) throw new IllegalAction("game is over");
    if (action === null || typeof action !== "object" || Array.isArray(action)) {
      throw new IllegalAction("action must be an object");
    }
    const keys = Object.keys(action).sort();
    if (keys.join() !== [...ALLOC_KEYS].sort().join()) {
      throw new IllegalAction(`action must have exactly keys ${ALLOC_KEYS}`);
    }
    for (const k of ALLOC_KEYS) {
      const v = action[k];
      if (!Number.isSafeInteger(v) || v < 0) throw new IllegalAction(`${k} must be a non-negative int`);
    }
    if (ALLOC_KEYS.reduce((t, k) => t + action[k], 0) !== s.energy) {
      throw new IllegalAction(`allocation must sum to ${s.energy}`);
    }

    const r = this.resolve(state, action);
    const turn = state.turn + 1;
    return {
      turn,
      materials: r.materialsLeft + state.incoming,
      incoming: r.gathered,
      warriors: state.warriors + r.hired,
      gear: state.gear + r.crafted,
      yield: this._yield(seed, turn),
    };
  }

  isTerminal(state) {
    return state.turn >= this._spec.turns;
  }

  score(seed, state) {
    const s = this._spec;
    const w = state.warriors, g = state.gear;
    return { damage: w * s.warrior_dmg + Math.min(g, w) * s.gear_dmg };
  }

  // Compact form for share links: [gather, hire, craft].
  packAction(a) {
    return ALLOC_KEYS.map((k) => a[k]);
  }

  unpackAction(arr) {
    if (!Array.isArray(arr) || arr.length !== ALLOC_KEYS.length) {
      throw new IllegalAction("packed action must be [gather, hire, craft]");
    }
    return Object.fromEntries(ALLOC_KEYS.map((k, i) => [k, arr[i]]));
  }
}
