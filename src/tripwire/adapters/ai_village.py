"""AI Village adapter: events.jsonl.gz -> normalised Record stream.

`events` alone carries chat, human speech and retrievals, plus `event_index`,
which the schema documents as the canonical ordering. That makes it a better
spine than joining chat_messages, and it keeps one pass over one file.
"""

from __future__ import annotations

import gzip
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import orjson

from ..model import CHAT, RETRIEVAL, Record, Scope
from .base import HUMAN_SPEECH, RETRIEVAL_QUERY, RETRIEVAL_SCOPE, Corpus, register

CORPUS = "ai-village"
RAW = Path("data/raw")
CACHE = Path("data/interim/ai_village_records.jsonl.gz")

# event actionTypes we normalise; everything else is ignored by these detectors
_KINDS = {"AGENT_TALK", "USER_TALK", "SEARCH_HISTORY"}


def _ts(raw: str) -> datetime:
    """'2026-04-02 17:02:36.637324' (UTC, no suffix) -> aware datetime."""
    return datetime.fromisoformat(raw).replace(tzinfo=UTC)


def agent_names(raw: Path = RAW) -> dict[str, str]:
    out: dict[str, str] = {}
    with gzip.open(raw / "agents.jsonl.gz", "rb") as f:
        for line in f:
            a = orjson.loads(line)
            out[a["id"]] = a["name"]
    return out


def stream_events(raw: Path = RAW) -> Iterator[Record]:
    """One pass over events.jsonl.gz, yielding normalised Records."""
    names = agent_names(raw)
    with gzip.open(raw / "events.jsonl.gz", "rb") as f:
        for line in f:
            e = orjson.loads(line)
            d = e.get("data") or {}
            kind = d.get("actionType")
            if kind not in _KINDS:
                continue
            seq = e.get("event_index") or 0
            ts = _ts(e["created_at"])

            if kind == "AGENT_TALK":
                aid = d.get("speakerId")
                yield Record(
                    ts=ts, seq=seq, surface=CHAT, kind=kind,
                    text=d.get("content") or "",
                    actor=names.get(aid, aid), actor_id=aid,
                    room=d.get("roomId"), native_id=d.get("messageId") or e["id"],
                    corpus=CORPUS,
                )
            elif kind == "USER_TALK":
                who = d.get("speakerName") or "unknown"
                yield Record(
                    ts=ts, seq=seq, surface=CHAT, kind=kind,
                    text=d.get("content") or "",
                    actor=f"human:{who}", room=d.get("roomId"),
                    native_id=d.get("messageId") or e["id"], corpus=CORPUS,
                )
            else:  # SEARCH_HISTORY
                aid = d.get("agentId")
                yield Record(
                    ts=ts, seq=seq, surface=RETRIEVAL, kind=kind,
                    text=d.get("answerToQuery") or "",
                    query=d.get("query") or "",
                    scope=Scope(d.get("startDay"), d.get("endDay")),
                    actor=names.get(aid, aid), actor_id=aid,
                    native_id=e["id"], corpus=CORPUS,
                )


def _encode(r: Record) -> bytes:
    return orjson.dumps({
        "ts": r.ts.isoformat(), "seq": r.seq, "surface": r.surface, "kind": r.kind,
        "text": r.text, "actor": r.actor, "actor_id": r.actor_id, "room": r.room,
        "native_id": r.native_id, "query": r.query,
        "scope": None if r.scope is None else [r.scope.start_day, r.scope.end_day],
        "corpus": r.corpus,
    }) + b"\n"


def _decode(line: bytes) -> Record:
    o = orjson.loads(line)
    sc = o.get("scope")
    return Record(
        ts=datetime.fromisoformat(o["ts"]), seq=o["seq"], surface=o["surface"],
        kind=o["kind"], text=o["text"], actor=o.get("actor"), actor_id=o.get("actor_id"),
        room=o.get("room"), native_id=o.get("native_id"), query=o.get("query"),
        scope=None if sc is None else Scope(sc[0], sc[1]), corpus=o["corpus"],
    )


def build_cache(raw: Path = RAW, cache: Path = CACHE) -> int:
    """Extract the records detectors need into a compact cache (one slow pass)."""
    cache.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with gzip.open(cache, "wb") as out:
        for r in stream_events(raw):
            out.write(_encode(r))
            n += 1
    return n


def load(cache: Path = CACHE) -> list[Record]:
    """Read the cache, sorted by canonical order."""
    if not cache.exists():
        raise FileNotFoundError(f"{cache} missing — run `tripwire index` first")
    with gzip.open(cache, "rb") as f:
        recs = [_decode(line) for line in f]
    recs.sort(key=lambda r: (r.seq, r.ts))
    return recs


register(Corpus(
    name="ai-village",
    title="AI Village",
    description=(
        "46 frontier agents living together on weekday shifts since April 2025 — "
        "chat, human speech, and 10.8k history-oracle calls."
    ),
    loader=lambda **kw: load(),
    indexer=lambda **kw: build_cache(),
    supports={RETRIEVAL_SCOPE, RETRIEVAL_QUERY, HUMAN_SPEECH},
    source="AI Digest · gated, request access on Hugging Face",
    gated=True,
    notes="The default corpus. Run `tripwire index` once before scanning.",
))
