import type { Page } from "../hooks/usePage";
import type { Data } from "../lib/data";
import { fmtInt } from "../lib/data";

const NAV: { id: Page; label: string; hint: string }[] = [
  { id: "alerts", label: "Alerts", hint: "what fired, and why" },
  { id: "timeline", label: "Timeline", hint: "replay a claim's life" },
  { id: "graph", label: "Graph", hint: "who carried it, where it went" },
  { id: "spread", label: "Spread", hint: "how fast, how far" },
  { id: "records", label: "Records", hint: "every message, searchable" },
  { id: "analytics", label: "Analytics", hint: "pipeline and corpus charts" },
];

const Icon = ({ id }: { id: Page }) => {
  const s = { stroke: "currentColor", strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "alerts": return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 12V8a5 5 0 0 1 10 0v4l1.5 2h-13z" {...s} /><path d="M7.5 15a1.5 1.5 0 0 0 3 0" {...s} /></svg>;
    case "timeline": return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 14h12M5 14V9M9 14V5M13 14v-6" {...s} /><path d="M6.5 3l3 2-3 2z" fill="currentColor" /></svg>;
    case "graph": return <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="2.2" {...s} /><circle cx="4" cy="4.5" r="1.5" {...s} /><circle cx="14" cy="4.5" r="1.5" {...s} /><circle cx="9" cy="15" r="1.5" {...s} /><path d="M5.2 5.6l2.6 2.2M12.8 5.6l-2.6 2.2M9 11.2v2.3" {...s} /></svg>;
    case "spread": return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 4h7M3 9h11M3 14h5" {...s} /></svg>;
    case "records": return <svg width="18" height="18" viewBox="0 0 18 18"><rect x="2.5" y="3.5" width="13" height="11" rx="1.5" {...s} /><path d="M2.5 7.5h13M7 7.5v7" {...s} /></svg>;
    default: return <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 14l4-5 3 3 5-6" {...s} /><path d="M11 6h4v4" {...s} /></svg>;
  }
};

export function Sidebar({ page, onPage, d, collapsed, onToggle }: { page: Page; onPage: (p: Page) => void; d: Data | null; collapsed: boolean; onToggle: () => void }) {
  const c = d?.scorecard;
  return (
    <aside className={`side${collapsed ? " collapsed" : ""}`} aria-expanded={!collapsed}>
      <div className="sidetop">
        <a className="wordmark" href="./" title="Tripwire">{collapsed ? <>T<b>W</b></> : <>TRIP<b>WIRE</b></>}</a>
        <button className="collapse" onClick={onToggle} title={collapsed ? "Expand sidebar  [" : "Collapse sidebar  ["} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: collapsed ? "rotate(180deg)" : undefined }}>
            <path d="M8.5 2.5L4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <nav>{NAV.map(n => (
        <button key={n.id} className="navb" aria-current={page === n.id ? "page" : undefined} onClick={() => onPage(n.id)}
          title={collapsed ? `${n.label} — ${n.hint}` : undefined}>
          <span className="ic"><Icon id={n.id} /></span>
          <span className="txt"><span className="l">{n.label}</span><span className="h">{n.hint}</span></span>
        </button>))}</nav>
      {c && <div className="sidefoot" title={collapsed ? `${c.corpus} · ${fmtInt(c.records)} records · ${c.alerts} alerts` : undefined}>
        <div><span>corpus</span><b>{c.corpus}</b></div>
        <div><span>records</span><b>{fmtInt(c.records)}</b></div>
        <div><span>alerts</span><b>{c.alerts} · {c.phantom_facts} phantoms</b></div>
      </div>}
    </aside>
  );
}
