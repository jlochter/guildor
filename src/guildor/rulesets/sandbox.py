"""Placeholder ruleset used to exercise the engine and the verifier.

NOT the real game. It only exists so the record/replay/verify pipeline
has something concrete to run against while the actual design is worked
out in docs/game-design.md.

Rules:
* Each turn you get ``energy`` points and split them across
  gather / hire / craft (non-negative ints summing to ``energy``).
* hire: each point hires one warrior for ``hire_cost`` materials.
* craft: each point makes one piece of gear for ``craft_cost`` materials.
  Hire is resolved before craft; points you can't afford are wasted.
* gather: each point yields ``yield`` materials, where ``yield`` is drawn
  per turn from the seed and shown in advance. Gathered materials arrive
  NEXT turn (the fixed "this turn feeds the next" rule).
* After ``turns`` turns the guild fights the boss:
  damage = warriors * warrior_dmg + min(gear, warriors) * gear_dmg.
"""

from __future__ import annotations

from typing import Any

from ..rng import Rng
from ..ruleset import Action, IllegalAction, State

ALLOC_KEYS = ("gather", "hire", "craft")


class Sandbox:
    id = "guildor.sandbox"
    version = "0.1.0"

    def __init__(self, **overrides: int) -> None:
        self._spec = {
            "turns": 5,
            "energy": 6,
            "start_materials": 4,
            "yield_min": 1,
            "yield_max": 3,
            "hire_cost": 2,
            "craft_cost": 3,
            "warrior_dmg": 2,
            "gear_dmg": 3,
        }
        unknown = set(overrides) - set(self._spec)
        if unknown:
            raise TypeError(f"unknown spec keys: {sorted(unknown)}")
        self._spec.update(overrides)

    def spec(self) -> dict[str, Any]:
        return dict(self._spec)

    def _yield(self, seed: str, turn: int) -> int:
        s = self._spec
        return Rng(seed, f"yield/{turn}").randint(s["yield_min"], s["yield_max"])

    def initial_state(self, seed: str) -> State:
        return {
            "turn": 0,
            "materials": self._spec["start_materials"],
            "incoming": 0,
            "warriors": 0,
            "gear": 0,
            "yield": self._yield(seed, 0),
        }

    def observe(self, state: State) -> dict[str, Any]:
        return {**state, "turns_left": self._spec["turns"] - state["turn"], "energy": self._spec["energy"]}

    def apply(self, seed: str, state: State, action: Action) -> State:
        s = self._spec
        if self.is_terminal(state):
            raise IllegalAction("game is over")
        if set(action) != set(ALLOC_KEYS):
            raise IllegalAction(f"action must have exactly keys {ALLOC_KEYS}")
        for k in ALLOC_KEYS:
            v = action[k]
            if not isinstance(v, int) or isinstance(v, bool) or v < 0:
                raise IllegalAction(f"{k} must be a non-negative int")
        if sum(action[k] for k in ALLOC_KEYS) != s["energy"]:
            raise IllegalAction(f"allocation must sum to {s['energy']}")

        mats = state["materials"]
        hired = min(action["hire"], mats // s["hire_cost"])
        mats -= hired * s["hire_cost"]
        crafted = min(action["craft"], mats // s["craft_cost"])
        mats -= crafted * s["craft_cost"]

        turn = state["turn"] + 1
        return {
            "turn": turn,
            "materials": mats + state["incoming"],
            "incoming": action["gather"] * state["yield"],
            "warriors": state["warriors"] + hired,
            "gear": state["gear"] + crafted,
            "yield": self._yield(seed, turn),
        }

    def is_terminal(self, state: State) -> bool:
        return state["turn"] >= self._spec["turns"]

    def score(self, seed: str, state: State) -> dict[str, int]:
        s = self._spec
        w, g = state["warriors"], state["gear"]
        return {"damage": w * s["warrior_dmg"] + min(g, w) * s["gear_dmg"]}

    # Compact form for share links: [gather, hire, craft].
    def pack_action(self, action: Action) -> list[int]:
        return [action[k] for k in ALLOC_KEYS]

    def unpack_action(self, packed: Any) -> Action:
        if not isinstance(packed, list) or len(packed) != len(ALLOC_KEYS):
            raise IllegalAction("packed action must be [gather, hire, craft]")
        return dict(zip(ALLOC_KEYS, packed))
