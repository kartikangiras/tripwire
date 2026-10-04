import type { Replay } from "../../lib/data";
import { actorSpread, dur, perDay, roleMix, velocity } from "../../lib/data";
import { HBars, PerDay, RoleMix } from "../charts";
import { C } from "../charts/theme";

export function SpreadTab({ rp, bare = false }: { rp: Replay | null; stage?: number; bare?: boolean }) {
  if (!rp) return null;
  const actors = actorSpread(rp), mix = roleMix(rp), days = perDay(rp), v = velocity(rp);
  return (
    <div className="pane">
      {!bare && <h2><span className="micro">Spread analytics</span><span className="count">{rp.counts.actors} actors · {rp.span_days}d</span></h2>}
      <div className="scroll an">
        <div><h3>Who carried it</h3><HBars rows={actors.map(a => ({ label: a.actor, n: a.total, color: a.human ? C.good : undefined }))} color={C.ink2} /></div>
        <div><h3>Role mix</h3><RoleMix mix={mix} /></div>
        <div><h3>Messages per day</h3><PerDay days={days} /></div>
        <div className="stat2">
          <div><div className="micro">first contamination</div><div className="v mono">{dur(v.firstContaminationS)}</div><div className="k">after the claim entered</div></div>
          <div><div className="micro">correction</div><div className="v mono">{dur(v.correctionS)}</div><div className="k">after the claim entered</div></div>
          <div><div className="micro">velocity</div><div className="v mono">{v.msgsPerDay?.toFixed(1) ?? "—"}/d</div><div className="k">messages carrying the claim</div></div>
          <div><div className="micro">human share</div><div className="v mono">{(v.humanShare * 100).toFixed(1)}%</div><div className="k">of messages in the track</div></div>
        </div>
      </div>
    </div>
  );
}
