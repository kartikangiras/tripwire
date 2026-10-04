import { useMemo } from "react";
import type { Data } from "../lib/data";
import { ContextBar } from "../components/ContextBar";
import { SpreadTab } from "../components/workbench/SpreadTab";

/** How the claim moved. */
export function SpreadPage({ d, sel, onSel }: { d: Data; sel: number; onSel: (i: number) => void }) {
  const a = d.alerts[sel];
  const rp = useMemo(() => d.replays.find(r => r.claim === a.claim) ?? null, [d, a]);
  return (
    <div className="page narrow">
      <ContextBar alerts={d.alerts} sel={sel} onSel={onSel} title="Spread"
        blurb="Who carried the claim and how often, what each message did with it, how many per day, and the two moments that matter: first contamination and correction." />
      {rp ? <div className="spread"><SpreadTab bare rp={rp} stage={1} /></div> : <div className="empty">No replay track for this alert.</div>}
    </div>
  );
}
