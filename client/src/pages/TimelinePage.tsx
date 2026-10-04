import { useMemo } from "react";
import type { Data } from "../lib/data";
import { useReplay } from "../hooks/useReplay";
import { ContextBar } from "../components/ContextBar";
import { Timeline } from "../components/workbench/Timeline";
import { StreamTab } from "../components/workbench/StreamTab";

/** Replay: the claim's life on a strip, and the messages streaming past the playhead. */
export function TimelinePage({ d, sel, onSel }: { d: Data; sel: number; onSel: (i: number) => void }) {
  const a = d.alerts[sel];
  const rp = useMemo(() => d.replays.find(r => r.claim === a.claim) ?? null, [d, a]);
  const t0 = rp ? Date.parse(rp.window.start) : 0, t1 = rp ? Date.parse(rp.window.end) : 1;
  const r = useReplay(t0, t1);
  return (
    <div className="page">
      <ContextBar alerts={d.alerts} sel={sel} onSel={onSel} title="Timeline"
        blurb="Press play, or press space. Ticks are messages that carried the claim; vertical rules are the milestones. Click anywhere on the strip to scrub." />
      {rp ? <>
        <div className="timeline big">
          <Timeline rp={rp} alerts={d.alerts} claim={a.claim} cur={r.cur} t0={t0} t1={t1} playing={r.playing} rate={r.rate}
            stage={1} onToggle={r.toggle} onRate={r.cycleRate} onScrub={r.scrub} />
        </div>
        <section className="block"><h2>As it happened</h2><p className="help">Messages appear here as the playhead passes them.</p>
          <StreamTab bare rp={rp} cur={r.cur} table={false} /></section>
      </> : <div className="empty">This alert has no replay track — only contradicted (HIGH) strips carry one.</div>}
    </div>
  );
}
