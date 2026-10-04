# Architecture

## Record model (`src/tripwire/model.py`)

`Record(ts, seq, surface, kind, text, actor, query, scope, corpus)`. `surface` is `chat` or
`retrieval`; `scope` is `Scope(start_day, end_day)` and is only present on retrievals. Human actors
are prefixed `human:`. `seq` is the corpus's canonical ordering where one exists.

## Adapters (`adapters/`)

A corpus is anything that yields Records. Each registers with the capabilities it supports
(`retrieval_scope`, `retrieval_query`, `human_speech`); detectors declare what they require and the CLI
reports inapplicable detectors instead of running them. `ai_village` reads `events.jsonl.gz` once into a
compact cache; `collusion_wiki` reads the Nightingale export; `generic` reads any JSONL through a
dotted-path field map.

## Detectors (`detectors/`)

**scope_strip** — for each bounded retrieval, `scoped_facts()` extracts money values that (a) bind to a
measurement predicate, (b) bind to an explicit bound ("by the end of Day 5", "as of January", "so far"),
and (c) do not bind to a goal, delta or completed-outcome qualifier. Binding means *nearest number*.
`is_stripped_assertion()` then looks forward for a chat message asserting the same value under a
whole-period qualifier with no day-level bound preserved, no delta/goal framing, and no repair language
within 240 characters. One finding per (value, asserting message); the nearest origin wins.

**leading_query** — a retrieval whose query shows verification intent and contains a money value that the
answer also contains, where the answer affirms rather than hedges. Cross-tiered: a value the scope-strip
pass showed was contradicted makes the confirmation HIGH.

## Tiering

`find_contradiction()` searches a 90-day window after the assertion for either an **adjacent
repudiation** ("~$2k, not $232") or a **reframing**: a materially different value (≥1.5×) bound to a
whole-period qualifier, measured, about the same subject (content-word overlap with the origin sentence),
and at least as attested in later whole-period mentions as the original value. A human contradiction is
preferred. HIGH = contradicted; MEDIUM = stripped but not contradicted. `--min-severity` defaults to high.

## Outputs (`data/out/alerts.json`)

`scorecard` (counts, median time-to-strip, median phantom lifetime, per-incident facts), `pipeline`
(stage counts per detector), `charts` (scope-width histogram, weekly volumes), `alerts` (each with its
evidence chain and full text), `replays` (for each contradicted alert, every record carrying the value
between origin and correction, role-tagged: mention, requery, contamination, …).

## UI (`client/`)

Vite + React. `hooks/` own data loading, the replay engine and page/sidebar state; `pages/` are one
function each; `components/workbench/` are the pieces pages compose; `components/charts/` is the Recharts kit
(every chart: real axes, tooltips, legends; synced small multiples; log scale for lifetimes) and
`components/workbench/ForceGraph.tsx` the link analysis on react-force-graph-2d. The build lands in
`src/tripwire/static/` and is committed; everything reads `alerts.json` at runtime, so a rescan updates
the UI with a reload.

## Recall probe (`recall.py`, `docs/recall.md`)

A loose screen produces a superset of the detector's reach; the unflagged remainder is hand-labelled
in full and the labels are committed under `docs/recall/`.
