import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { Alert, Replay, Stage, Role } from "../../lib/data";
import { C, ROLE, fmtDay, fmtDur, fmtInt, tick, tipStyle } from "./theme";

/** Milestone label that staggers into lanes so near-simultaneous rules stay readable. */
function laneLabels(miles: { ts: string; role: string }[], t0: number, t1: number, pxWidth: number, charW = 6.2) {
  const placed: [number, number][][] = [];
  return miles.map(m => {
    const frac = (Date.parse(m.ts) - t0) / Math.max(1, t1 - t0);
    const x = frac * pxWidth, label = (MILESTONE_LBL[m.role] ?? m.role).toUpperCase();
    const w = label.length * charW + 8, flip = frac > 0.72;
    const x0 = flip ? x - w : x, x1 = x0 + w;
    let lane = 0; while ((placed[lane] ?? []).some(([a, b]) => x0 < b + 6 && x1 > a - 6)) lane++;
    (placed[lane] = placed[lane] ?? []).push([x0, x1]);
    return { ...m, label, lane, flip };
  });
}
const MILESTONE_LBL: Record<string, string> = { origin: "oracle answer", assertion: "bound stripped", corroboration: "oracle confirms", correction: "correction" };
const MileLabel = (p: any) => {
  const { viewBox, lane, flip, text, fill } = p; const x = viewBox.x, y = (viewBox.y ?? 0) + 10 + lane * 12;
  return <text x={x + (flip ? -5 : 5)} y={y} fill={fill} fontSize={9.5} fontWeight={600} fontFamily="ui-monospace, Menlo, monospace" textAnchor={flip ? "end" : "start"}>{text}</text>;
};

