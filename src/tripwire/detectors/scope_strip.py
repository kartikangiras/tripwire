"""Scope-stripping detector.

The failure mode: a retrieval is run under a bound (`days 1..5`), the answer
states a value *with* that bound ("by the end of Day 5 ... $232"), and a later
assertion repeats the value with the bound removed ("last year ... $232").

The retrieval was never wrong. The bound was dropped in the retelling, which
turns a window measurement into a historical fact. No model is consulted: the
verdict rests on the retrieval's own scope metadata and on surface qualifiers,
so every alert is reproducible and can be checked by hand.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from ..adapters.base import RETRIEVAL_SCOPE
from ..model import CHAT, RETRIEVAL, Alert, Evidence, Record

# a corpus without a bounded retrieval layer cannot exhibit this failure mode
REQUIRES = {RETRIEVAL_SCOPE}

MONEY = re.compile(r"\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\+?\s?(thousand|million|billion|trillion|[kKmMbBtT])?\b", re.IGNORECASE)
# a period a bound can name. Corpus-agnostic on purpose: the AI Village counts
# days, but a quarter, a month or a year bounds a claim exactly the same way.
PERIOD = (
    r"(?:day\s*\.?\s*\d{1,4}|week\s*\d+|month\s*\d+|q[1-4]\b|h[12]\b|"
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|"
    r"(?:19|20)\d{2}|\d{4}-\d{2}(?:-\d{2})?)"
)
DAY_REF = re.compile(PERIOD, re.IGNORECASE)

# a value stated with one of these nearby is explicitly bounded in the answer
# a bound either names a period ("by the end of Day 5", "as of January") or is
# self-evidently partial ("so far", "to date")
BOUND_QUAL = re.compile(
    r"((?:by the end of|as of|by|on|through|during|up to|until|at the close of)\s+"
    + PERIOD + r"|so far|to date|at that point|at the time|as of then)",
    re.IGNORECASE,
)
# a value stated with one of these is being presented as a whole-period total
UNBOUND_QUAL = re.compile(
    r"(last year|previous year|year[\s\-]?(?:1|one)|prior year|"
    r"in total|total raised|overall|all[\s\-]time|(?:final |grand )?(?:combined )?total|"
    r"benchmark|baseline|record|"
    # an era or a whole campaign is a whole-period framing too (found by the recall census)
    r"origin era|founding era|first era|(?:during|in|over) (?:our|the|its) first|"
    r"(?:the )?(?:whole|entire|full) (?:campaign|drive|run|project|season)|"
    r"first (?:coordinated )?(?:charity )?(?:drive|campaign|fundraiser))",
    re.IGNORECASE,
)

# a value must be a *measurement* to be a scoped fact at all. This rejects
# numbers that live in titles ("Kira $170 a Month thread") or identifiers.
MEASURE_QUAL = re.compile(
    r"(raised|raising|total|totall?ing|profit|donat|collected|earned|reached|"
    r"brought in|received|funded|sum)",
    re.IGNORECASE,
)
# a delta is not a level: "need $27 to match last year" is not a claim that
# last year's total was $27.
DIFF_QUAL = re.compile(
    r"(gap|need|needs|short|to match|difference|away from|behind|"
    r"up from|down from|more than|less than|above|below|\bplus\b|\bminus\b)",
    re.IGNORECASE,
)
# an agent repairing a stale number is not asserting it
FIX_QUAL = re.compile(
    r"(stale|patched|patch|inconsisten|outdated|out of date|superseded|"
    r"incorrect|was already|no longer|fixed|correcting|correction)",
    re.IGNORECASE,
)
# serialised event payloads leak into some oracle answers; they are not prose
_JSON_NOISE = re.compile(r'("answerToQuery"|"endDay"|"actionType"|"output":|\\n)')

# agents often write history as a markdown table whose day bound lives in the
# header row, so neither the sentence nor the value's own line carries it
_TABLE_DAY_HEADER = re.compile(r"^\s*\|.*\bdays?\b.*\|\s*$", re.IGNORECASE | re.MULTILINE)
_DAY_RANGE = re.compile(r"\b\d{1,4}\s*[-\u2013]\s*\d{1,4}\b")


_DAY_LEVEL = re.compile(r"\bday\s*\.?\s*\d{1,4}\b|\bweek\s*\d+\b|\d{4}-\d{2}-\d{2}", re.IGNORECASE)


def _bound_preserved(text: str, ctx: str, line: str) -> bool:
    """True if a bound at least as tight as the origin's still applies to the value.

    A bare month or year ("Origin Era (Apr 2025)") is *wider* than a day-scoped
    retrieval window, so it does not preserve the bound -- it is how the bound
    gets laundered into an era total. Only a day-level reference or an explicit
    bounding phrase ("by the end of", "as of", "so far") counts.
    """
    if _DAY_LEVEL.search(ctx) or _DAY_LEVEL.search(line):
        return True
    if BOUND_QUAL.search(ctx):
        return True
    # a table row under a Day/Days column header keeps its bound in the header
    return bool(
        line.lstrip().startswith("|")
        and _DAY_RANGE.search(line)
        and _TABLE_DAY_HEADER.search(text)
    )

# a completed outcome ("final results: Opus 1st ($126)") is not a running
# measurement; restating it without the day widens nothing
FINAL_QUAL = re.compile(r"\b(final|final results?|completed|concluded|ended|won|winner|closed at)\b", re.IGNORECASE)

# a value framed as an aspiration is not a measurement, so never a scoped fact
GOAL_QUAL = re.compile(r"(goal|target|aim(?:ing)?|stretch|objective|hope to|we want)", re.IGNORECASE)

_SENT = re.compile(r"(?<=[.!?\n])\s+")
NEAR = 220  # fallback window when a sentence cannot be isolated


_MAG = {"k": 1e3, "thousand": 1e3, "m": 1e6, "million": 1e6, "b": 1e9, "billion": 1e9, "t": 1e12, "trillion": 1e12}


def _norm(tok: str, suffix: str | None = None) -> float:
    v = float(tok.replace(",", ""))
    if suffix:
        v *= _MAG.get(suffix.lower(), 1.0)
    return v


def _ctx(text: str, start: int, end: int) -> str:
    """The sentence containing [start,end).

    Sentence scope is what keeps a qualifier from attaching to a number it does
    not belong to: "$3,500 goal" and "By the end of Day 5 ... $232" sit in one
    paragraph, and a fixed character window conflates them.
    """
    left = 0
    for m in _SENT.finditer(text, 0, start):
        left = m.end()
    right = len(text)
    m = _SENT.search(text, end)
    if m:
        right = m.start()
    if right - left > 4 * NEAR:  # runaway sentence: fall back to a window
        left, right = max(left, start - NEAR), min(right, end + NEAR)
    return text[left:right]


def _nearest_value_span(ctx: str, qual_span: tuple[int, int]) -> tuple[int, int] | None:
    """The money span in `ctx` closest to `qual_span`.

    A qualifier binds to the number nearest it. Without this rule a single
    sentence defeats the detector in both directions: "raised $232 ... against a
    $3,500 goal" would have "goal" suppress $232, and "$280, $48 above last
    year's $232 benchmark" would have "benchmark" promote $280.
    """
    qs, qe = qual_span
    best: tuple[int, int] | None = None
    best_d = 10**9
    for m in MONEY.finditer(ctx):
        d = qs - m.end() if m.end() <= qs else (m.start() - qe if m.start() >= qe else 0)
        if d < best_d:
            best_d, best = d, (m.start(), m.end())
    return best


def _binds(ctx: str, qual_span: tuple[int, int], value: float) -> bool:
    """True if the qualifier at `qual_span` binds to an occurrence of `value`."""
    span = _nearest_value_span(ctx, qual_span)
    if span is None:
        return False
    tok = MONEY.match(ctx, span[0])
    return tok is not None and _norm(tok.group(1), tok.group(2)) == value


@dataclass(frozen=True)
class ScopedFact:
    """A value that a bounded retrieval stated together with its bound."""

    value: float
    qualifier: str
    context: str
    record: Record


def scoped_facts(rec: Record) -> list[ScopedFact]:
    """Values in a bounded retrieval's answer that carry an explicit bound."""
    if rec.surface != RETRIEVAL or rec.scope is None or not rec.scope.is_bounded:
        return []
    if _JSON_NOISE.search(rec.text):
        return []  # the "answer" is a serialised payload, not an assertion
    out: list[ScopedFact] = []
    seen: set[float] = set()
    for m in MONEY.finditer(rec.text):
        val = _norm(m.group(1), m.group(2))
        if val in seen:
            continue
        ctx = _ctx(rec.text, m.start(), m.end())
        if any(_binds(ctx, g.span(), val) for g in GOAL_QUAL.finditer(ctx)):
            continue  # this number is the aspiration, not a measurement
        if any(_binds(ctx, d.span(), val) for d in DIFF_QUAL.finditer(ctx)):
            continue  # a delta, not a level
        if any(_binds(ctx, f.span(), val) for f in FINAL_QUAL.finditer(ctx)):
            continue  # a settled outcome, not a window measurement
        if not any(_binds(ctx, mq.span(), val) for mq in MEASURE_QUAL.finditer(ctx)):
            continue  # not a measured quantity (title, id, incidental number)
        q = next((b for b in BOUND_QUAL.finditer(ctx) if _binds(ctx, b.span(), val)), None)
        if q is None:
            continue
        qual = re.sub(r"\s+", " ", q.group(0)).strip()
        seen.add(val)
        out.append(ScopedFact(val, qual, re.sub(r"\s+", " ", ctx).strip(), rec))
    return out


