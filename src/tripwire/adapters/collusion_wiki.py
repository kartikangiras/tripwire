"""collusion.wiki adapter — the Nightingale DSEWiki agent-swarm export.

A second corpus with a deliberately different shape: ~14.6k wiki revisions by
self-chosen agent handles, with no retrieval layer at all. It is here to prove
the adapter boundary is real — scope-based detectors are *declared* inapplicable
rather than quietly finding nothing.

Data (ungated): https://collusion.wiki/explorer/download/revisions.jsonl.gz
"""

from __future__ import annotations

import gzip
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import orjson

from ..model import CHAT, Record
from .base import HUMAN_SPEECH, Corpus, register

RAW = Path("data/raw/collusion")
FILE = "revisions.jsonl.gz"
URL = "https://collusion.wiki/explorer/download/revisions.jsonl.gz"


def _ts(v: Any) -> datetime | None:
    if not v:
        return None
    try:
        s = str(v).replace("Z", "+00:00").replace(" ", "T", 1)
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=UTC)
    except ValueError:
        return None


def load(raw: Path = RAW, **_: Any) -> list[Record]:
    p = raw / FILE
    if not p.exists():
        raise FileNotFoundError(
            f"{p} missing — fetch it with:\n  curl -L {URL} -o {p}\n"
            f"  (create {raw} first; the download is ungated and ~3 MB)"
        )
    out: list[Record] = []
    with gzip.open(p, "rb") as f:
        for i, line in enumerate(f):
            r = orjson.loads(line)
            ts = _ts(r.get("time"))
            if ts is None:
                continue
            label = r.get("label") or None
            # the publishers flag the handful of human moderators
            human = bool(r.get("is_human")) or (r.get("role") == "moderator")
            out.append(Record(
                ts=ts, seq=i, surface=CHAT, kind="WIKI_SAVE",
                text=r.get("body") or "",
                actor=(f"human:{label}" if human and label else label),
                room=r.get("wiki"), native_id=str(r.get("id") or f"rev-{i}"),
                corpus="collusion-wiki",
                extra={"page": r.get("page"), "ip16": r.get("ip16")},
            ))
    out.sort(key=lambda r: (r.ts, r.seq))
    return out


register(Corpus(
    name="collusion-wiki",
    title="collusion.wiki (DSEWiki)",
    description="~14.6k wiki revisions from the 2026 OpenAI agent-swarm incident.",
    loader=load,
    supports={HUMAN_SPEECH},
    source="Nightingale Collective · ungated",
    notes="No retrieval layer, so scope-based detectors do not apply here.",
))
