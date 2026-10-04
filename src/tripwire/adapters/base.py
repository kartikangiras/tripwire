"""Corpus adapter registry.

A corpus is any source that can be reduced to a stream of `Record`s. Detectors
never see a source schema, so adding a corpus is an adapter, not a detector
change. What a corpus *supports* is declared, not guessed: a corpus with no
retrieval layer cannot carry a scope bound, so scope-based detectors are
reported as inapplicable rather than silently returning nothing.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from ..model import Record

# capability flags a detector can require
RETRIEVAL_SCOPE = "retrieval_scope"   # retrievals carry an explicit bound
RETRIEVAL_QUERY = "retrieval_query"   # the asker's query text is recorded
HUMAN_SPEECH = "human_speech"         # humans and agents share the record


@dataclass
class Corpus:
    name: str
    title: str
    description: str
    loader: Callable[..., list[Record]]
    indexer: Callable[..., int] | None = None
    supports: set[str] = field(default_factory=set)
    source: str = ""
    gated: bool = False
    notes: str = ""

    def info(self) -> dict[str, Any]:
        return {
            "name": self.name, "title": self.title, "description": self.description,
            "supports": sorted(self.supports), "source": self.source,
            "gated": self.gated, "notes": self.notes,
        }


_REGISTRY: dict[str, Corpus] = {}


def register(c: Corpus) -> Corpus:
    _REGISTRY[c.name] = c
    return c


def get(name: str) -> Corpus:
    if name not in _REGISTRY:
        raise KeyError(f"unknown corpus {name!r}; known: {', '.join(sorted(_REGISTRY))}")
    return _REGISTRY[name]


def all_corpora() -> list[Corpus]:
    return [_REGISTRY[k] for k in sorted(_REGISTRY)]


def applicable(detector_needs: set[str], c: Corpus) -> bool:
    return detector_needs.issubset(c.supports)
