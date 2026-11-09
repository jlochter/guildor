"""Canonical JSON encoding and hashing.

Every hash in Guildor is SHA-256 over the *canonical* JSON form of a value:

* keys sorted, no insignificant whitespace, UTF-8, no ASCII escaping
* only dicts (string keys), lists, strings, ints, bools and null
* floats are rejected: all game math is integer math, so two
  implementations (or two machines) can never disagree on rounding
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


class CanonicalError(TypeError):
    pass


def _check(value: Any, path: str = "$") -> None:
    if value is None or isinstance(value, (bool, str)):
        return
    if isinstance(value, int):
        return
    if isinstance(value, float):
        raise CanonicalError(f"float at {path}: use integers (e.g. basis points)")
    if isinstance(value, list):
        for i, item in enumerate(value):
            _check(item, f"{path}[{i}]")
        return
    if isinstance(value, dict):
        for k, v in value.items():
            if not isinstance(k, str):
                raise CanonicalError(f"non-string key at {path}: {k!r}")
            _check(v, f"{path}.{k}")
        return
    raise CanonicalError(f"unsupported type at {path}: {type(value).__name__}")


def canonical_bytes(value: Any) -> bytes:
    _check(value)
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_value(value: Any) -> str:
    """SHA-256 of the canonical JSON of ``value``, prefixed for readability."""
    return "sha256:" + sha256_hex(canonical_bytes(value))
