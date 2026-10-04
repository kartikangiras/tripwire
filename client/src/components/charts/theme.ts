/* Shared chart theme: the validated palette as CSS variables (dark workbench)
 * and literal hex for the light landing, plus axis/tick conventions. */
export const C = {
  ink: "var(--ink)", ink2: "var(--ink-2)", ink3: "var(--ink-3)",
  requery: "var(--m-requery)", contam: "var(--m-contam)", mention: "var(--m-mention)",
  critical: "var(--st-critical)", good: "var(--st-good)", s2: "var(--s-2)", s3: "var(--s-3)", s4: "var(--s-4)",
  grid: "rgba(128,136,144,.18)", axis: "rgba(128,136,144,.45)",
};
export const ROLE: Record<string, string> = {
  mention: C.mention, requery: C.requery, contamination: C.contam,
  origin: C.requery, assertion: C.critical, corroboration: C.contam, correction: C.good,
};
export const tick = { fontSize: 10.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fill: "currentColor" } as const;
export const fmtDay = (t: number) => new Date(t).toISOString().slice(5, 10);
export const fmtInt = (n: number) => n.toLocaleString("en-US");
export const fmtDur = (s: number) => {
  const p = (n: number) => String(Math.floor(n)).padStart(2, "0");
  if (s < 60) return s < 10 ? s.toFixed(1) + "s" : Math.round(s) + "s";
  if (s < 3600) return Math.floor(s / 60) + "m " + p(s % 60) + "s";
  if (s < 86400) return Math.floor(s / 3600) + "h " + p((s % 3600) / 60) + "m";
  return Math.floor(s / 86400) + "d " + p((s % 86400) / 3600) + "h";
};
/** Tooltip panel styling shared by every chart. */
export const tipStyle = {
  contentStyle: { background: "var(--tip-bg, #1b1f25)", border: "1px solid var(--line-2)", borderRadius: 4, fontSize: 12, fontFamily: tick.fontFamily, color: "var(--ink)" },
  labelStyle: { color: "var(--ink-2)", marginBottom: 4 },
  itemStyle: { color: "var(--ink)", padding: 0 },
  cursor: { fill: "rgba(128,136,144,.08)" },
};
