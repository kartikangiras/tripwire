"""Scope-strip detector tests.

Every negative here is a near-miss drawn from a false positive found by hand on
the real corpus. They are the precision guard: a change that reintroduces one of
these failures breaks a test rather than quietly inflating the alert count.
"""

from datetime import UTC, datetime, timedelta

import pytest

from tripwire.detectors.scope_strip import (
    _binds,
    detect,
    find_contradiction,
    is_stripped_assertion,
    scoped_facts,
)
from tripwire.model import CHAT, RETRIEVAL, Record, Scope

T0 = datetime(2026, 4, 2, 17, 0, tzinfo=UTC)


def retrieval(text, start=1, end=5, ts=T0, seq=1, actor="Opus"):
    return Record(ts=ts, seq=seq, surface=RETRIEVAL, kind="SEARCH_HISTORY", text=text,
                  query="how much was raised?", scope=Scope(start, end), actor=actor,
                  native_id=f"r{seq}")


def chat(text, ts=None, seq=2, actor="Opus"):
    return Record(ts=ts or (T0 + timedelta(seconds=22)), seq=seq, surface=CHAT,
                  kind="AGENT_TALK", text=text, actor=actor, native_id=f"c{seq}")


# ---------------------------------------------------------------- scoped_facts

def test_bounded_measurement_is_a_scoped_fact():
    facts = scoped_facts(retrieval("By the end of Day 5, the fundraiser had raised **$232** from 9 supporters."))
    assert [f.value for f in facts] == [232.0]
    assert "Day 5" in facts[0].qualifier


def test_goal_in_the_same_sentence_does_not_suppress_the_measurement():
    # real FP: "raised $232 ... against a $3,500 goal" -- 'goal' binds to 3,500
    facts = scoped_facts(retrieval("By the end of Day 5 we had raised $232 against a $3,500 goal."))
    assert 232.0 in [f.value for f in facts]
    assert 3500.0 not in [f.value for f in facts]


def test_unbounded_retrieval_yields_nothing():
    assert scoped_facts(retrieval("The fundraiser raised $232.", start=None, end=None)) == []


def test_number_in_a_title_is_not_a_measurement():
    # real FP: "$170" was part of a thread name, never a measured quantity
    assert scoped_facts(retrieval('On Day 476 the "Kira $170 a Month" thread had 10 comments.')) == []


def test_serialised_payload_is_not_prose():
    # real FP: some oracle answers embed serialised events
    noisy = 'On Day 372 the total to $205 occurred. {"answerToQuery":"x","endDay":372}'
    assert scoped_facts(retrieval(noisy, start=372, end=372)) == []


# ------------------------------------------------------- is_stripped_assertion

def test_unbounded_restatement_is_stripped():
    ok, qual = is_stripped_assertion(chat("last year the Village raised $232 from 9 supporters"), 232.0)
    assert ok and qual.lower() == "last year"


def test_preserved_day_bound_is_not_stripped():
    ok, _ = is_stripped_assertion(chat("by Day 5 last year they had raised $232"), 232.0)
    assert not ok


def test_table_row_day_bound_is_not_stripped():
    # real FP: the bound lived in the table row, not the sentence
    row = "| Era | Days | Outcome |\n| 1 | 100-109 | Opus 1st ($126 profit), total record |"
    ok, _ = is_stripped_assertion(chat(row), 126.0)
    assert not ok


def test_gap_is_not_a_level():
    # real FP: "need $27 to match last year" is not a claim that last year was $27
    ok, _ = is_stripped_assertion(chat("We're at $205 and need $27 to match last year"), 27.0)
    assert not ok


def test_repair_is_not_an_assertion():
    # real FP: the agent was patching stale wording, not asserting it
    msg = "I fixed a stale inconsistency: metadata still said `Final total raised: $270.` I patched it."
    ok, _ = is_stripped_assertion(chat(msg), 270.0)
    assert not ok


# --------------------------------------------------------- nearest-number bind

@pytest.mark.parametrize(
    ("text", "value", "expected"),
    [("raised $232 against a $3,500 goal", 3500.0, True),
     ("raised $232 against a $3,500 goal", 232.0, False)],
)
def test_qualifier_binds_to_nearest_number(text, value, expected):
    span = (text.index("goal"), text.index("goal") + 4)
    assert _binds(text, span, value) is expected


# ------------------------------------------------------------- contradiction

def test_human_contradiction_is_preferred_and_tiers_high():
    recs = [
        retrieval("By the end of Day 5, the fundraiser had raised $232 from 9 supporters."),
        chat("last year the Village raised $232 from 9 supporters"),
        chat("last year we raised a total of ~$2k, not $232.", ts=T0 + timedelta(days=12),
             seq=3, actor="human:adam"),
    ]
    alerts = detect(recs)
    assert len(alerts) == 1
    a = alerts[0]
    assert a.severity == "high"
    assert a.metrics["contradicted"] is True
    assert a.metrics["corrected_by"] == "human:adam"
    assert a.metrics["lag_seconds"] == pytest.approx(22.0)


def test_true_claim_without_contradiction_tiers_medium():
    recs = [
        retrieval("By the end of Day 372 the campaign had raised $205.", start=372, end=372),
        chat("FINAL TOTAL: $205 raised from 5 supporters"),
    ]
    alerts = detect(recs)
    assert len(alerts) == 1
    assert alerts[0].severity == "medium"
    assert alerts[0].metrics["contradicted"] is False


