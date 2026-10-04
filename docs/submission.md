# Tripwire — submission write-up

*AI Village × Grove Research · AI Swarm Dynamics Hackathon · 3–4 October 2026*

## The problem

Investigators of the Hugging Face incident said it plainly: *we don't have good approaches for
understanding or overseeing the activity and aims of AI swarms.* The oversight that exists is
retrospective — a human reads the transcript afterwards and notices. That does not scale to 1,200 agents,
and we found it does not even work at 46.

## What Tripwire is

A provenance monitor. It streams a multi-agent system's event log and raises an alert the moment a
circulating claim's provenance breaks. The alert carries the chain that justifies it — origin, restatement,
corroboration, correction — each step a row in the record with timestamp and actor, so a reviewer confirms
or dismisses it from the evidence alone. No model sits in the decision path.

It ships with a workbench (alert inbox, timeline replay, live link graph, spread analytics, searchable
records, pipeline analytics), an adapter layer that accepts any JSONL log through a field map, and a
measured precision/recall story.

## The failure mode it catches

**Scope stripping.** An agent asks a history oracle a question *scoped to a window* — "what happened in
days 1–5?" — and the oracle answers correctly for that window. The agent then restates the number as a
fact about the whole period. The oracle never hallucinated; the bound was lost in the retelling. Because
the bound is in the retrieval's own metadata, the break is computable rather than a judgement call.

**Manufactured corroboration.** An agent asks the oracle to *confirm* a value it already holds, and the
answer affirms it. The swarm reads that as independent verification. Nothing new was consulted.

## What it found in the AI Village corpus

194,344 records, 10,802 oracle calls, 6,815 of them bounded. Three alerts. Two confirmed phantom facts.

**`$232`.** On 2 April 2026 an agent queried the oracle for the first charity drive, scoped to days 1–5,
and was told *"by the end of Day 5, the fundraiser had raised $232 from 9 supporters"* — correct for that
window. Twenty-two seconds later it wrote *"last year … raised $232 … Good baseline to beat!"* The real
year-one total was ~$1,984. Over the next twelve days the number reached 70 messages from 7 actors, the
campaign website, `fundraiser.json`, published articles and social posts; the agents celebrated being
"+21% above last year" while at 14% of it. On 13 April an agent asked the oracle for *"the clearest
evidence trail for last year's campaign reaching $232"* and was told it was *"supported by multiple
agents independently verifying"* it. A human corrected it on 14 April. Of 70 messages carrying the number,
exactly one came from a human — the correction.

**`$355`.** Four months earlier, the same mechanism: *"raising a combined total of $355 … by Day 10"*
became, 25 hours later and by another agent, *"Origin Era (Apr 2025): we raised $355 … during our first
coordinated charity drive."* It stood for 51 days until an agent restated the real total. This one was
found by the recall census, not by the first version of the detector.

Tripwire fires at the restatement — 22 seconds and 25 hours after the respective oracle answers —
against corrections that took 12 and 51 days.

## How we validated it

- **Precision.** Every alert the detector ever fired was hand-read. The first pass produced 48 pairings;
  seven false-positive classes were identified (qualifier binding to the wrong number, goals, deltas,
  repairs, titles, serialised payloads, table-header bounds) and each became a rule and a near-miss
  test. Final: 2 high-tier alerts, both confirmed; 1 medium, correctly benign.
- **Recall.** A loose screen — any money value from a bounded retrieval reappearing in chat within 21
  days — yields 109 distinct values. We hand-labelled all of them (no sampling). One true strip was missed
  (`$355`); its three causes were fixed and pinned by tests. Within the screen, recall went from 50% to
  100%. The screen's ceiling (verbatim money values only) is stated, not hidden.
- **Contradiction tiering** was itself tested against two spurious HIGHs found along the way: an
  unrelated "$2+ trillion all-time" sentence, and a message that said "thanks for the correction" while
  *affirming* the figure.

Labels, categories and the report are in `docs/recall/`. 24 tests; CI runs lint, tests, the UI build,
and the zero-access demo.

## What is new here

Not the observation that agents misremember — the dataset card says so. What is new is that one class
of misremembering is **mechanically detectable from retrieval metadata**, that the swarm's own
verification step **reinforces** it rather than catching it, and that the detector plus its evidence chain
turns a 12-day human-dependent discovery into an alert at the moment of the restatement.

## Limitations and what we would do next

The recall screen only sees verbatim money values; strips of counts, dates and percentages are unmeasured.
Two phantoms is an incident count, not a rate. The next detectors are already specified by the data:
unsourced propagation, self-citation loops (the oracle citing its own earlier calls as evidence — observed),
and invariant divergence. A streaming adapter would make the replay literal rather than a reconstruction.

## Running it

`tripwire scan --corpus generic --path examples/demo.jsonl --map examples/demo.map.json` needs no data
access and exercises the whole product; the AI Village run needs dataset access and
`tripwire fetch docs small mid`.

## Data and ethics

The AI Village dataset is used under its research terms. No raw data is committed; the committed recall
labels carry record ids and categories only. Attribution of any agent's statements is as the dataset
records it, and the limitations above are stated in the product itself.
