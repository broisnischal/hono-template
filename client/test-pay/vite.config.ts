import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(import.meta.dirname),
  base: "/test/pay/",
  build: {
    outDir: path.resolve(import.meta.dirname, "../../static/test-pay"),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/internal": "http://localhost:3000",
      "/webhooks": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