def is_stripped_assertion(rec: Record, value: float) -> tuple[bool, str]:
    """True if `rec` asserts `value` as a whole-period fact with no day bound."""
    if rec.surface != CHAT or not rec.text:
        return False, ""
    for m in MONEY.finditer(rec.text):
        if _norm(m.group(1), m.group(2)) != value:
            continue
        ctx = _ctx(rec.text, m.start(), m.end())
        line_start = rec.text.rfind("\n", 0, m.start()) + 1
        line_end = rec.text.find("\n", m.end())
        line = rec.text[line_start : line_end if line_end != -1 else len(rec.text)]
        if _bound_preserved(rec.text, ctx, line):
            continue                     # bound preserved (prose, line or table header)
        if any(_binds(ctx, g.span(), value) for g in GOAL_QUAL.finditer(ctx)):
            continue                     # an aspiration, not a claim about the past
        if any(_binds(ctx, d.span(), value) for d in DIFF_QUAL.finditer(ctx)):
            continue                     # a gap or a change, not a level
        # repair language counts only near the value: a long message can mention a
        # fix three sections away while plainly asserting this number
        near = rec.text[max(0, m.start() - NEAR) : m.end() + NEAR]
        if FIX_QUAL.search(near):
            continue                     # the message repairs this number, not asserts it
        if not any(_binds(ctx, mq.span(), value) for mq in MEASURE_QUAL.finditer(ctx)):
            continue                     # not asserted as a measured quantity
        u = next((x for x in UNBOUND_QUAL.finditer(ctx) if _binds(ctx, x.span(), value)), None)
        if u is not None:
            return True, u.group(0)
    return False, ""


