import { useEffect, useState } from "react";
import type { Data } from "../lib/data";
import { loadData } from "../lib/data";

/** Loads alerts.json and picks the recommended alert: the HIGH finding with the most evidence. */
export function useAlertsData() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  useEffect(() => {
    loadData().then(d => {
      setData(d);
      const size = (claim: string) => d.replays.find(r => r.claim === claim)?.track.length ?? 0;
      let best = 0;
      d.alerts.forEach((a, i) => { if (a.severity === "high" && size(a.claim) > size(d.alerts[best].claim)) best = i; });
      setSel(best);
    }).catch(e => setError(String(e)));
  }, []);
  return { data, error, sel, setSel };
}
