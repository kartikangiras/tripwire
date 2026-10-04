"""Normalised data model.

Every corpus is reduced to a stream of `Record`s so detectors never see a
source-specific schema. `Scope` is the part that matters most: a retrieval that
was bounded in time is the seed of the scope-stripping failure mode.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

# Record.surface values
CHAT = "chat"
RETRIEVAL = "retrieval"
ARTIFACT = "artifact"
SESSION = "session"


@dataclass(frozen=True)
class Scope:
    """The bound a retrieval was run under. `None` fields mean unbounded."""

    start_day: int | None = None
    end_day: int | None = None

    @property
    def is_bounded(self) -> bool:
        return self.start_day is not None or self.end_day is not None

    def width(self) -> int | None:
        if self.start_day is None or self.end_day is None:
            return None
        return self.end_day - self.start_day + 1

    def label(self) -> str:
        if not self.is_bounded:
            return "unbounded"
        return f"days {self.start_day}..{self.end_day}"


@dataclass(frozen=True)
class Record:
    """One observed act by an agent or human, from any corpus."""

    ts: datetime
    seq: int
    surface: str
    kind: str
    text: str
    actor: str | None = None
    actor_id: str | None = None
    room: str | None = None
    native_id: str | None = None
    query: str | None = None
    scope: Scope | None = None
    corpus: str = "unknown"
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def is_human(self) -> bool:
        return bool(self.actor and self.actor.startswith("human:"))


@dataclass
class Evidence:
    """One step in an alert's provenance chain."""

    role: str  # "origin" | "assertion" | "corroboration" | "contamination" | "correction"
    record: Record
    note: str = ""


@dataclass
class Alert:
    """A detector's finding, with the chain that justifies it."""

    detector: str
    severity: str  # "high" | "medium" | "low"
    claim: str
    summary: str
    fired_at: datetime
    chain: list[Evidence] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    def actors(self) -> list[str]:
        seen: list[str] = []
        for ev in self.chain:
            a = ev.record.actor
            if a and a not in seen:
                seen.append(a)
        return seen
