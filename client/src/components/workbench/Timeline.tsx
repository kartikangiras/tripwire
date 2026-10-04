import { motion } from "framer-motion";
import type { Alert, Replay } from "../../lib/data";
import { ROLE_COLOR, tplus } from "../../lib/data";
import { STRIP } from "../../lib/motion";
import { TimelineChart } from "../charts";

interface Props {
  rp: Replay | null; alerts: Alert[]; claim: string; cur: number; t0: number; t1: number;
  playing: boolean; rate: number; stage: number; onToggle: () => void; onRate: () => void; onScrub: (t: number) => void;
}

export function Timeline(p: Props) {
  return (
    <motion.div className="pane" initial={{ opacity: 0, x: STRIP.offsetX }} animate={{ opacity: p.stage >= 1 ? 1 : 0, x: p.stage >= 1 ? 0 : STRIP.offsetX }} transition={STRIP.spring}>
      <h2><span className="t">Timeline</span><span className="d">the claim's whole life — ticks are messages that carried it, rules are the milestones; click to scrub</span></h2>
      <div className="transport">
        <button className="ctl" onClick={p.onToggle}>{p.playing ? "❚❚ PAUSE" : "▶ REPLAY"}</button>
        <button className="ctl" aria-pressed={p.rate !== 1} onClick={p.onRate}>{p.rate}×</button>
        <div className="clock mono">T<b>{tplus(Math.max(0, (p.cur - p.t0) / 1000))}</b></div>
        <span className="help"><span className="kbd">space</span> play / pause</span>
        <div className="legend">
          {(["mention", "requery", "contamination"] as const).map(r => <span className="lg" key={r}><i style={{ background: ROLE_COLOR[r] }} />{r === "requery" ? "re-query" : r}</span>)}
          <span className="lg"><i style={{ background: "var(--ink-2)", width: 2, height: 11 }} />milestone</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "2px 8px 6px 0", position: "relative" }}>
        {p.rp ? <div style={{ position: "absolute", inset: "2px 8px 6px 0" }}><TimelineChart rp={p.rp} alerts={p.alerts} cur={p.cur} onScrub={p.onScrub} /></div> : <div className="empty">No replay track for this alert.</div>}
      </div>
    </motion.div>
  );
}
