<h1 align="center">Tripwire</h1>
<p align="center"><strong>Catches claims that lose their evidence as they spread through an agent swarm.</strong></p>
<p align="center"><a href="#quickstart">Quickstart</a> · <a href="#how-it-works">How it works</a> · <a href="#the-workbench">Workbench</a> · <a href="#validation">Validation</a></p>

<p align="center"><img src="docs/img/alerts.png" alt="Tripwire workbench — the alerts page" width="100%"></p>

Oversight of agent swarms today is retrospective: a human reads the transcript afterwards and
notices. Tripwire watches the event log instead and raises an alert the moment a circulating
claim's provenance breaks — deterministically, with no model in the decision path, and with the
chain of records that proves it.

## What it found

Run on the [AI Village](https://huggingface.co/datasets/aidigestorg/ai-village) corpus — 46
agents, 194,344 records, 10,802 history-oracle calls — Tripwire surfaces **three alerts**. Two are
confirmed *phantom facts*: a number whose time bound was dropped in the retelling, which then
circulated as a whole-period truth until someone contradicted it.

| claim | bound survived | lived for | corrected by | reach |
|---|---|---|---|---|
| **`$232`** as "last year's total" (real: ~$1,984) | 22 s | **12 days** | a human | 70 messages · 7 actors · a campaign site, articles, social posts |
| **`$355`** as "the origin era's total" (real: ~$1,984) | 25 h | **51 days** | an agent | restated as village history |

The `$232` chain: an agent asked the oracle about the first charity drive **scoped to days 1–5**;
the oracle answered correctly — *"$232 by the end of Day 5."* Twenty-two seconds later the bound
was gone: *"last year … raised $232."* Eleven days on, another agent asked the oracle to *confirm*
it and was told it was *"independently verified"* — the swarm's own verification step certified the
error. A human corrected it on day 12. Of the 70 messages that carried the number, exactly one came
from a human.

## Quickstart

No dataset access needed — the example is a synthetic log in an unrelated domain.

```sh
uv sync
uv run tripwire scan --corpus generic --path examples/demo.jsonl --map examples/demo.map.json
uv run tripwire ui        # → http://127.0.0.1:8787/
```

To reproduce the findings above, request access to the [gated dataset](https://huggingface.co/datasets/aidigestorg/ai-village),
`hf auth login`, then:

```sh
uv run tripwire fetch docs small mid   # ~0.7 GB
uv run tripwire index && uv run tripwire scan && uv run tripwire ui
```

## How it works

```mermaid
flowchart LR
    EL[Event log]:::ingest --> AD[Adapter]:::ingest --> RS[Record stream]:::ingest

    subgraph DET[Detectors]
        SS[scope_strip]:::detect
        LQ[leading_query]:::detect
    end

    RS --> SS
    RS --> LQ
    SS --> TI[Tiering]:::detect
    LQ --> TI
    TI -->|high by default| AJ[alerts.json]:::output --> WB[Workbench]:::output

    classDef ingest fill:#F1EFE8,stroke:#5F5E5A,color:#444441
    classDef detect fill:#E1F5EE,stroke:#0F6E56,color:#085041
    classDef output fill:#FAEEDA,stroke:#854F0B,color:#633806
    style DET fill:#FFFFFF,stroke:#B4B2A9,stroke-dasharray: 4 4
```

<sub>Colour = pipeline phase: ingest · detection · output.</sub>

Any JSONL log is reduced to **records** (timestamp, actor, surface, text, and — for retrievals —
the **scope** they were run under). Two deterministic detectors read the stream: `scope_strip`
flags a bounded value later asserted without its bound; `leading_query` flags a verification query
that embeds its own answer. A finding is tiered **high** only if a later record contradicts it, and
**medium** otherwise (counted, but not emitted unless `--min-severity medium`). Each corpus
declares what it supports — `ai-village` (gated), `collusion-wiki` (open), or `generic` (your JSONL
plus a field map) — so a detector that can't apply is reported, never silently empty.

Run `tripwire corpora` to list corpora, or `tripwire --help` for the full CLI.

## The workbench

<p align="center"><img src="docs/img/timeline.png" alt="Timeline page" width="49%"> <img src="docs/img/graph.png" alt="Graph page" width="49%"></p>

One page per function, one alert in context across all of them, every state in the URL: **Alerts**
(the story), **Timeline** (replay the claim's life), **Graph** (who carried it, where it went),
**Spread** (how fast, how far), **Records** (searchable), **Analytics** (pipeline, corpus charts).

## Validation

Precision was tuned against hand-read false positives (48 raw pairings → 2 confirmed phantoms + 1
benign medium); seven false-positive classes became rules, each pinned by a test. Recall was
measured by hand-labelling **all 109** values from a loose screen — it found one missed strip
(`$355`) and drove four fixes, taking recall within the screen from 50% to 100%. The screen only
sees verbatim money values, so recall relative to the world is unmeasured, and two phantoms is an
incident count, not a rate. Method and labels: [`docs/recall.md`](docs/recall.md).

---

Code is [MIT](LICENSE). The AI Village dataset is used under its research terms — no redistribution,
no training, attribution to AI Digest — and nothing under `data/` is committed. Built for the
[AI Village × Grove Research Swarm Dynamics Hackathon](https://swarmchasing.com/).
