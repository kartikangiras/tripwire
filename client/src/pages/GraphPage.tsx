import { useMemo, useState } from "react";
import type { Data } from "../lib/data";
import { ContextBar } from "../components/ContextBar";
import { GraphTab } from "../components/workbench/GraphTab";

/** Link analysis, full height. */
export function GraphPage({ d, sel, onSel }: { d: Data; sel: number; onSel: (i: number) => void }) {
  const a = d.alerts[sel];
  const rp = useMemo(() => d.replays.find(r => r.claim === a.claim) ?? null, [d, a]);
  const [g, setG] = useState<string | null>(null);
  return (
    <div className="page fill">
      <ContextBar alerts={d.alerts} sel={sel} onSel={onSel} title="Graph"
        blurb="The claim at the centre. Agents scale with how often they carried it; orange edges go to artifacts it was written into, blue edges to the oracle that served it again. Click a node to isolate its neighbours." />
      <div className="fillbox">{rp ? <GraphTab bare rp={rp} stage={1} sel={g} onSel={setG} /> : <div className="empty">No replay track for this alert.</div>}</div>
    </div>
  );
}
