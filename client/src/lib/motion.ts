/* ─────────────────────────────────────────────────────────
 * WORKBENCH ENTRANCE STORYBOARD
 *
 * Static shell (top bar) is visible immediately and never re-animates.
 *
 *    0ms   top bar visible; panels blank
 *  100ms   KPI strip slides down; digits start rolling (120ms apart)
 *  300ms   alert rail slides in from left; alerts stagger 60ms
 *  450ms   replay strip fades in from right
 *  650ms   link graph: nodes pop in, 30ms apart from the claim outward
 *  800ms   chain + stream slide up
 * 1100ms   entrance complete
 * ───────────────────────────────────────────────────────── */

export const TIMING = {
  kpis:   100,  // ms — first content to appear
  rail:   300,  // ms — alert list
  strip:  450,  // ms — replay timeline
  graph:  650,  // ms — link analysis nodes
  detail: 800,  // ms — chain + stream
} as const;

export const SPRING = {
  stiff:  { type: "spring" as const, stiffness: 350, damping: 28 },
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  bouncy: { type: "spring" as const, stiffness: 280, damping: 26 },
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
};

export const STAGGER = { tight: 0.04, normal: 0.06, relaxed: 0.18 } as const;

export const EASE = {
  outExpo:  [0.16, 1, 0.3, 1] as const,
  outCubic: [0.33, 1, 0.68, 1] as const,
};

export const KPIS   = { offsetY: -12, spring: SPRING.stiff };
export const RAIL   = { offsetX: -24, spring: SPRING.smooth, stagger: STAGGER.normal, itemY: 10 };
export const STRIP  = { offsetX:  24, spring: SPRING.smooth };
export const DETAIL = { offsetY:  16, spring: SPRING.stiff };
export const ROWS   = { stagger: STAGGER.tight, offsetY: -4, spring: SPRING.snappy };
export const NODES  = { stagger: 0.03, spring: SPRING.bouncy };
