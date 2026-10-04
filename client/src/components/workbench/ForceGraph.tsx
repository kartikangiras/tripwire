import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GEdge, GNode, Replay } from "../../lib/data";
import { buildGraph } from "../../lib/data";

const KCOL: Record<string, string> = { claim: "#d03b3b", oracle: "#3987e5", actor: "#9aa1a8", artifact: "#d95926", human: "#0ca30c" };
const ECOL: Record<string, string> = { mention: "rgba(232,234,236,.22)", contamination: "rgba(217,89,38,.75)", requery: "rgba(57,135,229,.75)" };

type N = GNode & { x?: number; y?: number };

/** Link analysis on a real force simulation: pan, zoom, drag, hover, click to isolate. */
export function ForceGraph({ rp, sel, onSel }: { rp: Replay; sel: string | null; onSel: (id: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const fg = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const apply = (w: number, h: number) => { if (w > 40 && h > 40) setSize({ w, h }); };
    const r = el.getBoundingClientRect(); apply(r.width, r.height);
    const ro = new ResizeObserver(([e]) => apply(e.contentRect.width, e.contentRect.height)); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graph = useMemo(() => {
    const { nodes, edges } = buildGraph(rp);
    for (const n of nodes) { n.fx = null; n.fy = null; }
    return { nodes: nodes as N[], links: edges.map(e => ({ ...e })) };
  }, [rp]);
  const maxW = Math.max(1, ...graph.nodes.map(n => n.weight));
  const radius = useCallback((n: N) => (n.kind === "claim" ? 16 : n.kind === "oracle" ? 10 : 4 + 11 * Math.sqrt(n.weight / maxW)), [maxW]);

  const focus = sel ?? hover;
  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    for (const l of graph.links as GEdge[]) { const a = typeof l.source === "object" ? (l.source as any).id : l.source, b = typeof l.target === "object" ? (l.target as any).id : l.target;
      if (a === focus) s.add(b); if (b === focus) s.add(a); }
    return s;
  }, [focus, graph]);

  useEffect(() => { const f = fg.current; if (!f) return;
    f.d3Force("charge")?.strength(-220); f.d3Force("link")?.distance((l: any) => (l.kind === "requery" ? 120 : 70 + 40 / Math.sqrt(l.weight)));
    setTimeout(() => f.zoomToFit(400, 60), 500);
  }, [graph]);

  const paint = useCallback((node: N, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = radius(node), dim = near && !near.has(node.id);
    const col = node.kind === "actor" && node.human ? KCOL.human : KCOL[node.kind];
    ctx.globalAlpha = dim ? 0.18 : 1;
    ctx.beginPath(); ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.kind === "actor" ? (node.human ? KCOL.human : "#1b1f25") : "#101216"; ctx.fill();
    ctx.lineWidth = (node.id === sel ? 2.5 : 1.5) / scale; ctx.strokeStyle = node.id === sel ? "#e8eaec" : col; ctx.stroke();
    const fs = Math.max(10 / scale, 3);
    ctx.font = `${node.kind === "claim" ? "600 " : ""}${fs}px ui-monospace, Menlo, monospace`; ctx.textBaseline = "middle";
    if (node.kind === "claim") { ctx.textAlign = "center"; ctx.fillStyle = KCOL.claim; ctx.fillText(node.label, node.x!, node.y!); }
    else { ctx.textAlign = "left"; ctx.fillStyle = node.human ? KCOL.human : "#c3c8cd"; ctx.fillText(node.label, node.x! + r + 4 / scale, node.y!); }
    ctx.globalAlpha = 1;
  }, [radius, near, sel]);

  return (
    <div ref={box} style={{ width: "100%", height: "100%" }}>
      <ForceGraph2D ref={fg} width={size.w} height={size.h} graphData={graph} backgroundColor="rgba(0,0,0,0)"
        nodeId="id" nodeVal={(n: any) => radius(n) * radius(n) / 40} nodeLabel={(n: any) => `${n.label} · ${n.kind}${n.human ? " · human" : ""} · ${n.weight}`}
        nodeCanvasObject={paint as any} nodePointerAreaPaint={(n: any, color: string, ctx: CanvasRenderingContext2D) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(n.x, n.y, radius(n) + 6, 0, 2 * Math.PI); ctx.fill(); }}
        linkColor={(l: any) => near && !(near.has(typeof l.source === "object" ? l.source.id : l.source) && near.has(typeof l.target === "object" ? l.target.id : l.target)) ? "rgba(128,136,144,.06)" : ECOL[l.kind]}
        linkWidth={(l: any) => Math.min(6, 0.8 + Math.log2(l.weight + 1))}
        linkDirectionalParticles={(l: any) => (l.kind === "contamination" ? 2 : 0)} linkDirectionalParticleWidth={2.2} linkDirectionalParticleColor={() => "#d95926"}
        onNodeClick={(n: any) => onSel(sel === n.id ? null : n.id)} onBackgroundClick={() => onSel(null)} onNodeHover={(n: any) => setHover(n ? n.id : null)}
        cooldownTicks={120} warmupTicks={60} />
    </div>
  );
}
