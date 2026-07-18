/**
 * app.ts — montagem do Express (separado do index.ts para facilitar testes).
 */
import express from "express";
import path from "path";
import authRouter from "./routes/auth";
import alunosRouter from "./routes/alunos";
import vinculosRouter from "./routes/vinculos";
import rotasRouter from "./routes/rotas";
import trajetoRouter from "./routes/trajeto";

export function criarApp() {
  const app = express();

  app.use(express.json());

  // CORS: o front publicado no GitHub Pages (outro domínio) precisa poder
  // chamar este backend. Liberamos só os domínios conhecidos — não "*" —
  // porque a API lida com dados de crianças (regra 2: segurança desde o início).
  const origensPermitidas = [
    "https://guilherme-vss.github.io",
    "http://localhost:5173",
    "http://localhost:5600",
    ...(process.env.CORS_ORIGENS?.split(",").map((o) => o.trim()) ?? []),
  ];
  app.use((req, res, next) => {
    const origem = req.headers.origin;
    if (origem && origensPermitidas.includes(origem)) {
      res.header("Access-Control-Allow-Origin", origem);
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/saude", (_req, res) => res.json({ ok: true, servico: "rotakids" }));

  app.use("/api/auth", authRouter);
  app.use("/api/alunos", alunosRouter);
  app.use("/api/vinculos", vinculosRouter);
  app.use("/api/rota", rotasRouter);
  app.use("/api/trajeto", trajetoRouter);

  return app;
}