/* ── Funnel: one horizontal bar chart per detector group, counts labelled ── */
export function Funnel({ stages, color, height = 150 }: { stages: Stage[]; color: string; height?: number }) {
  const data = stages.map(s => ({ name: s.label, n: s.n, hi: s.stage === "high" || s.stage === "phantom" }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 64, bottom: 2, left: 4 }} barCategoryGap={5}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="name" width={190} tick={tick} axisLine={false} tickLine={false} />
        <Tooltip {...tipStyle} formatter={(v: any) => [fmtInt(v), "records"]} />
        <Bar dataKey="n" radius={2} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.hi ? C.critical : color} />)}
          <LabelList dataKey="n" position="right" formatter={(v: any) => fmtInt(v)} style={{ ...tick, fill: "currentColor" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Lifetime: each phantom on a log-time axis, strip → correction ── */
const LOG_TICKS = [1, 60, 3600, 86400, 864000, 8640000];
const tickDur = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`);
export function Lifetime({ incidents, height = 190 }: { incidents: { claim: string; time_to_strip_s: number | null; lifetime_s: number | null; corrected_by: string; corrected_by_human: boolean }[]; height?: number }) {
  const rows = incidents.filter(i => i.time_to_strip_s != null && i.lifetime_s != null).map(i => ({
    claim: i.claim, strip: Math.max(1, i.time_to_strip_s!), fix: Math.max(1, i.time_to_strip_s! + i.lifetime_s!), by: i.corrected_by, human: i.corrected_by_human,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} layout="vertical" margin={{ top: 8, right: 24, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={C.grid} />
        <XAxis type="number" scale="log" domain={[1, 8640000]} ticks={LOG_TICKS} tickFormatter={tickDur} tick={tick} axisLine={{ stroke: C.axis }} tickLine={false} />
        <YAxis type="category" dataKey="claim" width={62} interval={0} tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip {...tipStyle} formatter={(v: any, name: any) => [fmtDur(v), name === "strip" ? "bound dropped after" : "corrected after"]} />
        <Scatter dataKey="strip" fill={C.critical} shape={(p: any) => <rect x={p.cx - 2} y={p.cy - 9} width={4} height={18} fill={C.critical} rx={1} />} isAnimationActive={false} />
        <Scatter dataKey="fix" shape={(p: any) => <circle cx={p.cx} cy={p.cy} r={6} fill={p.payload.human ? C.good : C.ink2} />} isAnimationActive={false} />
        {rows.map(r => <ReferenceLine key={r.claim} segment={[{ x: r.strip, y: r.claim }, { x: r.fix, y: r.claim }]} stroke={C.axis} strokeWidth={2} />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ── Cumulative spread with milestone rules ── */
export function SpreadArea({ rp, alerts, height = 220, light = false }: { rp: Replay; alerts: Alert[]; height?: number; light?: boolean }) {
  const data = rp.track.map((e, i) => ({ t: Date.parse(e.ts), n: i + 1, actor: e.actor, role: e.role }));
  const miles = alerts.filter(a => a.claim === rp.claim).flatMap(a => a.chain)
    .filter((s, i, arr) => arr.findIndex(z => z.ts === s.ts && z.role === s.role) === i);
  const t0 = Date.parse(rp.window.start), t1 = Date.parse(rp.window.end);
  const labels = laneLabels(miles, t0, t1, 900);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 30, right: 18, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtDay} tick={tick} axisLine={{ stroke: C.axis }} tickLine={false} minTickGap={40} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
        <Tooltip {...tipStyle} labelFormatter={(t: any) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + "Z"}
          formatter={(v: any, _n: any, p: any) => [`${v} messages · latest: ${p.payload.actor} (${p.payload.role})`, "cumulative"]} />
        <Area type="stepAfter" dataKey="n" stroke={light ? "#141414" : C.ink} fill={light ? "rgba(20,20,20,.07)" : "rgba(232,234,236,.08)"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        {labels.map(m => <ReferenceLine key={m.ts + m.role} x={Date.parse(m.ts)} stroke={ROLE[m.role]} strokeWidth={m.role === "assertion" || m.role === "correction" ? 1.75 : 1}
          strokeDasharray={m.role === "origin" || m.role === "corroboration" ? "3 3" : undefined}
          label={<MileLabel lane={m.lane} flip={m.flip} text={m.label} fill={ROLE[m.role]} />} />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ── Per-day: stacked contaminating vs other ── */
export function PerDay({ days, height = 170 }: { days: { day: string; n: number; contam: number }[]; height?: number }) {
  const data = days.map(d => ({ day: d.day.slice(5), other: d.n - d.contam, contaminating: d.contam }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }} barCategoryGap={4}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="day" tick={tick} axisLine={{ stroke: C.axis }} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: tick.fontFamily }} iconType="square" iconSize={8} />
        <Bar dataKey="contaminating" stackId="a" fill={C.contam} isAnimationActive={false} />
        <Bar dataKey="other" stackId="a" fill={C.s4} isAnimationActive={false} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Horizontal bars (actors, artifacts) ── */
export function HBars({ rows, color, height, labelWidth = 130, unit = "messages" }: { rows: { label: string; n: number; color?: string }[]; color: string; height?: number; labelWidth?: number; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(80, rows.length * 26 + 10)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 44, bottom: 2, left: 4 }} barCategoryGap={6}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="label" width={labelWidth} tick={tick} axisLine={false} tickLine={false} />
        <Tooltip {...tipStyle} formatter={(v: any) => [fmtInt(v), unit]} />
        <Bar dataKey="n" radius={2} isAnimationActive={false}>
          {rows.map((r, i) => <Cell key={i} fill={r.color ?? color} />)}
          <LabelList dataKey="n" position="right" style={{ ...tick, fill: "currentColor" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Role mix: one stacked bar, one series per role ── */
export function RoleMix({ mix, height = 72 }: { mix: { role: Role; n: number }[]; height?: number }) {
  const row: Record<string, number | string> = { k: "roles" };
  mix.forEach(m => { row[m.role] = m.n; });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barSize={16}>
        <XAxis type="number" hide /><YAxis type="category" dataKey="k" hide />
        <Tooltip {...tipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: tick.fontFamily }} iconType="square" iconSize={8} />
        {mix.map(m => <Bar key={m.role} dataKey={m.role} stackId="r" fill={ROLE[m.role]} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Scope widths ── */
export function ScopeWidths({ hist, highlight, height = 190 }: { hist: { width: number; n: number }[]; highlight?: number; height?: number }) {
  const data = hist.map(h => ({ w: h.width === 31 ? "31+" : String(h.width), n: h.n, hi: h.width === highlight }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }} barCategoryGap={3}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="w" tick={tick} axisLine={{ stroke: C.axis }} tickLine={false} interval={2} label={{ value: "window width (days)", position: "insideBottom", offset: -2, style: { ...tick, fill: "currentColor" } }} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={fmtInt} />
        <Tooltip {...tipStyle} formatter={(v: any) => [fmtInt(v), "retrievals"]} labelFormatter={(w: any) => `${w}-day window`} />
        <Bar dataKey="n" radius={[2, 2, 0, 0]} isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={d.hi ? C.ink : C.requery} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Weekly activity: three synced small multiples, one axis each ── */
export function Weekly({ weekly }: { weekly: { week: string; chat: number; retrievals: number; human: number }[] }) {
  const data = weekly.map(w => ({ ...w, label: w.week.slice(2, 7) }));
  const panel = (key: "chat" | "retrievals" | "human", color: string, last: boolean) => (
    <ResponsiveContainer width="100%" height={last ? 96 : 76} key={key}>
      <BarChart data={data} syncId="weekly" margin={{ top: 4, right: 8, bottom: last ? 0 : -8, left: -14 }} barCategoryGap={1}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: C.axis }} tickLine={false} interval={12} hide={!last} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v))} />
        <Tooltip {...tipStyle} formatter={(v: any) => [fmtInt(v), key]} labelFormatter={(l: any) => `week of 20${l}`} />
        <Bar dataKey={key} fill={color} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
  return <div style={{ display: "grid", gap: 2 }}>{panel("chat", C.ink2, false)}{panel("retrievals", C.requery, false)}{panel("human", C.good, true)}</div>;
}

/* ── Timeline: the replay strip as a real chart — cumulative area, role ticks, milestones, playhead ── */
export function TimelineChart({ rp, alerts, cur, onScrub, height = "100%" }: { rp: Replay; alerts: Alert[]; cur: number; onScrub: (t: number) => void; height?: number | `${number}%` }) {
  const t0 = Date.parse(rp.window.start), t1 = Date.parse(rp.window.end);
  const N0 = rp.track.length, L = Math.max(1, N0 * 0.07);
  const data = rp.track.map((e, i) => ({ t: Date.parse(e.ts), n: i + 1, actor: e.actor, role: e.role, lit: Date.parse(e.ts) <= cur, text: e.text.replace(/\s+/g, " ").slice(0, 120) }));
  const lanes: Record<string, number> = { mention: -L, requery: -2 * L, contamination: -3 * L };
  const ticks = data.filter(d => d.role in lanes).map(d => ({ ...d, lane: lanes[d.role] }));
  const miles = alerts.filter(a => a.claim === rp.claim).flatMap(a => a.chain).filter((s, i, arr) => arr.findIndex(z => z.ts === s.ts && z.role === s.role) === i);
  const N = rp.track.length;
  const labels = laneLabels(miles, t0, t1, 1100);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 34, right: 18, bottom: 4, left: 0 }}
        onClick={(s: any) => { if (s?.activeLabel != null) onScrub(+s.activeLabel); }} style={{ cursor: "crosshair" }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="t" type="number" domain={[t0, t1]} tickFormatter={fmtDay} tick={tick} axisLine={{ stroke: C.axis }} tickLine={false} minTickGap={48} />
        <YAxis yAxisId="n" domain={[-3.6 * L, N * 1.06]} tick={tick} axisLine={false} tickLine={false} width={34} allowDecimals={false}
          ticks={[0, Math.round(N / 2), N]} />
        <Tooltip {...tipStyle} labelFormatter={(t: any) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + "Z"}
          formatter={(v: any, _n: any, p: any) => [`${p.payload.actor} · ${p.payload.role}`, `#${v}`]} />
        <Area yAxisId="n" type="stepAfter" dataKey="n" stroke={C.ink} fill="rgba(232,234,236,.08)" strokeWidth={1.25} dot={false} isAnimationActive={false} />
        <Scatter yAxisId="n" data={ticks} dataKey="lane" isAnimationActive={false}
          shape={(p: any) => <rect x={p.cx - 1.5} y={p.cy - 7} width={3} height={14} rx={1} fill={ROLE[p.payload.role]} opacity={p.payload.lit ? 1 : 0.3} />} />
        {labels.map(m => <ReferenceLine key={m.ts + m.role} yAxisId="n" x={Date.parse(m.ts)} stroke={ROLE[m.role]} strokeWidth={m.role === "assertion" || m.role === "correction" ? 1.75 : 1}
          strokeDasharray={m.role === "origin" || m.role === "corroboration" ? "3 3" : undefined}
          label={<MileLabel lane={m.lane} flip={m.flip} text={m.label} fill={ROLE[m.role]} />} />)}
        <ReferenceLine yAxisId="n" x={cur} stroke={C.ink} strokeWidth={1.25} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export { Line, LineChart };
