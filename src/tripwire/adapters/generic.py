"""Generic JSONL adapter — bring your own corpus.

Point it at a JSONL file and a field map; it yields Records. This is the escape
hatch that keeps Tripwire from being an AI-Village-specific script:

    tripwire scan --corpus generic \\
        --path mydata.jsonl --map mymap.json

A map is JSON, with dotted paths into each row:

    {"ts": "created_at", "actor": "agent.name", "text": "content",
     "surface": "chat", "query": "request.query",
     "scope_start": "request.from_day", "scope_end": "request.to_day",
     "human_prefix": "user:"}
"""

from __future__ import annotations

import gzip
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ..model import CHAT, RETRIEVAL, Record, Scope
from .base import HUMAN_SPEECH, RETRIEVAL_QUERY, RETRIEVAL_SCOPE, Corpus, register

DEFAULT_MAP = {
    "ts": "timestamp", "actor": "actor", "text": "text",
    "surface": "surface", "query": "query",
    "scope_start": "scope_start", "scope_end": "scope_end",
}


def _dig(row: dict[str, Any], path: str | None) -> Any:
    if not path:
        return None
    cur: Any = row
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _ts(v: Any) -> datetime:
    if isinstance(v, int | float):
        return datetime.fromtimestamp(float(v), tz=UTC)
    s = str(v).replace("Z", "+00:00")
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def load(path: str | Path, mapping: dict[str, str] | None = None, **_: Any) -> list[Record]:
    m = {**DEFAULT_MAP, **(mapping or {})}
    p = Path(path)
    opener = gzip.open if p.suffix == ".gz" else open
    out: list[Record] = []
    with opener(p, "rt") as f:  # type: ignore[operator]
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            surface = _dig(row, m.get("surface")) or CHAT
            if surface not in (CHAT, RETRIEVAL):
                surface = CHAT
            s0, s1 = _dig(row, m.get("scope_start")), _dig(row, m.get("scope_end"))
            out.append(Record(
                ts=_ts(_dig(row, m["ts"])), seq=i, surface=surface,
                kind=str(_dig(row, m.get("kind")) or surface.upper()),
                text=str(_dig(row, m["text"]) or ""),
                actor=(str(_dig(row, m["actor"])) if _dig(row, m["actor"]) is not None else None),
                query=(str(_dig(row, m.get("query"))) if _dig(row, m.get("query")) else None),
                scope=Scope(s0, s1) if (s0 is not None or s1 is not None) else None,
                native_id=str(_dig(row, m.get("id")) or f"row-{i}"),
                corpus="generic",
            ))
    out.sort(key=lambda r: (r.ts, r.seq))
    return out


register(Corpus(
    name="generic",
    title="Custom JSONL",
    description="Any newline-delimited JSON corpus, mapped to Tripwire's record model.",
    loader=load,
    supports={RETRIEVAL_SCOPE, RETRIEVAL_QUERY, HUMAN_SPEECH},
    source="your file",
    notes="Capabilities depend on what your field map provides.",
))
