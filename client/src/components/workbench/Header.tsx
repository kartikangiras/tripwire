import { motion } from "framer-motion";
import type { Alert } from "../../lib/data";
import { dur } from "../../lib/data";
import { KPIS } from "../../lib/motion";

/* Sentry-style header: what happened and how bad, before any detail. */
export function headline(a: Alert): { title: string; what: string } {
  const m = a.metrics;
  if (a.detector === "scope_strip") {
    return {
      title: `A ${m.scope ?? "bounded"} measurement became a whole-period fact.`,
      what: `The history oracle reported ${a.claim} for ${m.scope ?? "a bounded window"}. ${dur(m.lag_seconds)} later, ${m.asserting_actor ?? "an agent"} restated it with the bound gone` +
        (m.contradicted ? `, and it stayed wrong for ${dur(m.correction_lag_seconds)} until ${m.corrected_by} contradicted it.` : `. No later contradiction was found, so the value may be fine — but the bound is gone.`),
    };
  }
  return {
    title: "A verification question confirmed its own premise.",
    what: `${m.asker ?? "An agent"} asked the oracle to confirm ${a.claim}; the answer affirmed it (“${m.affirmation}”).` +
      (m.known_wrong ? " The value was later contradicted — the swarm manufactured a proof trail for a wrong number." : " Treated as corroboration, though no new evidence was consulted."),
  };
}

export function Header({ a, stage }: { a: Alert; stage: number }) {
  const m = a.metrics, h = headline(a);
  const corrHuman = typeof m.corrected_by === "string" && m.corrected_by.startsWith("human:");
  return (
    <motion.div className="ahead" initial={{ opacity: 0, y: KPIS.offsetY }} animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : KPIS.offsetY }} transition={KPIS.spring}>
      <div className="row1">
        <span className="claim">{a.claim}</span>
        <span className={`sev ${a.severity}`}>{a.severity.toUpperCase()}</span>
        <span className="chip">{a.detector.replace("_", " ")}</span>
        {m.scope && <span className="chip">scope {m.scope}</span>}
        <span className="help">fired {a.fired_at.slice(0, 16).replace("T", " ")} UTC</span>
      </div>
      <div className="title">{h.title}</div>
      <div className="what">{h.what}</div>
      <div className="facts">
        {m.lag_seconds != null && <div><div className="micro">bound survived</div><div className="v">{dur(m.lag_seconds)}</div></div>}
        {m.contradicted != null && <div><div className="micro">phantom lifetime</div><div className={`v ${m.contradicted ? "crit" : ""}`}>{m.contradicted ? dur(m.correction_lag_seconds) : "not contradicted"}</div></div>}
        {m.corrected_by && <div><div className="micro">corrected by</div><div className={`v ${corrHuman ? "good" : ""}`}>{m.corrected_by}</div></div>}

      </div>
    </motion.div>
  );
}
