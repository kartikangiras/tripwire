# Tripwire UI

React + TypeScript + Vite. Two pages: `index.html` (landing) and `workbench.html` (the console).

```
npm ci          # once
npm run dev     # dev server; proxies /data to the python server on :8787
npm run build   # writes ../src/tripwire/static — committed, so `tripwire ui` needs no Node
```

Layout: `src/pages/` one file per page · `src/hooks/` data, replay engine, page/sidebar state ·
`src/components/workbench/` the pieces pages compose · `src/components/charts/` the Recharts kit · `src/components/workbench/ForceGraph.tsx` the react-force-graph link analysis.
