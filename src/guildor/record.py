"""Playing a game and producing a tamper-evident run record.

Hash chain (see docs/verification.md):

    h0 = H({ruleset: R, seed, state: s0})
    ht = H({prev: h(t-1), action: a_t, state: s_t})

The record stores the seed, every action and every ht. Score is stored
for convenience but is never trusted: a verifier recomputes everything.
"""

from __future__ import annotations

import copy
from typing import Any, Iterable

from .canonical import hash_value
from .ruleset import Action, Ruleset, State, ruleset_hash

FORMAT = "guildor.run/1"


def genesis_hash(r_hash: str, seed: str, state: State) -> str:
    return hash_value({"ruleset": r_hash, "seed": seed, "state": state})


def step_hash(prev: str, action: Action, state: State) -> str:
    return hash_value({"prev": prev, "action": action, "state": state})


class Session:
    """One game in progress. The harness drives it turn by turn."""

    def __init__(self, rules: Ruleset, seed: str) -> None:
        self.rules = rules
        self.seed = seed
        self.r_hash = ruleset_hash(rules)
        self.state = rules.initial_state(seed)
        self.head = genesis_hash(self.r_hash, seed, self.state)
        self._genesis = self.head
        self._turns: list[dict[str, Any]] = []

    @property
    def done(self) -> bool:
        return self.rules.is_terminal(self.state)

    def observe(self) -> dict[str, Any]:
        return self.rules.observe(copy.deepcopy(self.state))

    def step(self, action: Action) -> State:
        action = copy.deepcopy(action)
        self.state = self.rules.apply(self.seed, self.state, action)
        self.head = step_hash(self.head, action, self.state)
        self._turns.append(
            {"turn": self.state["turn"], "action": action, "state_hash": self.head}
        )
        return self.state

    def record(self) -> dict[str, Any]:
        if not self.done:
            raise RuntimeError("game not finished")
        body = {
            "format": FORMAT,
            "ruleset": {
                "id": self.rules.id,
                "version": self.rules.version,
                "spec": self.rules.spec(),
                "hash": self.r_hash,
            },
            "seed": self.seed,
            "genesis_hash": self._genesis,
            "turns": copy.deepcopy(self._turns),
            "final_hash": self.head,
            "final_state": copy.deepcopy(self.state),
            "score": self.rules.score(self.seed, self.state),
        }
        return {**body, "run_hash": hash_value(body)}


def play(rules: Ruleset, seed: str, actions: Iterable[Action]) -> dict[str, Any]:
    s = Session(rules, seed)
    for a in actions:
        s.step(a)
    return s.record()
