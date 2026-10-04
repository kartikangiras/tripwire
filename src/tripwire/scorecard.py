"""Swarm-level oversight metrics derived from alerts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .model import Alert, Record


@dataclass
class Scorecard:
    corpus: str
    records: int
    retrievals: int
    bounded_retrievals: int
    chat_messages: int
    alerts: int
    high: int
    phantom_facts: int = 0
    human_corrected: int = 0
    agent_corrected: int = 0
    detect_lags_s: list[float] = field(default_factory=list)
    correction_lags_s: list[float] = field(default_factory=list)
    incidents: list[dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        def med(xs: list[float]) -> float | None:
            if not xs:
                return None
            ys = sorted(xs)
            mid = len(ys) // 2
            return ys[mid] if len(ys) % 2 else (ys[mid - 1] + ys[mid]) / 2

        d = {
            "corpus": self.corpus,
            "records": self.records,
            "chat_messages": self.chat_messages,
            "retrievals": self.retrievals,
            "bounded_retrievals": self.bounded_retrievals,
            "alerts": self.alerts,
            "high_severity": self.high,
            "phantom_facts": self.phantom_facts,
            "corrected_by_human": self.human_corrected,
            "corrected_by_agent": self.agent_corrected,
            # how long a bound survived before it was dropped (origin -> stripped restatement)
            "median_time_to_strip_s": med(self.detect_lags_s),
            "median_detection_lag_s": med(self.detect_lags_s),  # kept for older readers
            # how long the phantom lived (stripped restatement -> contradiction)
            "median_phantom_lifetime_s": med(self.correction_lags_s),
            "median_correction_lag_s": med(self.correction_lags_s),  # kept for older readers
            "reduction_ratio": round(self.records / self.alerts) if self.alerts else None,
            "incidents": self.incidents,
        }
        hc, ac = self.human_corrected, self.agent_corrected
        d["share_of_corrections_requiring_a_human"] = (
            round(hc / (hc + ac), 3) if (hc + ac) else None
        )
        return d


def build(corpus: str, records: list[Record], alerts: list[Alert]) -> Scorecard:
    from .model import CHAT, RETRIEVAL

    sc = Scorecard(
        corpus=corpus,
        records=len(records),
        retrievals=sum(r.surface == RETRIEVAL for r in records),
        bounded_retrievals=sum(
            r.surface == RETRIEVAL and r.scope is not None and r.scope.is_bounded
            for r in records
        ),
        chat_messages=sum(r.surface == CHAT for r in records),
        alerts=len(alerts),
        high=sum(a.severity == "high" for a in alerts),
    )
    for a in alerts:
        if "lag_seconds" in a.metrics:
            sc.detect_lags_s.append(a.metrics["lag_seconds"])
        if a.metrics.get("contradicted"):
            sc.phantom_facts += 1
            sc.correction_lags_s.append(a.metrics.get("correction_lag_seconds", 0.0))
            who = a.metrics.get("corrected_by") or ""
            if who.startswith("human:"):
                sc.human_corrected += 1
            else:
                sc.agent_corrected += 1
            sc.incidents.append({
                "claim": a.claim, "time_to_strip_s": a.metrics.get("lag_seconds"),
                "lifetime_s": a.metrics.get("correction_lag_seconds"), "corrected_by": who,
                "corrected_by_human": who.startswith("human:"), "scope": a.metrics.get("scope"),
            })
    return sc
