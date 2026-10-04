"""Recall probe for the scope-strip detector.

Precision is measured by hand-labelling what the detector fires on. Recall needs
the misses, so this runs a deliberately loose screen -- any money value stated
in a bounded retrieval's answer that reappears in any chat message within the
horizon, with no qualifier logic at all -- which is a superset of anything the
detector could flag. Candidates the detector did not flag are sampled for hand
labelling; the labelled miss rate estimates false negatives.

Ceiling: the screen only sees money values repeated verbatim. Strips of other
quantities, or paraphrased numbers, are invisible to both the screen and the
detector, and are not counted here.
"""

from __future__ import annotations

import math
import random
import re
from collections.abc import Iterable
from datetime import timedelta
from typing import Any

import orjson

from .detectors.scope_strip import MONEY, _ctx, _norm, detect, scoped_facts
from .model import CHAT, RETRIEVAL, Record

MIN_VALUE = 2.0          # $0 / $1 are noise, not claims
HORIZON = timedelta(days=21)


def _sentence(text: str, value: float) -> str:
    for m in MONEY.finditer(text):
        if _norm(m.group(1), m.group(2)) == value:
            return re.sub(r"\s+", " ", _ctx(text, m.start(), m.end())).strip()
    return ""


def screen(records: list[Record]) -> list[dict[str, Any]]:
    """Loose candidates: (bounded retrieval, value) -> first later chat mention."""
    chat = [r for r in records if r.surface == CHAT]
    out: list[dict[str, Any]] = []
    for rec in records:
        if rec.surface != RETRIEVAL or rec.scope is None or not rec.scope.is_bounded:
            continue
        vals = sorted({_norm(m.group(1), m.group(2)) for m in MONEY.finditer(rec.text)})
        vals = [v for v in vals if v >= MIN_VALUE]
        if not vals:
            continue
        bounded_vals = {f.value for f in scoped_facts(rec)}
        for v in vals:
            for c in chat:
                if c.seq <= rec.seq or c.ts < rec.ts:
                    continue
                if c.ts - rec.ts > HORIZON:
                    break
                if any(_norm(m.group(1), m.group(2)) == v for m in MONEY.finditer(c.text)):
                    out.append({
                        "value": v, "origin_id": rec.native_id, "origin_actor": rec.actor,
                        "origin_ts": rec.ts.isoformat(), "scope": rec.scope.label(),
                        "origin_has_explicit_bound": v in bounded_vals,
                        "origin_sentence": _sentence(rec.text, v),
                        "assert_id": c.native_id, "assert_actor": c.actor, "assert_ts": c.ts.isoformat(),
                        "lag_s": (c.ts - rec.ts).total_seconds(),
                        "assert_sentence": _sentence(c.text, v),
                    })
                    break
    return out


def dedupe_by_value(cands: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[float, dict[str, Any]] = {}
    for c in cands:
        cur = best.get(c["value"])
        if cur is None or c["origin_ts"] < cur["origin_ts"]:
            best[c["value"]] = c
    return sorted(best.values(), key=lambda c: c["origin_ts"])


def sample_unflagged(records: list[Record], n: int, seed: int) -> dict[str, Any]:
    flagged = {(a.metrics["value"], a.chain[0].record.native_id) for a in detect(records)}
    cands = screen(records)
    unflagged = [c for c in cands if (c["value"], c["origin_id"]) not in flagged]
    uniq = dedupe_by_value(unflagged)
    rng = random.Random(seed)
    picked = rng.sample(uniq, min(n, len(uniq)))
    picked.sort(key=lambda c: c["origin_ts"])
    return {
        "screen_candidates": len(cands), "screen_distinct_values": len(dedupe_by_value(cands)),
        "flagged_by_detector": len(flagged), "unflagged_distinct_values": len(uniq),
        "sample": picked, "seed": seed,
    }


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def estimate(labels: list[dict[str, Any]], unflagged_total: int, tp_strict: int) -> dict[str, Any]:
    """Recall from a labelled sample of unflagged candidates."""
    n = len(labels)
    k = sum(1 for x in labels if x.get("strip") is True)
    lo, hi = wilson(k, n)
    fn_est = unflagged_total * (k / n if n else 0)
    rec = tp_strict / (tp_strict + fn_est) if (tp_strict + fn_est) else None
    rec_lo = tp_strict / (tp_strict + unflagged_total * hi) if unflagged_total else None
    rec_hi = tp_strict / (tp_strict + unflagged_total * lo) if unflagged_total else None
    return {
        "sampled": n, "true_strips_in_sample": k,
        "miss_rate": k / n if n else None, "miss_rate_ci95": [lo, hi],
        "unflagged_population": unflagged_total, "estimated_false_negatives": fn_est,
        "true_positives_strict": tp_strict,
        "recall_point": rec, "recall_ci95": [rec_lo, rec_hi],
        "contradicted_in_sample": sum(1 for x in labels if x.get("contradicted") is True),
    }


def dump(obj: Any) -> bytes:
    return orjson.dumps(obj, option=orjson.OPT_INDENT_2)
