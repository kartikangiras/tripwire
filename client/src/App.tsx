import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAlertsData } from "./hooks/useAlertsData";
import { usePage } from "./hooks/usePage";
import { useSidebar } from "./hooks/useSidebar";
import { Sidebar } from "./components/Sidebar";
import { AlertsPage } from "./pages/AlertsPage";
import { TimelinePage } from "./pages/TimelinePage";
import { GraphPage } from "./pages/GraphPage";
import { SpreadPage } from "./pages/SpreadPage";
import { RecordsPage } from "./pages/RecordsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

/* One page per function, a sidebar to move between them, and one alert in
 * context across all of them. */
export default function App() {
  const { data: d, error, sel: recommended } = useAlertsData();
  const pg = usePage();
  const sb = useSidebar();
  const reduce = useReducedMotion();
  const sel = pg.alertIdx ?? recommended;

  let body: React.ReactNode;
  if (error) body = <div className="empty">Could not load <span className="mono">data/out/alerts.json</span> — run <span className="mono">uv run tripwire scan</span>, then <span className="mono">uv run tripwire ui</span>. ({error})</div>;
  else if (!d || !d.alerts[sel]) body = <div className="empty">Loading…</div>;
  else {
    const a = d.alerts[sel], rp = d.replays.find(r => r.claim === a.claim) ?? null;
    const P = { d, sel, onSel: pg.setAlertIdx };
    body = pg.page === "alerts" ? <AlertsPage {...P} onPage={pg.setPage} />
      : pg.page === "timeline" ? <TimelinePage {...P} />
      : pg.page === "graph" ? <GraphPage {...P} />
      : pg.page === "spread" ? <SpreadPage {...P} />
      : pg.page === "records" ? <RecordsPage {...P} />
      : <AnalyticsPage d={d} rp={rp} alert={a} />;
  }

  return (
    <div className="layout" data-collapsed={sb.collapsed || undefined}>
      <Sidebar page={pg.page} onPage={pg.setPage} d={d} collapsed={sb.collapsed} onToggle={sb.toggle} />
      <main className="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pg.page} style={{ height: "100%" }}
            initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.33, 1, 0.68, 1] }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
