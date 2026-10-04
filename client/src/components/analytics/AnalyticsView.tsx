import type { Alert, Data, Replay } from "../../lib/data";
import { actorSpread, artifactCounts, dur, perDay, roleMix } from "../../lib/data";
import { Funnel, HBars, Lifetime, PerDay, RoleMix, ScopeWidths, SpreadArea, Weekly } from "../charts";
import { C } from "../charts/theme";

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <div className="ac"><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}<div className="plot">{children}</div></div>;
}

const GROUPS: { key: keyof NonNullable<Data["pipeline"]>; title: string; color: string }[] = [
  { key: "ingest", title: "Ingest", color: C.ink2 }, { key: "scope_strip", title: "Scope strip", color: C.requery },
  { key: "leading_query", title: "Leading query", color: C.contam }, { key: "output", title: "Output", color: C.critical },
];

export function AnalyticsView({ d, rp, alert }: { d: Data; rp: Replay | null; alert: Alert; stage?: number }) {
  const c = d.scorecard, ch = d.charts;
  const actors = rp ? actorSpread(rp) : [], mix = rp ? roleMix(rp) : [], days = rp ? perDay(rp) : [], arts = rp ? artifactCounts(rp).slice(0, 10) : [];
  const originWidth = alert.metrics?.scope_width_days as number | undefined;
  return (
    <div className="asections">
      <section className="asec"><h2>Pipeline</h2><p className="help">How the corpus became alerts — every stage counted, per detector.</p>
        <div className="arow two">
          <div className="stack">{d.pipeline && GROUPS.map(g => <Card key={g.key} title={g.title}><Funnel stages={d.pipeline![g.key]} color={g.color} height={Math.max(90, 26 * d.pipeline![g.key].length + 12)} /></Card>)}</div>
          <div className="stack">
            <Card title="Each phantom's life" sub="log-time · when its bound was dropped (tripwire fires) and when it was finally contradicted"><Lifetime incidents={c.incidents ?? []} /></Card>
            <div className="stat2">
              <div><div className="micro">median phantom lifetime</div><div className="v mono">{dur(c.median_phantom_lifetime_s ?? c.median_correction_lag_s)}</div><div className="k">n = {c.phantom_facts} · an incident count, not a population rate</div></div>
              <div><div className="micro">corrections by a human</div><div className="v mono">{c.share_of_corrections_requiring_a_human == null ? "—" : (c.share_of_corrections_requiring_a_human * 100).toFixed(0) + "%"}</div><div className="k">{c.corrected_by_human} human · {c.corrected_by_agent} agent</div></div>
            </div>
          </div>
        </div>
      </section>
      {rp && <section className="asec"><h2>Spread of {rp.claim}</h2><p className="help">The selected alert's claim: how it accumulated, who carried it, and where it was written.</p>
        <Card title="Cumulative spread" sub={`messages carrying ${rp.claim} over ${rp.span_days} days · milestones as rules`}><SpreadArea rp={rp} alerts={d.alerts} /></Card>
        <div className="arow three">
          <Card title="Who carried it" sub="messages per actor"><HBars rows={actors.map(a => ({ label: a.actor, n: a.total, color: a.human ? C.good : undefined }))} color={C.ink2} /></Card>
          <Card title="Messages per day" sub="citing an artifact vs. other"><PerDay days={days} /></Card>
          <Card title="Artifact surfaces" sub="where the claim was written down"><HBars rows={arts.map(a => ({ label: a.host, n: a.n }))} color={C.contam} labelWidth={150} unit="citations" /></Card>
        </div>
        <Card title="Role mix" sub="what each message did with the claim"><RoleMix mix={mix} /></Card>
      </section>}
      {ch && <section className="asec"><h2>Corpus</h2><p className="help">What the whole record looks like, independent of any one alert.</p>
        <div className="arow two">
          <Card title="Retrieval scope widths" sub={`how far back each bounded retrieval looked${originWidth ? ` · the selected phantom's origin was a ${originWidth}-day window (dark bar)` : ""}`}><ScopeWidths hist={ch.scope_width_hist} highlight={originWidth} /></Card>
          <Card title="Activity by week" sub="agent messages · retrievals · human messages — one axis each, cursors synced"><Weekly weekly={ch.weekly} /></Card>
        </div>
      </section>}
    </div>
  );
}
