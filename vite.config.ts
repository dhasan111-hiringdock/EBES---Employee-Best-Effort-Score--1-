import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Keep the official JSX runtime untouched
      { find: "react/jsx-runtime", replacement: "react/jsx-runtime" },
    ],
  },
  optimizeDeps: {
    exclude: ["hono", "hono/cors"],
  },
});
