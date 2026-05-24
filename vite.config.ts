import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const serverHost = host || "127.0.0.1";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  define: {
    DEV: process.env.NODE_ENV !== "production",
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-mui": ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
          "vendor-markdown": ["react-markdown", "remark-gfm", "remark-math", "rehype-katex", "react-syntax-highlighter", "katex"],
          "vendor-motion": ["motion"],
          "vendor-date": ["date-fns"],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: serverHost,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
