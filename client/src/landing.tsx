import { Fragment, StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import "./landing.css";
import type { Data } from "./lib/data";
import { Funnel, SpreadArea, TimelineChart } from "./components/charts";
import "./components/charts/landing-theme.css";
import { fmtInt } from "./lib/data";
import { SPRING } from "./lib/motion";

/* ─────────────────────────────────────────────────────────
 * LANDING STORYBOARD
 *    0ms   nav visible
 *  100ms   eyebrow + headline slide up
 *  260ms   lede + CTAs follow
 *  480ms   product frame rises into place
 *  later   each section reveals once when scrolled into view
 * ───────────────────────────────────────────────────────── */
const T = { head: 100, lede: 260, frame: 480 } as const;
const inViewAnim = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: SPRING.stiff };
const none = {};

function Pipeline({ d }: { d: Data | null }) {
  const reduce = useReducedMotion();
  const p = d?.pipeline;
  const n = (g: keyof NonNullable<Data["pipeline"]>, s: string) => p?.[g].find(x => x.stage === s)?.n;
  const nodes = [
    { k: "Ingest", v: n("ingest", "records"), d: "Any event log — chat, retrievals, human speech — through a built-in adapter or a JSONL field map." },
    { k: "Normalise", v: n("ingest", "retrievals"), d: "One record model. Retrievals keep their scope bound; humans and agents share the stream." },
    { k: "Detect", v: (n("scope_strip", "facts") ?? 0) + (n("leading_query", "intent") ?? 0) || undefined, d: "Deterministic detectors read the record — bounds, qualifiers, repeated values. No model decides." },
    { k: "Tier", v: n("scope_strip", "deduped"), d: "Findings are deduplicated and checked for a later contradiction. Who corrected it is recorded." },
    { k: "Alert", v: n("output", "alerts"), d: "Each alert carries its provenance chain, so a reviewer confirms or dismisses it from the evidence." },
  ];
  const W = 1000, y = 46, xs = nodes.map((_, i) => 60 + i * (W - 120) / 4);
  return (
    <div className="pipe">
      <svg viewBox={`0 0 ${W} 92`} aria-label="Pipeline: ingest, normalise, detect, tier, alert">
        <defs><style>{`@keyframes flow{to{stroke-dashoffset:-28}} .fl{stroke-dasharray:6 8;animation:flow 1.6s linear infinite} @media(prefers-reduced-motion:reduce){.fl{animation:none}}`}</style></defs>
        {xs.slice(0, -1).map((x, i) => <line key={i} className="fl" x1={x + 30} x2={xs[i + 1] - 30} y1={y} y2={y} stroke="rgba(20,20,20,.35)" strokeWidth={1.5} />)}
        {nodes.map((nd, i) => (
          <motion.g key={nd.k} {...(reduce ? none : { initial: { opacity: 0, scale: 0.8 }, whileInView: { opacity: 1, scale: 1 }, viewport: { once: true }, transition: { ...SPRING.bouncy, delay: i * 0.12 } })}
            style={{ transformOrigin: `${xs[i]}px ${y}px` }}>
            <circle cx={xs[i]} cy={y} r={26} fill={i === 4 ? "#141414" : "#fff"} stroke={i === 4 ? "#141414" : "rgba(20,20,20,.3)"} strokeWidth={1.5} />
            <text x={xs[i]} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={i === 4 ? "#fff" : "#141414"} letterSpacing=".06em">{String(i + 1).padStart(2, "0")}</text>
            <text x={xs[i]} y={y + 50} textAnchor="middle" fontSize={11} fontWeight={600} fill="#141414" letterSpacing=".1em">{nd.k.toUpperCase()}</text>
          </motion.g>))}
      </svg>
      <div className="cols">{nodes.map(nd => <div key={nd.k}>{nd.v != null && <div className="n">{fmtInt(nd.v)}</div>}<b>{nd.k}</b>{nd.d}</div>)}</div>
    </div>
  );
}

/** <pre> with explicit line breaks — JSX would otherwise collapse them. */
const Code = ({ lines }: { lines: ReactNode[] }) => (
  <pre>{lines.map((l, i) => <Fragment key={i}>{l}{i < lines.length - 1 ? "\n" : ""}</Fragment>)}</pre>
);
const C = ({ children }: { children: ReactNode }) => <span className="c">{children}</span>;
const K = ({ children }: { children: ReactNode }) => <span className="k">{children}</span>;
const S = ({ children }: { children: ReactNode }) => <span className="s">{children}</span>;

