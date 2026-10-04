/** Shapes of data/out/alerts.json and the analytics derived from it client-side. */

export type Role = "origin" | "assertion" | "corroboration" | "correction" | "mention" | "requery" | "contamination";

export interface Evidence {
  role: Role; note: string; ts: string; actor: string | null; surface: string; kind: string;
  scope: string | null; query: string | null; text: string; native_id: string | null;
}
export interface Alert {
  detector: string; severity: "high" | "medium" | "low"; claim: string; summary: string;
  fired_at: string; actors: string[]; metrics: Record<string, any>; chain: Evidence[];
}
export interface TrackItem {
  ts: string; actor: string | null; is_human: boolean; surface: string; role: Role;
  scope: string | null; query: string | null; text: string; artifacts: string[];
}
export interface Replay {
  claim: string; value: number; window: { start: string; end: string }; span_days: number;
  detection_lag_s: number | null; artifact_surfaces: string[];
  counts: { records: number; actors: number; contaminations: number; requeries: number };
  track: TrackItem[];
}
export interface Scorecard {
  corpus: string; records: number; chat_messages: number; retrievals: number; bounded_retrievals: number;
  alerts: number; high_severity: number; phantom_facts: number; corrected_by_human: number;
  corrected_by_agent: number; median_detection_lag_s: number | null; median_correction_lag_s: number | null;
  median_time_to_strip_s?: number | null; median_phantom_lifetime_s?: number | null;
  reduction_ratio: number | null; share_of_corrections_requiring_a_human: number | null; speedup_vs_swarm?: number;
  incidents?: { claim: string; time_to_strip_s: number | null; lifetime_s: number | null; corrected_by: string; corrected_by_human: boolean; scope: string | null }[];
}
export interface Stage { stage: string; label: string; n: number }
export interface Pipeline { ingest: Stage[]; scope_strip: Stage[]; leading_query: Stage[]; output: Stage[] }
export interface Charts { scope_width_hist: { width: number; n: number }[]; weekly: { week: string; chat: number; retrievals: number; human: number }[] }
export interface Data {
  generated_at: string; corpus?: { name: string; title: string; supports: string[] };
  skipped_detectors?: { detector: string; missing: string }[];
  scorecard: Scorecard; pipeline?: Pipeline; charts?: Charts; alerts: Alert[]; replays: Replay[];
}

