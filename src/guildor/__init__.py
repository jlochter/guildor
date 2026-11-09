"""Guildor: a turn-based guild-management game used as an LLM benchmark."""

from .record import Session, play
from .verify import verify

__all__ = ["Session", "play", "verify"]
