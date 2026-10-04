import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Alert, Evidence } from "../../lib/data";
import { MILESTONE, dur } from "../../lib/data";
import { DETAIL, STAGGER } from "../../lib/motion";

function mark(s: string, v: number | undefined): ReactNode[] | string {
  if (v == null) return s;
  const pats = [...new Set([v.toLocaleString("en-US"), String(v), String(Math.round(v))])];
  const re = new RegExp("\\$\\s?(" + pats.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![0-9])", "g");
  const parts: ReactNode[] = []; let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) { parts.push(s.slice(last, m.index)); parts.push(<em key={k++}>{m[0]}</em>); last = m.index + m[0].length; }
  parts.push(s.slice(last)); return parts;
}

/* One line of meaning per step, in plain language, before any quote. */
function meaning(s: Evidence, a: Alert, lag: number): ReactNode {
  const m = a.metrics;
  switch (s.role) {
    case "origin": return <>The oracle answered a query scoped to <b>{s.scope}</b>. Its answer states the value <b>with</b> that bound — this step is correct.</>;
    case "assertion": return <>{s.actor} restated the number <b>{dur(lag)} later</b> with the bound gone. This is the moment Tripwire fires.</>;
    case "corroboration": return <>{s.actor} asked the oracle to <b>confirm</b> the value and was told it was supported — corroboration manufactured from the asker's own premise.</>;
    case "correction": return <>{s.actor} gave a materially different figure{m.corrected_by?.startsWith("human:") ? <> — <b>a human</b>, not an agent</> : null}, <b>{dur(lag)}</b> after the stripped restatement.</>;
    default: return s.note;
  }
}

export function Chain({ alert, index, stage }: { alert: Alert; index: number; stage: number }) {
  const t0 = Date.parse(alert.chain[0].ts);
  // the restatement is where the bound was lost -- open that one by default
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true });
  return (
    <motion.div initial={{ opacity: 0, y: DETAIL.offsetY }} animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : DETAIL.offsetY }} transition={DETAIL.spring}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={index} className="stepper" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18, ease: [0.33, 1, 0.68, 1] }}>
          {alert.chain.map((s, i) => {
            const lag = (Date.parse(s.ts) - t0) / 1000, isOpen = !!open[i];
            return (
              <motion.div key={s.native_id ?? i} className={`sstep ${s.role}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...DETAIL.spring, delay: i * STAGGER.normal }}>
                <div className="num">{i + 1}</div>
                <div>
                  <div className="hd">
                    <span className="ttl">{MILESTONE[s.role] ?? s.role}</span>
                    <span className="meta">{s.actor ?? "—"} · {s.ts.slice(0, 16).replace("T", " ")}Z{lag > 0 && <> · T+{dur(lag)}</>}{s.scope && <> · scope {s.scope}</>}</span>
                  </div>
                  <div className="mean">{meaning(s, alert, lag)}</div>
                  <button className="disc" onClick={() => setOpen(o => ({ ...o, [i]: !isOpen }))} aria-expanded={isOpen}>
                    {isOpen ? "HIDE" : "SHOW"} {s.surface === "retrieval" ? "QUERY & ANSWER" : "MESSAGE"}
                  </button>
                  {isOpen && <>
                    {s.query && <><div className="q-label">query</div><div className="quote">{s.query}</div></>}
                    <div className="q-label">{s.surface === "retrieval" ? "oracle answer" : "message"}</div>
                    <div className="quote">{mark(s.text, alert.metrics.value)}</div>
                  </>}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
