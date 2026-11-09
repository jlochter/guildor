"""The contract every ruleset implements.

A ruleset is a *pure, deterministic* function of (seed, state, action).
No clocks, no I/O, no floats, no global randomness: everything random is
drawn from ``Rng(seed, label)``. That is what makes replay verification
possible.
"""

from __future__ import annotations

from typing import Any, Protocol

from .canonical import hash_value

State = dict[str, Any]
Action = dict[str, Any]


class IllegalAction(ValueError):
    pass


class Ruleset(Protocol):
    id: str
    #: Bump on ANY change to rule code. Old runs must keep verifying
    #: against the old version, so keep old versions importable.
    version: str

    def spec(self) -> dict[str, Any]:
        """All tunable constants. Hashed into every run record."""
        ...

    def initial_state(self, seed: str) -> State: ...

    def observe(self, state: State) -> dict[str, Any]:
        """What the player is allowed to see (may hide parts of state)."""
        ...

    def apply(self, seed: str, state: State, action: Action) -> State:
        """Return the next state. Raise IllegalAction on invalid input."""
        ...

    def is_terminal(self, state: State) -> bool: ...

    def score(self, seed: str, state: State) -> dict[str, int]:
        """Score of a terminal state, integers only."""
        ...


def ruleset_hash(rules: Ruleset) -> str:
    return hash_value({"id": rules.id, "version": rules.version, "spec": rules.spec()})
