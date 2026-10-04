import type { Alert, Data, Replay } from "../lib/data";
import { AnalyticsView } from "../components/analytics/AnalyticsView";

/** Corpus-level and incident-level charts, in sections. */
export function AnalyticsPage({ d, rp, alert }: { d: Data; rp: Replay | null; alert: Alert }) {
  return (
    <div className="page">
      <div className="page-head"><div><h1>Analytics</h1>
        <p>How the pipeline reduced the corpus to alerts, how long each phantom lived, how the selected claim spread, and what the corpus looks like over time.</p></div></div>
      <AnalyticsView d={d} rp={rp} alert={alert} stage={1} />
    </div>
  );
}
