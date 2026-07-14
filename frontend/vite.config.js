import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, o Vite roda em :5173 e repassa as chamadas /api
// para o backend Express em :3000 — sem dor de cabeça com CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
  test: {
    environment: "node",
  },
});
