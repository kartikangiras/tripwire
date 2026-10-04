import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Replay, Role, TrackItem } from "../../lib/data";
import { ROLE_COLOR } from "../../lib/data";
import { ROWS } from "../../lib/motion";

const sq = (s: string) => s.replace(/\s+/g, " ");

const ROLES: Role[] = ["origin", "assertion", "corroboration", "mention", "requery", "contamination", "correction"];

export function StreamTab({ rp, cur, table, onTable, bare = false }: { bare?: boolean; rp: Replay | null; cur: number; table: boolean; onTable?: (t: boolean) => void }) {
  const [on, setOn] = useState<Set<Role>>(new Set(ROLES));
  if (!rp) return <div className="empty">No replay track for this alert — only contradicted (HIGH) strips carry one.</div>;
  const present = ROLES.filter(r => rp.track.some(t => t.role === r));
  const past = rp.track.filter(e => Date.parse(e.ts) <= cur && on.has(e.role));
  const rows = (table ? rp.track : past).filter(e => on.has(e.role));
  const count = table
    ? `${rp.track.length} records · ${rp.counts.actors} actors · ${rp.counts.contaminations} contaminating`
    : `${past.length} / ${rp.track.length} records · ${rp.counts.actors} actors`;

  return (
    <div className="pane">
      {!bare && <h2><span className="t">Event stream</span><span className="d">every message that carried {rp.claim}, in order</span><span className="count">{count}</span>
        {onTable && <button className="ctl" style={{ marginLeft: 10 }} aria-pressed={table} onClick={() => onTable(!table)}>{table ? "FOLLOW REPLAY" : "SHOW ALL AS TABLE"}</button>}</h2>}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", alignItems: "center" }} className="chips">
        {bare && <span className="help" style={{ marginRight: 6 }}>{count}</span>}
        {bare && onTable && <button className="ctl" aria-pressed={table} onClick={() => onTable(!table)}>{table ? "FOLLOW REPLAY" : "SHOW ALL AS TABLE"}</button>}
        {present.map(r => <button key={r} className="chipb" aria-pressed={on.has(r)} onClick={() => setOn(o => { const n = new Set(o); n.has(r) ? n.delete(r) : n.add(r); return n; })}>
          <i style={{ background: ROLE_COLOR[r] }} />{r}<span style={{ color: "var(--ink-3)" }}>{rp.track.filter(t => t.role === r).length}</span></button>)}
      </div>
      <div className="scroll">
        {table ? <Table rows={rows} /> : past.length === 0
          ? <div className="empty">Press <b>▶ REPLAY</b> (or <span className="kbd">space</span>) to stream the {rp.track.length} messages that carried this claim as the playhead passes them — or <b>show all as table</b> to read them now.</div>
          : (
            <AnimatePresence initial={false}>
              {past.slice().reverse().map((e, i) => (
                <motion.div key={e.ts + (e.actor ?? "")} className={`row${e.is_human ? " human" : ""}`}
                  initial={{ opacity: 0, y: ROWS.offsetY }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ ...ROWS.spring, delay: Math.min(i, 8) * ROWS.stagger }}>
                  <div className="t">{e.ts.slice(5, 19).replace("T", " ")}</div>
                  <div className="a">{e.actor}</div>
                  <div className={`r r-${e.role}`}>{e.role}</div>
                  <div className="x">{sq(e.text).slice(0, 220)}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
      </div>
    </div>
  );
}

function Table({ rows }: { rows: TrackItem[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr>{["timestamp (UTC)", "actor", "role", "artifacts", "message"].map(h =>
        <th key={h} className="micro" style={{ textAlign: "left", padding: "10px 16px", borderBottom: "1px solid var(--line-2)", position: "sticky", top: 0, background: "var(--s-1)" }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((e, i) => (
        <tr key={i} className={e.is_human ? "human" : ""}>
          <td className="mono" style={td}>{e.ts.slice(0, 19).replace("T", " ")}</td>
          <td className="mono" style={td}>{e.actor}</td>
          <td className={`mono r-${e.role}`} style={td}>{e.role}</td>
          <td className="mono" style={td}>{e.artifacts.length || ""}</td>
          <td style={{ ...td, color: "var(--ink-2)", whiteSpace: "normal" }}>{sq(e.text).slice(0, 180)}</td>
        </tr>))}</tbody>
    </table>
  );
}
const td: React.CSSProperties = { padding: "9px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-3)", verticalAlign: "top", whiteSpace: "nowrap" };
