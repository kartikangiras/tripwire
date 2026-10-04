import type { Alert } from "../../lib/data";
import { dur } from "../../lib/data";

/* Plain-language "what / why / check" for the selected alert. */
export function Explainer({ a }: { a: Alert }) {
  const m = a.metrics;
  const strip = a.detector === "scope_strip";
  return (
    <div className="explain two">
      <div><h4>Why it matters</h4>
        <p>{strip
          ? (m.contradicted
            ? <>The unbounded claim was wrong, and it circulated for <b>{dur(m.correction_lag_seconds)}</b> before <b>{m.corrected_by}</b> contradicted it. Every message that repeated it in between is in the stream.</>
            : <>The bound is gone but no later statement contradicts the value, so this is a <b>benign strip</b>. It is still worth knowing: the next restatement inherits no bound at all.</>)
          : <>A question that contains its own answer produces corroboration without evidence. The swarm reads that as independent verification{m.known_wrong ? <> — here, of a value that was <b>already wrong</b></> : null}.</>}</p></div>
      <div><h4>What to check</h4>
        <p>{strip
          ? <>Step 2 is the restatement with the bound gone; open step 1 to read the bound in the oracle's own words. Then the <b>Graph</b> tab for who carried it and where it was written, and the <b>timeline</b> above for when the correction finally arrived.</>
          : <>Read the query in step 1: does it name the value it wants confirmed? Then check whether the oracle cited anything new, or only restated earlier messages.</>}</p></div>
    </div>
  );
}