def _values_bound_to(text: str, phrase: re.Pattern[str]) -> list[float]:
    """Every money value that `phrase` binds to in `text`, by nearest-number rule."""
    out: list[float] = []
    for m in phrase.finditer(text):
        ctx_start = text.rfind(". ", 0, m.start()) + 2
        ctx_end = text.find(". ", m.end())
        ctx_end = ctx_end if ctx_end != -1 else len(text)
        if ctx_end - ctx_start > 4 * NEAR:
            ctx_start, ctx_end = max(ctx_start, m.start() - NEAR), min(ctx_end, m.end() + NEAR)
        ctx = text[ctx_start:ctx_end]
        span = _nearest_value_span(ctx, (m.start() - ctx_start, m.end() - ctx_start))
        if span is None:
            continue
        tok = MONEY.match(ctx, span[0])
        if tok is not None:
            out.append(_norm(tok.group(1), tok.group(2)))
    return out


NEGATION = re.compile(r"\bnot\b|\binstead of\b|\brather than\b|\bcorrection\b|\bmisconception\b",
                      re.IGNORECASE)


_ADJ_NEG = re.compile(r"\bnot\b|\binstead of\b|\brather than\b|\bisn'?t\b|\bwasn'?t\b|\bnever\b", re.IGNORECASE)


