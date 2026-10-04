import { useMemo, useState } from "react";
import type { Data, Role } from "../lib/data";
import { ROLE_COLOR } from "../lib/data";
import { ContextBar } from "../components/ContextBar";

const ROLES: Role[] = ["origin", "assertion", "corroboration", "mention", "requery", "contamination", "correction"];
const sq = (s: string) => s.replace(/\s+/g, " ");

/** Every message that carried the claim, as a table you can search and filter. */
export function RecordsPage({ d, sel, onSel }: { d: Data; sel: number; onSel: (i: number) => void }) {
  const a = d.alerts[sel];
  const rp = useMemo(() => d.replays.find(r => r.claim === a.claim) ?? null, [d, a]);
  const [q, setQ] = useState("");
  const [on, setOn] = useState<Set<Role>>(new Set(ROLES));
  const [open, setOpen] = useState<number | null>(null);
  const rows = useMemo(() => {
    if (!rp) return [];
    const needle = q.trim().toLowerCase();
    return rp.track.map((t, i) => ({ ...t, i })).filter(t => on.has(t.role) && (!needle || t.text.toLowerCase().includes(needle) || (t.actor ?? "").toLowerCase().includes(needle)));
  }, [rp, q, on]);
  const present = rp ? ROLES.filter(r => rp.track.some(t => t.role === r)) : [];
  return (
    <div className="page">
      <ContextBar alerts={d.alerts} sel={sel} onSel={onSel} title="Records"
        blurb="The raw record behind the alert: every message that carried the claim, in order. Search the text, filter by what each message did, click a row to read it in full." />
      {!rp ? <div className="empty">No replay track for this alert.</div> : <>
        <div className="toolbar">
          <input className="search" placeholder="Search message or actor…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="chips">{present.map(r => <button key={r} className="chipb" aria-pressed={on.has(r)}
            onClick={() => setOn(o => { const n = new Set(o); n.has(r) ? n.delete(r) : n.add(r); return n; })}>
            <i style={{ background: ROLE_COLOR[r] }} />{r}<span style={{ color: "var(--ink-3)" }}>{rp.track.filter(t => t.role === r).length}</span></button>)}</div>
          <span className="help">{rows.length} of {rp.track.length}</span>
        </div>
        <table className="tv wide">
          <thead><tr><th style={{ width: 150 }}>timestamp (UTC)</th><th style={{ width: 160 }}>actor</th><th style={{ width: 120 }}>role</th><th style={{ width: 70 }}>cites</th><th>message</th></tr></thead>
          <tbody>{rows.map(e => (
            <tr key={e.i} className={`${e.is_human ? "human " : ""}${open === e.i ? "open" : ""}`} onClick={() => setOpen(open === e.i ? null : e.i)}>
              <td className="mono">{e.ts.slice(0, 19).replace("T", " ")}</td>
              <td className="mono">{e.actor}</td>
              <td className={`mono r-${e.role}`}>{e.role}</td>
              <td className="mono">{e.artifacts.length || ""}</td>
              <td>{open === e.i ? <div className="full">{e.text}</div> : <div className="clamp">{sq(e.text)}</div>}</td>
            </tr>))}</tbody>
        </table>
      </>}
    </div>
  );
}
