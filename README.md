<h1 align="center">Tripwire</h1>
<p align="center"><strong>A provenance monitor for agent swarms.</strong><br>
It watches a multi-agent system's event log and raises an alert the moment a circulating claim loses its evidence — then shows you exactly where it came from, who carried it, and who finally caught it.</p>

<p align="center">
  <a href="#try-it-in-sixty-seconds">Quickstart</a> ·
  <a href="#what-it-found">What it found</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#the-workbench">Workbench</a> ·
  <a href="#bring-your-own-data">Your data</a> ·
  <a href="docs/submission.md">Write-up</a>
</p>

<p align="center"><img src="docs/img/alerts.png" alt="Tripwire workbench — the alerts page: inbox, what happened, and the provenance story" width="100%"></p>

---

## Why

Oversight of agent swarms today is retrospective: a human reads the transcript afterwards and notices.
The investigators of the Hugging Face incident put it bluntly — *"we don't have good approaches for
understanding/overseeing the activity and aims of AI swarms."* That doesn't scale to a thousand agents.
It turns out it doesn't even work at forty-six.

Tripwire makes one class of failure **detectable from the record itself**, with no model in the decision
path. Every alert is deterministic, reproducible, and carries the chain of records that justifies it.

## What it found

Run on the [AI Village](https://huggingface.co/datasets/aidigestorg/ai-village) corpus — 46 agents,
194,344 records, 10,802 history-oracle calls — Tripwire reduces the record to **three alerts**. Two are
confirmed *phantom facts*: a number whose time bound was dropped in the retelling, which then circulated
as a whole-period truth until someone contradicted it.

| claim | bound survived | lived for | corrected by | reach |
|---|---|---|---|---|
| **`$232`** as "last year's total" (real: ~$1,984) | 22 s | **12 days** | a human | 70 messages · 7 actors · a campaign site, `fundraiser.json`, published articles, social posts |
| **`$355`** as "the origin era's total" (real: ~$1,984) | 25 h | **51 days** | an agent | restated as village history |

The `$232` chain, every step a row in the dataset:

1. **Oracle answer** — an agent asks the history oracle about the first charity drive, scoped to *days 1–5*.
   The oracle answers correctly for that window: *"by the end of Day 5, the fundraiser had raised $232."*
2. **Bound stripped** — 22 seconds later, the same agent writes *"last year … raised $232. Good baseline to beat!"*
3. **Oracle confirms** — eleven days on, another agent asks the oracle to *confirm* $232 and is told it is
   "supported by multiple agents independently verifying." The swarm's own verification step certified the error.
4. **Human correction** — on day 12 a human says: *"~$2k, not $232."* Of the 70 messages that carried the
   number, that was the only one from a human.

Tripwire fires at step 2.

## Try it in sixty seconds

No dataset access needed. The example is a synthetic four-record log in an unrelated domain.

```sh
git clone https://github.com/<you>/tripwire && cd tripwire
uv sync
uv run tripwire scan --corpus generic --path examples/demo.jsonl --map examples/demo.map.json
uv run tripwire ui        # → http://127.0.0.1:8787/
```

You'll get one HIGH alert (`$48,000`, "by the end of January" restated as the quarter's total, corrected by
`human:dana`) and every page of the workbench lit up with it.

## Run it on the AI Village corpus

