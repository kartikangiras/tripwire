"""Tripwire CLI: index a corpus, scan it, emit alerts and a scorecard."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import orjson

from . import adapters
from . import replay as rp
from . import scorecard as sc
from .detectors import leading_query, scope_strip
from .model import Alert

OUT = Path("data/out")


def _alert_json(a: Alert) -> dict[str, Any]:
    return {
        "detector": a.detector,
        "severity": a.severity,
        "claim": a.claim,
        "summary": a.summary,
        "fired_at": a.fired_at.isoformat(),
        "actors": a.actors(),
        "metrics": {k: v for k, v in a.metrics.items()},
        "chain": [
            {
                "role": e.role,
                "note": e.note,
                "ts": e.record.ts.isoformat(),
                "actor": e.record.actor,
                "surface": e.record.surface,
                "kind": e.record.kind,
                "scope": e.record.scope.label() if e.record.scope else None,
                "query": e.record.query,
                "text": e.record.text[:4000],
                "native_id": e.record.native_id,
            }
            for e in a.chain
        ],
    }


def cmd_fetch(args: argparse.Namespace) -> int:
    from . import fetch

    return fetch.main(args.tiers)


def cmd_corpora(args: argparse.Namespace) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "corpora.json").write_bytes(
        orjson.dumps([c.info() for c in adapters.all_corpora()], option=orjson.OPT_INDENT_2))
    print(f"{'NAME':<16} {'TITLE':<26} {'GATED':<6} SUPPORTS")
    for c in adapters.all_corpora():
        print(f"{c.name:<16} {c.title:<26} {'yes' if c.gated else 'no':<6} "
              f"{', '.join(sorted(c.supports)) or '—'}")
        print(f"{'':<16} {c.description}")
        if c.notes:
            print(f"{'':<16} \033[2m{c.notes}\033[0m")
    return 0


def cmd_index(args: argparse.Namespace) -> int:
    c = adapters.get(args.corpus)
    if c.indexer is None:
        print(f"{c.name} needs no index step")
        return 0
    n = c.indexer()
    print(f"indexed {n:,} records for {c.name}")
    return 0


def cmd_scan(args: argparse.Namespace) -> int:
    c = adapters.get(args.corpus)
    kw: dict[str, Any] = {}
    if args.path:
        kw["path"] = args.path
    if args.map:
        kw["mapping"] = orjson.loads(Path(args.map).read_bytes())
    records = c.loader(**kw)
    print(f"corpus {c.name}: loaded {len(records):,} records", file=sys.stderr)

    alerts: list[Alert] = []
    skipped: list[tuple[str, str]] = []
    strip: list[Alert] = []
    st_strip: dict[str, int] = {}
    st_lead: dict[str, int] = {}
    if adapters.applicable(scope_strip.REQUIRES, c):
        strip = scope_strip.detect(records, stats=st_strip)
        alerts += strip
    else:
        skipped.append(("scope_strip", ", ".join(sorted(scope_strip.REQUIRES - c.supports))))
    if adapters.applicable(leading_query.REQUIRES, c):
        known = leading_query.contradicted_values(strip)
        alerts += leading_query.detect(records, contradicted=known, stats=st_lead)
    else:
        skipped.append(("leading_query", ", ".join(sorted(leading_query.REQUIRES - c.supports))))
    alerts.sort(key=lambda a: a.fired_at)
    for name, missing in skipped:
        print(f"  skipped {name}: corpus lacks {missing}", file=sys.stderr)
    # a medium finding is a dropped bound whose value held; keep it out of the inbox
    # unless asked, but count it in the pipeline so the tiering stays visible
    rank = {"low": 0, "medium": 1, "high": 2}
    found = len(alerts)
    alerts = [a for a in alerts if rank[a.severity] >= rank[args.min_severity]]
    if found != len(alerts):
        print(f"  {found - len(alerts)} finding(s) below --min-severity {args.min_severity} not emitted",
              file=sys.stderr)

    card = sc.build(c.name, records, alerts)
    OUT.mkdir(parents=True, exist_ok=True)
    replays = [
        rp.build_track(records, a) for a in alerts if a.metrics.get("contradicted")
    ]
    from .model import CHAT, RETRIEVAL
    n_chat = sum(r.surface == CHAT for r in records)
    n_ret = sum(r.surface == RETRIEVAL for r in records)
    n_human = sum(r.is_human for r in records)
    pipeline = {
        "ingest": [
            {"stage": "records", "label": "records normalised", "n": len(records)},
            {"stage": "chat", "label": "agent & human messages", "n": n_chat},
            {"stage": "retrievals", "label": "retrieval calls", "n": n_ret},
            {"stage": "human", "label": "human messages", "n": n_human},
        ],
        "scope_strip": [
            {"stage": "bounded", "label": "bounded retrievals", "n": st_strip.get("bounded_retrievals", 0)},
            {"stage": "facts", "label": "scoped facts stated", "n": st_strip.get("scoped_facts", 0)},
            {"stage": "pairs", "label": "stripped restatements", "n": st_strip.get("raw_pairs", 0)},
            {"stage": "deduped", "label": "distinct findings", "n": st_strip.get("deduped", 0)},
            {"stage": "high", "label": "contradicted (phantom)", "n": st_strip.get("high", 0)},
        ],
        "leading_query": [
            {"stage": "retrievals", "label": "retrievals with a query", "n": st_lead.get("retrievals", 0)},
            {"stage": "intent", "label": "asked to verify", "n": st_lead.get("verification_intent", 0)},
            {"stage": "shared", "label": "value in query and answer", "n": st_lead.get("value_in_query_and_answer", 0)},
            {"stage": "hedged", "label": "oracle hedged (ok)", "n": st_lead.get("hedged", 0)},
            {"stage": "affirmed", "label": "oracle affirmed", "n": st_lead.get("affirmed", 0)},
            {"stage": "high", "label": "confirmed a known-wrong value", "n": st_lead.get("high", 0)},
        ],
        "output": [
            {"stage": "alerts", "label": "alerts for review", "n": len(alerts)},
            {"stage": "phantom", "label": "phantom facts", "n": card.phantom_facts},
        ],
    }
    import collections
    widths: collections.Counter[int] = collections.Counter()
    weekly: dict[str, dict[str, int]] = {}
    for r in records:
        wk = (r.ts - __import__("datetime").timedelta(days=r.ts.weekday())).strftime("%Y-%m-%d")
        w = weekly.setdefault(wk, {"chat": 0, "retrievals": 0, "human": 0})
        if r.surface == RETRIEVAL:
            w["retrievals"] += 1
            if r.scope is not None and r.scope.is_bounded and r.scope.width() is not None:
                widths[min(int(r.scope.width()), 31)] += 1
        else:
            w["chat"] += 1
            if r.is_human:
                w["human"] += 1
    charts = {
        "scope_width_hist": [{"width": k, "n": v} for k, v in sorted(widths.items())],
        "weekly": [{"week": k, **v} for k, v in sorted(weekly.items())],
    }
    payload = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "corpus": c.info(),
        "skipped_detectors": [{"detector": n, "missing": m} for n, m in skipped],
        "scorecard": card.as_dict(),
        "pipeline": pipeline,
        "charts": charts,
        "alerts": [_alert_json(a) for a in alerts],
        "replays": replays,
    }
    (OUT / "alerts.json").write_bytes(orjson.dumps(payload, option=orjson.OPT_INDENT_2))

    print(f"\n{'SEV':<7} {'DETECTOR':<14} {'CLAIM':<10} {'FIRED':<20} SUMMARY")
    for a in alerts:
        print(f"{a.severity:<7} {a.detector:<14} {a.claim:<10} "
              f"{a.fired_at.strftime('%Y-%m-%d %H:%M'):<20} {a.summary[:96]}")
    print()
    for k, v in card.as_dict().items():
        print(f"  {k:<42} {v}")
    for r in replays:
        c = r["counts"]
        print(f"\n  replay {r['claim']}: {c['records']} records, {c['actors']} actors, "
              f"{c['requeries']} re-queries, {c['contaminations']} contaminating messages "
              f"over {r['span_days']}d; surfaces: {', '.join(r['artifact_surfaces'][:8])}")
    print(f"\nwrote {OUT / 'alerts.json'}")
    return 0


STATIC = Path(__file__).parent / "static"


def cmd_ui(args: argparse.Namespace) -> int:
    """Serve the built UI from the package and ./data/out alongside it."""
    import http.server
    import socketserver
    import webbrowser

    if not (OUT / "alerts.json").exists():
        print("no data/out/alerts.json — run `tripwire scan` first", file=sys.stderr)
        return 1
    if not (STATIC / "index.html").exists():
        print(f"no built UI at {STATIC} — run `npm run build` in client/", file=sys.stderr)
        return 1
    data_root = OUT.parent.resolve()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a: Any, **k: Any) -> None:
            super().__init__(*a, directory=str(STATIC), **k)

        def translate_path(self, path: str) -> str:
            # /data/... comes from the working directory, everything else from the package
            if path.startswith("/data/"):
                rel = path[len("/data/") :].split("?", 1)[0].split("#", 1)[0]
                target = (data_root / rel).resolve()
                if data_root in target.parents or target == data_root:
                    return str(target)
                return str(data_root / "__forbidden__")
            return super().translate_path(path)

        def log_message(self, *_: Any) -> None:  # keep the terminal quiet
            pass

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", args.port), Handler) as srv:
        url = f"http://127.0.0.1:{args.port}/"
        print(f"tripwire -> {url}  (ctrl-c to stop)")
        if not args.no_open:
            webbrowser.open(url)
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="tripwire", description="provenance monitor for agent swarms")
    subs = p.add_subparsers(dest="cmd", required=True)
    fe = subs.add_parser("fetch", help="download the AI Village dataset (docs, small, mid, big, day:YYYY-MM-DD)")
    fe.add_argument("tiers", nargs="*")
    fe.set_defaults(fn=cmd_fetch)
    subs.add_parser("corpora", help="list available corpora").set_defaults(fn=cmd_corpora)
    ix = subs.add_parser("index", help="build the normalised record cache")
    ix.add_argument("--corpus", default="ai-village")
    ix.set_defaults(fn=cmd_index)
    sc_ = subs.add_parser("scan", help="run detectors and write alerts.json")
    sc_.add_argument("--corpus", default="ai-village", help="corpus name (see `tripwire corpora`)")
    sc_.add_argument("--path", help="data path, for file-based corpora")
    sc_.add_argument("--map", help="JSON field map, for --corpus generic")
    sc_.add_argument("--min-severity", choices=["low", "medium", "high"], default="high",
                     help="lowest tier to emit (default: high — contradicted findings only)")
    sc_.set_defaults(fn=cmd_scan)
    ui = subs.add_parser("ui", help="serve the landing page and workbench")
    ui.add_argument("--port", type=int, default=8787)
    ui.add_argument("--no-open", action="store_true")
    ui.set_defaults(fn=cmd_ui)
    args = p.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    raise SystemExit(main())
