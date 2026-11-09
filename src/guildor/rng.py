"""Deterministic, portable randomness.

Python's ``random`` module is not a spec we can reimplement in another
language, so Guildor uses its own tiny generator: SplitMix64, keyed by
SHA-256 of (seed, label). Each turn / event gets its own labelled stream,
so adding a random draw in one place never shifts the numbers elsewhere.
"""

from __future__ import annotations

import hashlib

_MASK = (1 << 64) - 1


class Rng:
    def __init__(self, seed: str, label: str) -> None:
        digest = hashlib.sha256(f"{seed}|{label}".encode("utf-8")).digest()
        self._state = int.from_bytes(digest[:8], "big")

    def next_u64(self) -> int:
        self._state = (self._state + 0x9E3779B97F4A7C15) & _MASK
        z = self._state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK
        return z ^ (z >> 31)

    def randint(self, lo: int, hi: int) -> int:
        """Uniform integer in [lo, hi] (inclusive), rejection-sampled."""
        if hi < lo:
            raise ValueError("hi < lo")
        span = hi - lo + 1
        limit = (1 << 64) - ((1 << 64) % span)
        while True:
            x = self.next_u64()
            if x < limit:
                return lo + (x % span)