The dataset is gated — request access on its
[Hugging Face page](https://huggingface.co/datasets/aidigestorg/ai-village), then `hf auth login`.

```sh
uv run tripwire fetch docs small mid   # ~0.7 GB: schema, chat, sessions, events
uv run tripwire index                  # one pass over events → normalised record cache
uv run tripwire scan                   # detectors → data/out/alerts.json
uv run tripwire ui
```

`fetch big` adds the 4.9 GB of memories and computer-use turns; the detectors here don't need them.

## How it works

```
 event log ──▶ adapter ──▶ Record stream ──▶ detectors ──▶ tiering ──▶ alerts.json ──▶ workbench
 (any JSONL)   declares    ts · actor ·     scope_strip    high: later      chains, replay   alerts · timeline
               what it     text · scope     leading_query  contradicted     tracks, funnel   graph · spread
               supports                                    medium: benign   counts           records · analytics
```

**Record model.** Every corpus is reduced to records with a timestamp, actor, surface (`chat` or
`retrieval`), text, and — for retrievals — the query and the **scope** it was run under. That scope is what
scope stripping is measured against. Humans and agents share the stream; a human actor is marked as one.

**Detectors.** Deterministic; each verdict rests on the record and can be checked by hand.

| detector | fires when | needs |
|---|---|---|
| `scope_strip` | a value stated *with* a time bound in a retrieval answer is later asserted as a whole-period fact *without* it | retrieval scope |
| `leading_query` | a verification query embeds the value it asks about, and the answer affirms it | retrieval query |

Each precision rule traces to a false positive found by hand: a qualifier binds to its *nearest* number;
goals, deltas, prices and completed outcomes aren't measurements; repair language only counts within 240
characters of the value; a bare month or year does not preserve a day-level bound.

**Tiering.** A strip is **high** only if a later record contradicts it — by adjacent negation
(*"~$2k, not $232"*) or by a materially different whole-period figure about the same subject that is at
least as attested as the original. Otherwise it's **medium**: the bound was dropped but the value held.
Medium findings are counted in the pipeline but not emitted unless you ask (`--min-severity medium`).

**Corpora** declare what they support, so a detector that can't apply is reported, never silently empty.

| corpus | supports | source |
|---|---|---|
| `ai-village` *(default)* | retrieval scope · retrieval query · human speech | AI Digest · gated |
| `collusion-wiki` | human speech | Nightingale Collective · open |
| `generic` | whatever your field map provides | any JSONL + `--map` |

## The workbench

One page per function; one alert in context across all of them; every state in the URL.

<p align="center"><img src="docs/img/timeline.png" alt="Timeline page — replay a claim's life" width="49%"> <img src="docs/img/graph.png" alt="Graph page — who carried the claim and where it was written" width="49%"></p>

| page | what it's for |
|---|---|
| **Alerts** | the inbox; for the selected alert, what happened, how bad, and the provenance story step by step |
| **Timeline** | replay the claim's life — cumulative count, role-coded ticks, milestones, a playhead you can scrub |
| **Graph** | live force-directed link analysis: actors sized by how often they carried it, artifacts it was written into, re-fetches from the oracle |
| **Spread** | who carried it most, how fast, when it first reached a durable artifact, how long until correction |
| **Records** | every message that carried the claim — searchable, filterable by role, click to read in full |
| **Analytics** | the pipeline funnel stage by stage, each phantom's life on a log-time axis, corpus activity by week |

Keyboard: **space** plays/pauses the replay, **`[`** collapses the sidebar (it also collapses itself below 1200 px).

## Bring your own data

One JSONL file and a field map of dotted paths — see [`examples/`](examples/) for a worked example.

```sh
uv run tripwire scan --corpus generic --path events.jsonl --map map.json
```

Fields you don't have are simply left out; the detectors that need them report themselves inapplicable.

## Validation

- **Precision** — every alert ever fired was hand-read. 48 raw pairings became 2 confirmed phantoms and 1
  benign medium; seven false-positive classes became rules, each pinned by a near-miss test.
- **Recall** — a loose screen (any money value from a bounded retrieval that reappears in chat within 21
  days) yields 109 distinct values; **all 109 were hand-labelled**, no sampling. It found one missed strip
  (`$355`) and drove four detector fixes. Within the screen, recall is 2/2.
- **Ceiling** — the screen only sees verbatim money values; strips of other quantities remain unmeasured.

Method, labels and categories: [`docs/recall.md`](docs/recall.md), [`docs/recall/`](docs/recall/).
Full write-up: [`docs/submission.md`](docs/submission.md). Internals: [`docs/architecture.md`](docs/architecture.md).

## CLI

| command | does |
|---|---|
| `tripwire fetch [docs\|small\|mid\|big\|day:YYYY-MM-DD …]` | download AI Village dataset tiers |
| `tripwire corpora` | list corpora and what each supports |
| `tripwire index [--corpus …]` | build the normalised record cache |
| `tripwire scan [--corpus …] [--path …] [--map …] [--min-severity high\|medium]` | run detectors, write `data/out/alerts.json` |
| `tripwire ui [--port 8787] [--no-open]` | serve the landing page and workbench |

## Repository layout

```
src/tripwire/      adapters/ · detectors/ · cli · scorecard · replay · recall · fetch
tests/             every negative is a real false positive; every positive a real miss
docs/              submission.md · architecture.md · recall.md · recall/ (labels, report) · img/
examples/          the zero-access demo corpus and field map
client/            React + Vite + Recharts + react-force-graph source
src/tripwire/static/  built UI — committed, so `tripwire ui` runs without Node
```

## Development

```sh
uv sync --all-groups && uv run pytest -q && uv run ruff check src tests   # python
cd client && npm ci && npm run dev                                         # UI, proxies /data to :8787
npm run build                                                              # → ../src/tripwire/static
```

CI runs lint, tests, the zero-access demo, and the UI build.

## Limitations

- The recall screen sees only verbatim money values; recall relative to the world is unmeasured.
- Two confirmed phantoms is an incident count, not a rate. The reduction ratio — 194,344 records to 3
  alerts — is the population claim.
- Attribution is carried from each source as claimed, never upgraded to proven.
- Scope stripping needs a retrieval layer; on corpora without one, only the other detectors apply.

## License and data

Code is [MIT](LICENSE). The AI Village dataset is used under its research terms — no redistribution, no
model training, no re-identification, attribution to AI Digest — and nothing under `data/` is committed.
