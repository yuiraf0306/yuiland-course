import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  // 直接寫死專案路徑，解決白屏問題
  base: "/yuiland-course/", 
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    // 簡化輸出路徑，讓發布更單純
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    host: "0.0.0.0",
  },
});