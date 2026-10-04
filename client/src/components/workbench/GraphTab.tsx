import { useMemo } from "react";
import { ForceGraph } from "./ForceGraph";
import type { Replay } from "../../lib/data";
import { buildGraph } from "../../lib/data";

/* Link analysis: who carried the claim, where it was written, and which calls
 * fetched it again. The simulation is run to rest synchronously so positions
 * are deterministic; the entrance is animated, the layout is not. */

export function GraphTab({ rp, sel, onSel, bare = false }: { rp: Replay | null; stage?: number; sel: string | null; onSel: (id: string | null) => void; bare?: boolean }) {
  const g = useMemo(() => (rp ? buildGraph(rp) : null), [rp]);
  const byId = useMemo(() => new Map((g?.nodes ?? []).map(n => [n.id, n])), [g]);
  const selected = sel ? byId.get(sel) : null;
  const selEdges = g && sel ? g.edges.filter(e => e.source === sel || e.target === sel) : [];
  const KC: Record<string, string> = { claim: "var(--st-critical)", oracle: "var(--m-requery)", actor: "var(--ink-2)", artifact: "var(--m-contam)" };
  return (
    <div className="pane">
      {!bare && <h2><span className="t">Link analysis</span><span className="d">who carried the claim, where it was written, what fetched it again</span></h2>}
      <div className="glegend">
        <span><i style={{ borderColor: "var(--st-critical)" }} />the claim</span>
        <span><i style={{ borderColor: "var(--ink-2)", background: "var(--s-3)" }} />agent · size = messages carrying it</span>
        <span><i style={{ borderColor: "var(--st-good)", background: "var(--st-good)" }} />human</span>
        <span><i style={{ borderColor: "var(--m-requery)" }} />history oracle</span>
        <span><i style={{ borderColor: "var(--m-contam)" }} />artifact</span>
        <span><i className="line" style={{ borderColor: "rgba(217,89,38,.75)" }} />written to an artifact (particles flow outward)</span>
        <span><i className="line" style={{ borderColor: "rgba(57,135,229,.75)" }} />fetched from the oracle</span>
        <span className="help">drag to pan · scroll to zoom · drag a node · click to isolate</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{rp ? <ForceGraph rp={rp} sel={sel} onSel={onSel} /> : null}</div>
      <div className="gdet">
        {selected ? <>
          <div className="n" style={{ color: KC[selected.kind] }}>{selected.label}</div>
          <div className="k">{selected.kind}{selected.human ? " · human" : ""} · {selected.weight} {selected.kind === "actor" ? "messages carrying the claim" : selected.kind === "artifact" ? "contaminating citations" : "records"}</div>
          <div className="list">{selEdges.slice(0, 8).map((e, i) => { const other = e.source === selected.id ? e.target : e.source;
            return <div key={i}>{byId.get(other)?.label} <span style={{ color: "var(--ink-3)" }}>· {e.kind} ×{e.weight}</span></div>; })}</div>
        </> : <><div className="n" style={{ color: "var(--ink-3)", fontWeight: 500, fontSize: 12 }}>Nothing selected</div>
          <div className="k">Hover to highlight a node's neighbourhood; click to keep it. The largest agent node is the one that repeated the claim most.</div></>}
      </div>
    </div>
  );
}
