import type { Data } from "../lib/data";
import { Inbox } from "../components/workbench/Inbox";
import { Header } from "../components/workbench/Header";
import { Chain } from "../components/workbench/Chain";
import { Explainer } from "../components/workbench/Explainer";
import type { Page } from "../hooks/usePage";

/** Inbox on the left; on the right, what happened and the provenance story. Nothing else. */
export function AlertsPage({ d, sel, onSel, onPage }: { d: Data; sel: number; onSel: (i: number) => void; onPage: (p: Page) => void }) {
  const a = d.alerts[sel];
  return (
    <div className="split">
      <Inbox alerts={d.alerts} sel={sel} onSel={onSel} loadStage={1} />
      <div className="detail">
        <Header a={a} stage={1} />
        <div className="goto">
          <span className="micro">continue in</span>
          <button className="ctl" onClick={() => onPage("timeline")}>Timeline</button>
          <button className="ctl" onClick={() => onPage("graph")}>Graph</button>
          <button className="ctl" onClick={() => onPage("records")}>Records</button>
        </div>
        <section className="block">
          <h2>Provenance story</h2>
          <p className="help">Each step is one record. The restatement where the bound was lost is open; expand any other to read it in full.</p>
          <Chain alert={a} index={sel} stage={1} />
        </section>
        <section className="block"><Explainer a={a} /></section>
      </div>
    </div>
  );
}
