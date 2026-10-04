import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";


export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../src/tripwire/static", emptyOutDir: true, sourcemap: false,
    rollupOptions: { input: { index: resolve(__dirname, "index.html"), workbench: resolve(__dirname, "workbench.html") } },
  },
  server: { proxy: { "/data": "http://127.0.0.1:8787" } },
});