/** citation count per artifact surface, from the track */
export function artifactCounts(rp: Replay): { host: string; n: number }[] {
  const c = new Map<string, number>();
  for (const t of rp.track) for (const a of t.artifacts) {
    const host = a.replace(/^https?:\/\//, "").split(/[/\s`]/)[0].replace(/^www\./, "").slice(0, 26) || a.slice(0, 20);
    c.set(host, (c.get(host) ?? 0) + 1);
  }
  return [...c.entries()].map(([host, n]) => ({ host, n })).sort((a, b) => b.n - a.n);
}

export async function loadData(): Promise<Data> {
  const r = await fetch("/data/out/alerts.json", { cache: "no-store" });
  if (!r.ok) throw new Error(`alerts.json ${r.status}`);
  return r.json();
}

/* ── formatting ── */
const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
export function dur(s: number | null | undefined): string {
  if (s == null) return "—";
  if (s < 60) return s < 10 ? s.toFixed(2) + "s" : Math.round(s) + "s";
  if (s < 3600) return Math.floor(s / 60) + "m " + pad(s % 60) + "s";
  if (s < 86400) return Math.floor(s / 3600) + "h " + pad((s % 3600) / 60) + "m";
  return Math.floor(s / 86400) + "d " + pad((s % 86400) / 3600) + "h";
}
export const tplus = (s: number) => `+${pad(s / 86400)}d ${pad((s % 86400) / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
export const MILESTONE: Record<string, string> = {
  origin: "ORACLE ANSWER", assertion: "BOUND STRIPPED", corroboration: "ORACLE CONFIRMS", correction: "HUMAN CORRECTION",
};
export const ROLE_COLOR: Record<Role, string> = {
  mention: "var(--m-mention)", requery: "var(--m-requery)", contamination: "var(--m-contam)",
  origin: "var(--m-requery)", assertion: "var(--st-critical)", corroboration: "var(--m-contam)", correction: "var(--st-good)",
};

/* ── derived analytics ── */
export interface ActorStat { actor: string; human: boolean; total: number; roles: Partial<Record<Role, number>>; first: string; last: string }

export function actorSpread(rp: Replay): ActorStat[] {
  const m = new Map<string, ActorStat>();
  for (const t of rp.track) {
    const a = t.actor ?? "unknown";
    const s = m.get(a) ?? { actor: a, human: t.is_human, total: 0, roles: {}, first: t.ts, last: t.ts };
    s.total++; s.roles[t.role] = (s.roles[t.role] ?? 0) + 1;
    if (t.ts < s.first) s.first = t.ts; if (t.ts > s.last) s.last = t.ts;
    m.set(a, s);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export function roleMix(rp: Replay): { role: Role; n: number }[] {
  const c = new Map<Role, number>();
  for (const t of rp.track) c.set(t.role, (c.get(t.role) ?? 0) + 1);
  const order: Role[] = ["mention", "contamination", "requery", "origin", "assertion", "corroboration", "correction"];
  return order.filter(r => c.has(r)).map(r => ({ role: r, n: c.get(r)! }));
}

export function perDay(rp: Replay): { day: string; n: number; contam: number }[] {
  const c = new Map<string, { n: number; contam: number }>();
  for (const t of rp.track) {
    const d = t.ts.slice(0, 10);
    const v = c.get(d) ?? { n: 0, contam: 0 };
    v.n++; if (t.role === "contamination") v.contam++;
    c.set(d, v);
  }
  return [...c.entries()].sort().map(([day, v]) => ({ day, ...v }));
}

export function velocity(rp: Replay) {
  const t0 = Date.parse(rp.window.start);
  const firstContam = rp.track.find(t => t.role === "contamination");
  const corr = rp.track.find(t => t.role === "correction");
  return {
    firstContaminationS: firstContam ? (Date.parse(firstContam.ts) - t0) / 1000 : null,
    correctionS: corr ? (Date.parse(corr.ts) - t0) / 1000 : null,
    msgsPerDay: rp.span_days > 0 ? rp.counts.records / rp.span_days : null,
    humanShare: rp.track.filter(t => t.is_human).length / Math.max(1, rp.track.length),
  };
}

/* ── link graph ── */
export type NodeKind = "claim" | "actor" | "artifact" | "oracle";
export interface GNode { id: string; kind: NodeKind; label: string; weight: number; human?: boolean; x?: number; y?: number; fx?: number | null; fy?: number | null }
export interface GEdge { source: string; target: string; weight: number; kind: "mention" | "contamination" | "requery" }

export function buildGraph(rp: Replay): { nodes: GNode[]; edges: GEdge[] } {
  const nodes = new Map<string, GNode>();
  const edges = new Map<string, GEdge>();
  const claimId = `claim:${rp.claim}`;
  nodes.set(claimId, { id: claimId, kind: "claim", label: rp.claim, weight: rp.counts.records });
  nodes.set("oracle", { id: "oracle", kind: "oracle", label: "history oracle", weight: rp.counts.requeries + 1 });
  const addEdge = (s: string, t: string, kind: GEdge["kind"]) => {
    const k = `${s}→${t}:${kind}`; const e = edges.get(k) ?? { source: s, target: t, weight: 0, kind };
    e.weight++; edges.set(k, e);
  };
  for (const t of rp.track) {
    const a = `actor:${t.actor ?? "unknown"}`;
    const n = nodes.get(a) ?? { id: a, kind: "actor", label: t.actor ?? "unknown", weight: 0, human: t.is_human };
    n.weight++; nodes.set(a, n);
    if (t.role === "requery" || t.role === "origin") addEdge(a, "oracle", "requery");
    else addEdge(a, claimId, t.role === "contamination" ? "contamination" : "mention");
    for (const art of t.artifacts.slice(0, 2)) {
      const host = art.replace(/^https?:\/\//, "").split(/[/\s`]/)[0].replace(/^www\./, "").slice(0, 22) || art.slice(0, 18);
      const id = `art:${host}`;
      const an = nodes.get(id) ?? { id, kind: "artifact", label: host, weight: 0 };
      an.weight++; nodes.set(id, an);
      addEdge(a, id, "contamination");
    }
  }
  // keep the graph legible: cap artifacts to the most-cited eight
  const arts = [...nodes.values()].filter(n => n.kind === "artifact").sort((a, b) => b.weight - a.weight);
  for (const drop of arts.slice(8)) {
    nodes.delete(drop.id);
    for (const [k, e] of edges) if (e.target === drop.id) edges.delete(k);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
