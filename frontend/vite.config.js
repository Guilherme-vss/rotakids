import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, o Vite roda em :5173 e repassa as chamadas /api
// para o backend Express em :3000 — sem dor de cabeça com CORS.
export default defineConfig({
  base: "./", // caminhos relativos: o build funciona em qualquer subpasta (ex.: demos no GitHub Pages)
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
  test: {
    environment: "node",
  },
});
