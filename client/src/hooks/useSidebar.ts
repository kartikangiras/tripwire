import { useCallback, useEffect, useState } from "react";

const KEY = "tw-sidebar";            // "open" | "closed" — a manual choice, remembered
const AUTO = "(max-width: 1200px)";  // below this, collapse unless the user said otherwise

/** Sidebar collapsed state: automatic on narrow viewports, manual override remembered. */
export function useSidebar() {
  const read = (): "open" | "closed" | null => { try { return localStorage.getItem(KEY) as any; } catch { return null; } };
  const [override, setOverride] = useState<"open" | "closed" | null>(read);
  const [narrow, setNarrow] = useState(() => matchMedia(AUTO).matches);
  useEffect(() => {
    const mq = matchMedia(AUTO); const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, []);
  const collapsed = override ? override === "closed" : narrow;
  const toggle = useCallback(() => {
    const next = collapsed ? "open" : "closed";
    setOverride(next); try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  }, [collapsed]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "[" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggle(); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [toggle]);
  return { collapsed, toggle, auto: !override };
}
