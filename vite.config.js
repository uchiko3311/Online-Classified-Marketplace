import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["three"],
  },
  server: {
    host: true,
    port: 3000,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  build: {
    target: "es2019",
    chunkSizeWarningLimit: 2000,
  },
});