def _repudiated(text: str, value: float) -> bool:
    """True if `value` is negated *where it appears*: "~$2k, not $232", "not just the $232".

    Negation language elsewhere in a message is not a repudiation -- "thanks for the
    correction" followed by a restatement of the same figure affirms it.
    """
    for m in MONEY.finditer(text):
        if _norm(m.group(1), m.group(2)) != value:
            continue
        before = text[max(0, m.start() - 45) : m.start()]
        after = text[m.end() : m.end() + 30]
        # "correction"/"misconception" nearby usually *introduce the corrected figure*;
        # only a true negator adjacent to the value repudiates it
        if _ADJ_NEG.search(before) or re.match(r"\s*(?:,|\(|—|-)?\s*not\b", after, re.IGNORECASE):
            return True
    return False


_STOP = {"about", "after", "their", "there", "these", "those", "which", "while", "would", "could",
         "should", "where", "being", "every", "total", "raised", "first", "during", "since", "still"}


def _topic(text: str) -> set[str]:
    """Content words that identify what a sentence is about (the subject, not the number)."""
    return {w for w in re.findall(r"[a-z]{5,}", text.lower()) if w not in _STOP}


def _window(records: list[Record], after: datetime, horizon: timedelta) -> list[Record]:
    """Chat records in (after, after+horizon], sliced once so counts don't rescan the corpus."""
    out: list[Record] = []
    for r in records:
        if r.ts <= after:
            continue
        if r.ts - after > horizon:
            break
        if r.surface == CHAT:
            out.append(r)
    return out


def _whole_period_mentions(window: list[Record], value: float, anchor: set[str],
                           memo: dict[float, int]) -> int:
    """How often `value` is restated under whole-period framing about the same subject."""
    if value in memo:
        return memo[value]
    n = 0
    for r in window:
        if not any(_norm(m.group(1), m.group(2)) == value for m in MONEY.finditer(r.text)):
            continue
        for u in UNBOUND_QUAL.finditer(r.text):
            ctx = _ctx(r.text, u.start(), u.end())
            if _binds(ctx, (u.start() - r.text.find(ctx), u.end() - r.text.find(ctx)), value) and (
                not anchor or (_topic(ctx) & anchor)
            ):
                n += 1
                break
    memo[value] = n
    return n


def find_contradiction(
    records: list[Record], alert: Alert, qualifier: str, horizon: timedelta,
    topic: set[str] | None = None,
) -> Record | None:
    """A later message giving a materially different value for the *same* claim.

    Two shapes, because corrections are written both ways:
      1. an explicit repudiation carrying both numbers ("$2k, **not** $232"); or
      2. a different value under whole-period framing *about the same subject* --
         the sentence must measure something (raised, total, profit ...) and share a
         content word with the origin. Without that anchor "all-time $2 trillion" in
         an unrelated message would contradict a charity total.

    A human's contradiction wins over an agent's, because who breaks the error is
    itself the oversight finding.
    """
    value = alert.metrics["value"]
    anchor = topic or set()
    best: Record | None = None
    # a reframing only contradicts if the competing figure is at least as attested as
    # the original in later whole-period mentions; otherwise a different campaign's
    # total that shares the subject would "contradict" a true number
    window = _window(records, alert.fired_at, horizon)
    memo: dict[float, int] = {}
    support = _whole_period_mentions(window, value, anchor, memo)
    for r in window:
        vals = [_norm(m.group(1), m.group(2)) for m in MONEY.finditer(r.text)]
        others = {v for v in vals if v > 0 and v != value and max(v, value) / min(v, value) >= 1.5}
        if not others:
            continue
        repudiates = _repudiated(r.text, value)
        reframes = False
        if not repudiates:
            for u in UNBOUND_QUAL.finditer(r.text):
                ctx = _ctx(r.text, u.start(), u.end()); off = r.text.find(ctx)
                span = _nearest_value_span(ctx, (u.start() - off, u.end() - off))
                if span is None:
                    continue
                tok = MONEY.match(ctx, span[0])
                if tok is None or _norm(tok.group(1), tok.group(2)) not in others:
                    continue
                other = _norm(tok.group(1), tok.group(2))
                measured = any(_binds(ctx, mq.span(), other) for mq in MEASURE_QUAL.finditer(ctx))
                if (measured and (not anchor or (_topic(ctx) & anchor))
                        and _whole_period_mentions(window, other, anchor, memo) >= max(1, support)):
                    reframes = True
                    break
        if not (repudiates or reframes):
            continue
        if r.is_human:
            return r
        best = best or r
    return best


