import { motion } from "framer-motion";
import type { Alert } from "../../lib/data";
import { RAIL } from "../../lib/motion";

export function Inbox({ alerts, sel, onSel, loadStage, foot }: { alerts: Alert[]; sel: number; onSel: (i: number) => void; loadStage: number; foot?: React.ReactNode }) {
  const hi = alerts.filter(a => a.severity === "high").length;
  return (
    <div className="pane">
      <h2><span className="t">Alerts</span><span className="d">one per broken claim</span><span className="count">{alerts.length} · {hi} high</span></h2>
      <div className="scroll">
        {alerts.map((a, i) => (
          <motion.button key={a.detector + a.fired_at} className="alert" aria-selected={i === sel} onClick={() => onSel(i)}
            initial={{ opacity: 0, y: RAIL.itemY }}
            animate={{ opacity: loadStage >= 1 ? 1 : 0, y: loadStage >= 1 ? 0 : RAIL.itemY }}
            transition={{ ...RAIL.spring, delay: i * RAIL.stagger }}>
            <div className="top">
              <span className="claim">{a.claim}</span>
              <span className={`sev ${a.severity}`}>{a.severity.toUpperCase()}</span>
              <span className="det">{a.detector.replace("_", " ")}</span>
            </div>
            <div className="sum">{a.summary}</div>
          </motion.button>
        ))}
      </div>
      {foot && <div className="railfoot">{foot}</div>}
    </div>
  );
}
