"""Leading-question corroboration detector.

A retrieval is asked to *confirm* a value the asker already believes, and the
answer affirms it. The swarm then treats that as independent verification, so a
wrong number acquires a proof trail without anyone checking the world.

This is the mechanism that let $232 survive twelve days: re-querying the same
bounded window reproduces the same answer, and asking for "the evidence trail
for $232" returns one.

No model is consulted. The verdict rests on the value appearing in the *query*
with verification framing, and the answer affirming the same value.
"""

from __future__ import annotations

import re
from datetime import timedelta

from ..adapters.base import RETRIEVAL_QUERY
from ..model import RETRIEVAL, Alert, Evidence, Record

REQUIRES = {RETRIEVAL_QUERY}
from .scope_strip import MONEY, _norm

# the asker is seeking confirmation rather than information
VERIFY_INTENT = re.compile(
    r"(verif\w*|confirm\w*|evidence|proof|prove|corroborat\w*|substantiat\w*|"
    r"double[\s-]?check|validate|back(?:s|ed)? up|support(?:ing|s)? (?:the|this|that))",
    re.IGNORECASE,
)
# the answer affirms rather than qualifies
AFFIRM = re.compile(
    r"(provides? a clear|is supported|are supported|supported by|confirms?|confirmed|"
    r"verified|corroborat\w*|clear evidence|evidence trail|yes[,.]|indeed|"
    r"independently verif\w*)",
    re.IGNORECASE,
)
# an answer that pushes back is doing its job
HEDGE = re.compile(
    r"(does not contain|no evidence|not available|cannot (?:be )?confirm|unclear|"
    r"no direct evidence|not found|unable to|contradict\w*|however, the transcript)",
    re.IGNORECASE,
)


def _values(text: str) -> set[float]:
    return {_norm(m.group(1), m.group(2)) for m in MONEY.finditer(text or "")}


def detect(
    records: list[Record], *, contradicted: dict[float, Record] | None = None,
    stats: dict[str, int] | None = None,
) -> list[Alert]:
    """Find retrievals that were asked to confirm a value, and did."""
    contradicted = contradicted or {}
    alerts: list[Alert] = []
    st = stats if stats is not None else {}
    st.update(retrievals=0, verification_intent=0, value_in_query_and_answer=0, hedged=0, affirmed=0)

    for rec in records:
        if rec.surface != RETRIEVAL or not rec.query or not rec.text:
            continue
        st["retrievals"] += 1
        if not VERIFY_INTENT.search(rec.query):
            continue
        st["verification_intent"] += 1
        shared = _values(rec.query) & _values(rec.text)
        if not shared:
            continue
        st["value_in_query_and_answer"] += 1
        if HEDGE.search(rec.text):
            st["hedged"] += 1
            continue  # the oracle qualified its answer: working as intended
        affirm = AFFIRM.search(rec.text)
        if not affirm:
            continue
        st["affirmed"] += 1

        for value in sorted(shared):
            known_wrong = value in contradicted
            alerts.append(
                Alert(
                    detector="leading_query",
                    severity="high" if known_wrong else "medium",
                    claim=f"${value:,.0f}",
                    summary=(
                        f"{rec.actor} asked the history oracle to confirm ${value:,.0f} "
                        f"and was told it is \"{affirm.group(0)}\""
                        + (" — a value later contradicted, so the swarm manufactured "
                           "a proof trail for a wrong number." if known_wrong
                           else " — confirmation of the asker's own premise.")
                    ),
                    fired_at=rec.ts,
                    chain=[
                        Evidence("corroboration", rec,
                                 f"query carried the value and asked for confirmation; "
                                 f"scope={rec.scope.label() if rec.scope else 'unbounded'}"),
                    ] + ([Evidence("correction", contradicted[value],
                                   "the value was contradicted later")] if known_wrong else []),
                    metrics={
                        "value": value,
                        "asker": rec.actor,
                        "scope": rec.scope.label() if rec.scope else "unbounded",
                        "affirmation": affirm.group(0),
                        "known_wrong": known_wrong,
                        "query": rec.query,
                    },
                )
            )
    alerts.sort(key=lambda a: a.fired_at)
    st["alerts"] = len(alerts)
    st["high"] = sum(a.severity == "high" for a in alerts)
    return alerts


def contradicted_values(scope_alerts: list[Alert]) -> dict[float, Record]:
    """Values the scope-strip pass showed were contradicted, for cross-detector tiering."""
    out: dict[float, Record] = {}
    for a in scope_alerts:
        if a.metrics.get("contradicted") and a.chain:
            out[a.metrics["value"]] = a.chain[-1].record
    return out


__all__ = ["contradicted_values", "detect", "timedelta"]
