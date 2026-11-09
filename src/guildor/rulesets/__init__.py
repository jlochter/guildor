"""Registry of rulesets by (id, version), so old run records stay verifiable."""

from __future__ import annotations

from ..ruleset import Ruleset
from .sandbox import Sandbox

_REGISTRY: dict[tuple[str, str], type] = {
    (Sandbox.id, Sandbox.version): Sandbox,
}


def load(rules_id: str, version: str, spec: dict | None = None) -> Ruleset:
    try:
        cls = _REGISTRY[(rules_id, version)]
    except KeyError:
        raise KeyError(f"unknown ruleset {rules_id}@{version}") from None
    return cls(**(spec or {}))