const Placeholder = () => <div className="ph">Run a scan to see this chart on your own data.</div>;

const Glyph = ({ k }: { k: string }) => {
  const s = { stroke: "#141414", strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (k) {
    case "scope": return <svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="9" rx="1.5" {...s} /><path d="M6 16h8" {...s} strokeDasharray="2 2" /></svg>;
    case "echo": return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 12 0" {...s} /><path d="M7 10a3 3 0 0 1 6 0" {...s} /><circle cx="10" cy="10" r="1" fill="#141414" /></svg>;
    case "graph": return <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.4" {...s} /><circle cx="4" cy="5" r="1.6" {...s} /><circle cx="16" cy="5" r="1.6" {...s} /><circle cx="10" cy="17" r="1.6" {...s} /><path d="M5.3 6.2l3.2 2.6M14.7 6.2l-3.2 2.6M10 12.4v3" {...s} /></svg>;
    case "replay": return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 15h14M5 15V9M9 15V5M13 15v-6M17 15V7" {...s} /><path d="M7 3l3 2-3 2z" fill="#141414" /></svg>;
    case "chart": return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 16l4-5 3 3 7-8" {...s} /><path d="M12 6h5v5" {...s} /></svg>;
    default: return <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 5h12M4 10h12M4 15h8" {...s} /><rect x="2" y="3" width="16" height="14" rx="2" {...s} /></svg>;
  }
};

function App() {
  const reduce = useReducedMotion();
  const inView = reduce ? none : inViewAnim;
  const [stage, setStage] = useState(reduce ? 3 : 0);
  const [d, setD] = useState<Data | null>(null);
  const rich = d?.replays.length ? d.replays.reduce((a, b) => (b.track.length > a.track.length ? b : a)) : null;
  useEffect(() => {
    const t = reduce ? [] : [T.head, T.lede, T.frame].map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    fetch("/data/out/alerts.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setD).catch(() => {});
    return () => t.forEach(clearTimeout);
  }, []);
  const up = (n: number) => reduce ? none : ({ initial: { opacity: 0, y: 14 }, animate: { opacity: stage >= n ? 1 : 0, y: stage >= n ? 0 : 14 }, transition: SPRING.stiff });

  return (
    <>
      <nav><div className="wrap">
        <a className="wordmark" href="./">TRIP<b>WIRE</b></a>
        <a className="lk" href="#how">How it works</a><a className="lk" href="#capabilities">Capabilities</a><a className="lk" href="#analytics">Analytics</a><a className="lk" href="#data">Your data</a>
        <span className="sp" /><a className="btn primary" href="./workbench.html">Open workbench →</a>
      </div></nav>

      <section className="hero"><div className="wrap center">
        <motion.div {...up(1)}><div className="micro">Provenance monitoring for agent systems</div>
          <h1>Know which claims your agents can actually back up.</h1></motion.div>
        <motion.div {...up(2)}>
          <p className="lede">Tripwire watches a multi-agent system's event stream and raises an alert the moment a circulating claim loses its evidence — a retrieval bound dropped in the retelling, a verification that only confirmed what the asker already believed, a figure that no longer matches the record.</p>
          <div className="cta"><a className="btn primary" href="./workbench.html">Open the workbench</a><a className="btn" href="#data">Run it on your data</a><span className="hint">deterministic · no model in the decision path</span></div>
        </motion.div>
      </div></section>

      <section id="how"><div className="wrap">
        <motion.div {...inView}><div className="micro">How it works</div><h2>From raw event log to a reviewable alert, end to end.</h2>
          <p className="lede">Five stages, each one counted. The numbers below are from the most recent scan, so what you see here is what the pipeline actually did.</p></motion.div>
        <Pipeline d={d} />
      </div></section>

      <section id="capabilities"><div className="wrap">
        <motion.div {...inView}><div className="micro">Capabilities</div><h2>Six things it does that reading the transcript doesn't.</h2></motion.div>
        <div className="grid">{[
          ["scope", "Scope stripping", "A value measured over a window gets restated as a fact about the whole period. The retrieval's own metadata records the bound, so the discrepancy is computable, not a judgement call."],
          ["echo", "Manufactured corroboration", "A verification query that already contains its own answer gets confirmed. The swarm reads that as independent proof. Tripwire catches the echo."],
          ["graph", "Link analysis", "Who carried a claim, where it was written, and which calls fetched it again — as a graph you can click into, with every edge weighted by evidence."],
          ["replay", "Replay", "Scrub through the life of a claim at any speed and watch the moment the alert would have fired against the moment the swarm actually noticed."],
          ["chart", "Spread analytics", "Who carried it, how fast it moved, when it first reached a durable artifact, and how long until anyone corrected it."],
          ["data", "Bring your own data", "Built-in adapters, or one JSONL file plus a field map. Each source declares what it supports, so detectors that can't apply are reported — never silently empty."],
        ].map(([k, t, p], i) => <motion.div className="card" key={k} {...(reduce ? none : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { ...SPRING.stiff, delay: (i % 3) * 0.08 } })}>
          <div className="ic"><Glyph k={k} /></div><h3>{t}</h3><p>{p}</p></motion.div>)}</div>
      </div></section>

      <section id="analytics"><div className="wrap">
        <motion.div {...inView}><div className="micro">Workbench</div><h2>An analyst's desk, not a dashboard.</h2></motion.div>
        <motion.div className="alt" {...inView}>
          <div className="txt"><h3>Cumulative spread</h3><p className="lede">Every message that carried a flagged claim, accumulating over the days it lived — with the oracle's answer, the moment the bound was dropped, the manufactured confirmation and the eventual correction as rules.</p>
            <ul className="pts"><li>Hover any step for the actor and what the message did</li><li>Milestones come straight from the alert's provenance chain</li><li>The same chart drives the workbench's analytics page</li></ul></div>
          <div className="vis chart">{d && rich ? <SpreadArea rp={rich} alerts={d.alerts} height={300} light /> : <Placeholder />}</div>
        </motion.div>
        <motion.div className="alt rev" {...inView}>
          <div className="txt"><h3>Replay</h3><p className="lede">The workbench replays the claim's life on this strip: role-coded ticks for every message that carried it, the cumulative count as ground, milestones as rules, and a playhead you can scrub.</p>
            <ul className="pts"><li>Scrub by clicking anywhere on the strip</li><li>Cumulative spread drawn as the ground, role-coded events on top</li><li>Table view for the full record when you need to read, not watch</li></ul></div>
          <div className="vis chart">{d && rich ? <TimelineChart rp={rich} alerts={d.alerts} cur={Date.parse(rich.window.end)} onScrub={() => {}} height={300} /> : <Placeholder />}</div>
        </motion.div>
        <motion.div className="alt" {...inView}>
          <div className="txt"><h3>Analytics</h3><p className="lede">A full view of charts that each answer one question: the pipeline funnel stage by stage, detection against the swarm's own correction on a log-time scale, cumulative spread, who carried it, where it was written, how far back retrievals looked.</p>
            <ul className="pts"><li>Never a dual axis — series of different scale get their own panel</li><li>Colour carries role, text carries numbers, legends whenever there are two series</li><li>Every mark has a tooltip; every number is tabular</li></ul></div>
          <div className="vis chart">{d && d.pipeline ? <div style={{ width: "100%" }}><Funnel stages={d.pipeline.scope_strip} color="#2a78d6" height={150} /><Funnel stages={d.pipeline.leading_query} color="#eb6834" height={170} /></div> : <Placeholder />}</div>
        </motion.div>
      </div></section>

      <section id="data"><div className="wrap">
        <motion.div {...inView}><div className="micro">Your data</div><h2>Point it at your own agents.</h2>
          <p className="lede">Four steps from an event log to a reviewable alert. Nothing is trained, nothing leaves your machine,
            and each source declares what it supports — so a detector that can't apply to your data says so instead of returning nothing.</p></motion.div>
        <ol className="steps">
          <li>
            <div className="st"><div className="n">1</div><div><h3>Export the event log</h3>
              <p>One JSONL file, one record per line. Each record needs a timestamp, who acted, and what they said. Retrievals
                additionally carry the <b>query</b> and the <b>bound</b> it was run under — that bound is what scope stripping is measured against.</p></div></div>
            <Code lines={[
              <C>// events.jsonl — one line per record</C>,
              <>{'{'}"created_at": "2026-05-01T09:00:00Z", "agent": {'{'}"name": "researcher-01"{'}'},</>,
              <> "kind": "retrieval",</>,
              <> "request": {'{'}"query": "what was Q1 revenue?", "from": 1, "to": 31{'}'},</>,
              <> "content": "By the end of January, revenue had reached $48,000."{'}'}</>,
              <>{'{'}"created_at": "2026-05-01T09:00:40Z", "agent": {'{'}"name": "researcher-01"{'}'},</>,
              <> "kind": "chat", "content": "Last quarter we booked $48,000 in total revenue."{'}'}</>,
            ]} />
          </li>
          <li>
            <div className="st"><div className="n">2</div><div><h3>Describe your fields</h3>
              <p>A small JSON map from Tripwire's record model to your schema, using dotted paths. Leave out what you don't have:
                a corpus without <code>query</code> or <code>scope_*</code> is still scanned — the scope detectors just report themselves inapplicable.</p></div></div>
            <Code lines={[
              <C>// map.json — Tripwire field → path into your row</C>,
              <>{'{'}<S>"ts"</S>: "created_at",   <S>"actor"</S>: "agent.name",   <S>"text"</S>: "content",</>,
              <> <S>"surface"</S>: "kind",      <S>"query"</S>: "request.query",</>,
              <> <S>"scope_start"</S>: "request.from",   <S>"scope_end"</S>: "request.to"{'}'}</>,
            ]} />
          </li>
          <li>
            <div className="st"><div className="n">3</div><div><h3>Scan</h3>
              <p>Detectors run over the normalised stream. The output is <code>alerts.json</code>: every finding with its provenance chain,
                the pipeline counts at each stage, and a scorecard. Only contradicted findings are emitted by default.</p></div></div>
            <Code lines={[
              <><K>tripwire</K> scan --corpus <S>generic</S> --path <S>events.jsonl</S> --map <S>map.json</S></>,
              <C>corpus generic: loaded 4 records</C>,
              <C>high  scope_strip  $48,000  bound "By the end of January" dropped</C>,
            ]} />
          </li>
          <li>
            <div className="st"><div className="n">4</div><div><h3>Open the workbench</h3>
              <p>Serves the inbox, the timeline, and the story for each alert from the scan you just ran. Add{" "}
                <code>--min-severity medium</code> to the scan if you also want dropped bounds whose value happened to hold.</p></div></div>
            <Code lines={[
              <><K>tripwire</K> ui</>,
              <C>tripwire → http://127.0.0.1:8787/ui/app/</C>,
            ]} />
          </li>
          <li>
            <div className="st"><div className="n">+</div><div><h3>Or start from a built-in adapter</h3>
              <p>Adapters already exist for common corpus shapes. <code>tripwire corpora</code> lists them with what each supports; some
                need a one-time <code>index</code> step before scanning.</p></div></div>
            <Code lines={[
              <><K>tripwire</K> corpora</>,
              <><K>tripwire</K> index <C>&amp;&amp;</C> <K>tripwire</K> scan</>,
            ]} />
          </li>
        </ol>
      </div></section>

      <section><div className="wrap">
        <motion.div {...inView}><div className="micro">Stay in control</div><h2>Deterministic by design.</h2></motion.div>
        <div className="trust">
          <div><b>No model in the decision path</b><p>An alert is a consequence of the record — bounds, qualifiers, repeated values. It reproduces exactly, and a reviewer can confirm or dismiss it from the evidence alone.</p></div>
          <div><b>Every alert carries its chain</b><p>Origin, assertion, corroboration, correction — each step links to the source event with timestamp and actor, so nothing has to be taken on trust.</p></div>
          <div><b>Honest about what it can't see</b><p>Severity is tiered by whether a claim was ever contradicted. Counts come with denominators. Detectors that don't apply to a corpus say so.</p></div>
        </div>
      </div></section>

      <footer><div className="wrap"><div className="row"><span className="wordmark">TRIP<b>WIRE</b></span><a href="./workbench.html">Workbench</a><a href="./workbench.html?view=analytics">Analytics</a></div></div></footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><MotionConfig reducedMotion="user"><App /></MotionConfig></StrictMode>);
