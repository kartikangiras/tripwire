import type { Alert } from "../lib/data";

/** The alert being investigated, shown on every alert-scoped page, with a way to switch. */
export function ContextBar({ alerts, sel, onSel, title, blurb }: { alerts: Alert[]; sel: number; onSel: (i: number) => void; title: string; blurb: string }) {
  const a = alerts[sel];
  return (
    <div className="page-head">
      <div><h1>{title}</h1><p>{blurb}</p></div>
      <label className="ctx">
        <span className="micro">investigating</span>
        <select value={sel} onChange={e => onSel(+e.target.value)}>
          {alerts.map((x, i) => <option key={i} value={i}>{x.claim} · {x.severity} · {x.detector.replace("_", " ")}</option>)}
        </select>
        <span className={`sev ${a.severity}`}>{a.severity.toUpperCase()}</span>
      </label>
    </div>
  );
}