def test_same_value_restated_is_not_a_contradiction():
    recs = [retrieval("By the end of Day 5 the fundraiser had raised $232."),
            chat("last year they raised $232")]
    alerts = detect(recs)
    assert find_contradiction(recs + [chat("last year they raised $232", ts=T0 + timedelta(days=1), seq=9)],
                              alerts[0], "last year", timedelta(days=21)) is None


# ----------------------------------------------- found by the recall census

def test_era_framing_is_a_strip_even_when_repairs_are_mentioned_elsewhere():
    # real miss: "by Day 10 ... $355" became "Origin Era (Apr 2025): we raised $355 during our
    # first coordinated charity drive", inside a 17k-char message that said "fixed" far away
    long_msg = ("Permissions fixed from Restricted to Public. " * 3 + "\n\n" + "x. " * 200 +
                "\n\n**Origin Era (Apr 2025):** We raised $355 for the charity during our first "
                "coordinated charity drive.\n\n" + "y. " * 200 + "Correction: URLs were incorrect.")
    recs = [retrieval("The project raised a combined total of $355 across two fundraisers by Day 10.", start=6, end=10),
            chat(long_msg, ts=T0 + timedelta(hours=25), actor="Gemini")]
    alerts = detect(recs)
    assert [a.claim for a in alerts] == ["$355"]


def test_month_year_label_does_not_preserve_a_day_bound():
    ok, qual = is_stripped_assertion(chat("Origin Era (Apr 2025): we raised $355 during our first charity drive"), 355.0)
    assert ok and qual.lower() in ("origin era", "during our first")


def test_completed_outcome_is_not_a_scoped_fact():
    # real FP: a finished competition's result restated without the day widens nothing
    facts = scoped_facts(retrieval("Completed at the end of Day 105. Final results: Opus 1st ($126 profit, 24 orders).", start=100, end=109))
    assert 126.0 not in [f.value for f in facts]


def test_cross_topic_whole_period_value_is_not_a_contradiction():
    # real spurious HIGH: "all-time $2+ trillion" in an economics message was taken as a
    # contradiction of a $355 charity total
    recs = [retrieval("The charity project raised a combined total of $355 across two fundraisers by Day 10.", start=6, end=10),
            chat("Origin Era (Apr 2025): we raised $355 during our first coordinated charity drive.", ts=T0 + timedelta(hours=25)),
            chat("The exhibit covers $2+ trillion in all-time AI market valuations.", ts=T0 + timedelta(days=3), seq=5, actor="Haiku")]
    a = detect(recs)[0]
    assert a.severity == "medium" and a.metrics["contradicted"] is False


def test_same_subject_whole_period_value_is_a_contradiction_even_weeks_later():
    recs = [retrieval("The charity project raised a combined total of $355 across two fundraisers by Day 10.", start=6, end=10),
            chat("Origin Era (Apr 2025): we raised $355 during our first coordinated charity drive.", ts=T0 + timedelta(hours=25)),
            chat("The charity campaign raised a final combined total of $1,984.", ts=T0 + timedelta(days=51), seq=5, actor="Opus")]
    a = detect(recs)[0]
    assert a.severity == "high" and a.metrics["corrected_by"] == "Opus"


def test_word_magnitudes_parse():
    from tripwire.detectors.scope_strip import MONEY, _norm
    m = MONEY.search("$2+ trillion"); assert _norm(m.group(1), m.group(2)) == 2e12
    m = MONEY.search("$5 million");   assert _norm(m.group(1), m.group(2)) == 5e6


def test_true_value_is_not_contradicted_by_a_less_attested_other_total():
    # real FP: "$1,984 by Day 37" restated as the campaign total is true; one later mention of a
    # different campaign's $2,081 must not out-vote the many later restatements of $1,984
    recs = [retrieval("By Day 37 the charity campaign had raised $1,984 in donations.", start=24, end=38),
            chat("Our charity campaign raised $1,984 in total.", ts=T0 + timedelta(hours=2)),
            chat("The charity campaign raised a combined total of $1,984.", ts=T0 + timedelta(days=2), seq=5, actor="A"),
            chat("Charity drive total: $1,984 raised overall.", ts=T0 + timedelta(days=4), seq=6, actor="B"),
            chat("The agents raised $2,081 for the charity over a 78-day campaign in total.", ts=T0 + timedelta(days=6), seq=7, actor="C")]
    a = detect(recs)[0]
    assert a.severity == "medium" and a.metrics["contradicted"] is False


def test_affirming_restatement_with_far_away_correction_word_is_not_a_repudiation():
    # real FP: "Thanks for the correction! ... Total: ~$1,984 ... we're at $320" affirms $1,984
    recs = [retrieval("By Day 37 the charity campaign had raised $1,984 in donations.", start=24, end=38),
            chat("HKI fundraiser ($1,984 total) incorporated.", ts=T0 + timedelta(hours=2)),
            chat("Thanks for the correction, Adam! Last year: $1,481 for HKI, $503 for MC — Total: ~$1,984. "
                 "So we're at $320 and need $2,000+ to beat the record.", ts=T0 + timedelta(days=3), seq=5, actor="Opus")]
    a = detect(recs)[0]
    assert a.metrics["contradicted"] is False and a.severity == "medium"


def test_adjacent_negation_is_a_repudiation():
    from tripwire.detectors.scope_strip import _repudiated
    assert _repudiated("last year the agents raised ~$2k, not $232.", 232.0)
    assert _repudiated("raised ~$2k in total, not just the $232 we saw.", 232.0)
    assert not _repudiated("Thanks for the correction! Total: ~$1,984 raised.", 1984.0)
