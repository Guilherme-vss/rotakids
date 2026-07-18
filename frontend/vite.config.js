import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const aqui = dirname(fileURLToPath(import.meta.url));
const raizDoProjeto = resolve(aqui, ".."); // rotakids/

// Em desenvolvimento, o Vite roda em :5173 e repassa as chamadas /api
// para o backend Express em :3000 — sem dor de cabeça com CORS.
export default defineConfig({
  base: "./", // caminhos relativos: o build funciona em qualquer subpasta (ex.: Pages)
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:3000" },
    fs: {
      // O front importa o domínio do servidor (../src/domain/*) para rodar a
      // MESMA máquina de estados dos dois lados. Sem isto, o Vite bloqueia
      // a leitura de arquivos fora da pasta frontend/.
      allow: [raizDoProjeto],
    },
  },
  test: {
    environment: "node",
  },
});
