import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    port: 5180,
    strictPort: true,
    proxy: { "/api": { target: `http://localhost:${process.env.API_PORT ?? 4000}`, changeOrigin: false } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
