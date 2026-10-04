"""Replay track: the life of a flagged claim, in order.

The counterfactual only reads if you can watch the claim spread. For each
confirmed phantom this collects every record that carries the value between its
origin and its correction, tagged by the role it played.
"""

from __future__ import annotations

import re
from datetime import timedelta
from typing import Any

from .detectors.scope_strip import MONEY, _norm
from .model import CHAT, RETRIEVAL, Alert, Record

# a mention that also names a durable public surface is contamination, not chatter
ARTIFACT = re.compile(
    r"(https?://[^\s)`\]]+|commit\s+`?[0-9a-f]{7,40}|\bfundraiser\.json\b)",
    re.IGNORECASE,
)

DAY1 = "2025-04-02"


def _mentions(rec: Record, value: float) -> bool:
    return any(_norm(m.group(1), m.group(2)) == value for m in MONEY.finditer(rec.text or ""))


def build_track(
    records: list[Record], alert: Alert, *, tail: timedelta = timedelta(days=2)
) -> dict[str, Any]:
    """Every record carrying the alert's value, from origin to just past correction."""
    value = alert.metrics["value"]
    origin = alert.chain[0].record
    end_rec = alert.chain[-1].record
    t0, t1 = origin.ts, end_rec.ts + tail

    roles = {e.record.native_id: e.role for e in alert.chain}
    track: list[dict[str, Any]] = []
    artifacts: set[str] = set()

    for r in records:
        if r.ts < t0 or r.ts > t1:
            continue
        if r.surface not in (CHAT, RETRIEVAL) or not _mentions(r, value):
            continue
        role = roles.get(r.native_id)
        hits = [m.group(0).lower() for m in ARTIFACT.finditer(r.text)]
        if role is None:
            if r.surface == RETRIEVAL:
                role = "requery"       # the claim was fetched again, not published
            else:
                role = "contamination" if hits else "mention"
        artifacts.update(hits)
        track.append({
            "ts": r.ts.isoformat(),
            "actor": r.actor,
            "is_human": r.is_human,
            "surface": r.surface,
            "role": role,
            "scope": r.scope.label() if r.scope else None,
            "query": r.query,
            "text": re.sub(r"[ \t]+", " ", (r.text or "").strip())[:2600],
            "artifacts": sorted(set(hits)),
        })

    track.sort(key=lambda x: x["ts"])
    return {
        "claim": alert.claim,
        "value": value,
        "window": {"start": t0.isoformat(), "end": t1.isoformat()},
        "span_days": round((end_rec.ts - t0).total_seconds() / 86400, 2),
        "detection_lag_s": alert.metrics.get("lag_seconds"),
        "artifact_surfaces": sorted(artifacts),
        "counts": {
            "records": len(track),
            "actors": len({t["actor"] for t in track}),
            "contaminations": sum(t["role"] == "contamination" for t in track),
            "requeries": sum(t["role"] == "requery" for t in track),
        },
        "track": track,
    }
