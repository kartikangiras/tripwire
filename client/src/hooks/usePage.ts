import { useState } from "react";

export type Page = "alerts" | "timeline" | "graph" | "spread" | "records" | "analytics";
const PAGES: Page[] = ["alerts", "timeline", "graph", "spread", "records", "analytics"];

/** Which page is open and which alert is being investigated, mirrored into the URL. */
export function usePage() {
  const qs = new URLSearchParams(location.search);
  const [page, setPageState] = useState<Page>((PAGES.find(p => p === qs.get("page")) as Page) ?? "alerts");
  const a = qs.get("alert");
  const [alertIdx, setAlertIdxState] = useState<number | null>(a != null && /^\d+$/.test(a) ? +a : null);
  const sync = (patch: Record<string, string | null>) => {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(patch)) v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v);
    history.replaceState(null, "", u);
  };
  const setPage = (p: Page) => { setPageState(p); sync({ page: p === "alerts" ? null : p }); };
  const setAlertIdx = (i: number) => { setAlertIdxState(i); sync({ alert: String(i) }); };
  return { page, setPage, alertIdx, setAlertIdx };
}