def detect(
    records: list[Record],
    *,
    horizon: timedelta = timedelta(days=21),
    correction_horizon: timedelta = timedelta(days=90),
    max_alerts_per_fact: int = 1,
    stats: dict[str, int] | None = None,
) -> list[Alert]:
    """Pair every bounded retrieval fact with the first assertion that strips it.

    `stats`, when given, is filled with the funnel: how many bounded retrievals
    were seen, how many scoped facts they stated, how many raw pairings fired,
    and what survived dedup and tiering. The UI draws the pipeline from it.
    """
    chat = [r for r in records if r.surface == CHAT]
    alerts: list[Alert] = []
    st = stats if stats is not None else {}
    st.update(bounded_retrievals=0, scoped_facts=0, raw_pairs=0)

    for rec in records:
        if rec.surface == RETRIEVAL and rec.scope is not None and rec.scope.is_bounded:
            st["bounded_retrievals"] += 1
        facts = scoped_facts(rec)
        st["scoped_facts"] += len(facts)
        for fact in facts:
            fired = 0
            for c in chat:
                if c.seq <= rec.seq or c.ts < rec.ts:
                    continue
                if c.ts - rec.ts > horizon:
                    break
                ok, qual = is_stripped_assertion(c, fact.value)
                if not ok:
                    continue
                lag = c.ts - rec.ts
                alerts.append(
                    Alert(
                        detector="scope_strip",
                        severity="high",
                        claim=f"${fact.value:,.0f}",
                        summary=(
                            f"${fact.value:,.0f} came from a retrieval bounded to "
                            f"{rec.scope.label()} and stated as \"{fact.qualifier}\", "
                            f"but {c.actor} asserted it as \"{qual}\" "
                            f"{_human_lag(lag)} later with no day bound."
                        ),
                        fired_at=c.ts,
                        chain=[
                            Evidence("origin", rec,
                                     f"retrieval scoped to {rec.scope.label()}; "
                                     f"answer bound: \"{fact.qualifier}\""),
                            Evidence("assertion", c,
                                     f"asserted as \"{qual}\", bound dropped"),
                        ],
                        metrics={
                            "value": fact.value,
                            "scope": rec.scope.label(),
                            "scope_width_days": rec.scope.width(),
                            "lag_seconds": lag.total_seconds(),
                            "origin_actor": rec.actor,
                            "asserting_actor": c.actor,
                            "origin_query": rec.query,
                        },
                    )
                )
                fired += 1
                st["raw_pairs"] += 1
                if fired >= max_alerts_per_fact:
                    break
    # One finding per (value, asserting message): several bounded retrievals can
    # carry the same number, and pairing each to one assertion inflates the count.
    best: dict[tuple[float, str | None], Alert] = {}
    for a in alerts:
        key = (a.metrics["value"], a.chain[1].record.native_id)
        cur = best.get(key)
        if cur is None or a.metrics["lag_seconds"] < cur.metrics["lag_seconds"]:
            best[key] = a
    out = sorted(best.values(), key=lambda a: a.fired_at)
    st["deduped"] = len(out)
    for a in out:
        qual = a.chain[1].note.split('"')[1] if '"' in a.chain[1].note else "last year"
        origin_ctx = next((f.context for f in scoped_facts(a.chain[0].record)
                           if f.value == a.metrics["value"]), "")
        contra = find_contradiction(records, a, qual, correction_horizon, topic=_topic(origin_ctx))
        if contra is None:
            a.severity = "medium"
            a.metrics["contradicted"] = False
        else:
            a.severity = "high"
            a.metrics["contradicted"] = True
            a.metrics["corrected_by"] = contra.actor
            a.metrics["correction_lag_seconds"] = (contra.ts - a.fired_at).total_seconds()
            a.chain.append(Evidence("correction", contra,
                                    "later message gives a materially different value "
                                    "under the same framing"))
    st["high"] = sum(a.severity == "high" for a in out)
    st["medium"] = sum(a.severity == "medium" for a in out)
    return out


def _human_lag(d: timedelta) -> str:
    s = int(d.total_seconds())
    if s < 90:
        return f"{s}s"
    if s < 5400:
        return f"{s // 60}m"
    if s < 172800:
        return f"{s // 3600}h"
    return f"{s // 86400}d"
