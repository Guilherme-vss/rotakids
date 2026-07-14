/**
 * app.ts — montagem do Express (separado do index.ts para facilitar testes).
 */
import express from "express";
import path from "path";
import authRouter from "./routes/auth";
import alunosRouter from "./routes/alunos";
import vinculosRouter from "./routes/vinculos";
import rotasRouter from "./routes/rotas";

export function criarApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/saude", (_req, res) => res.json({ ok: true, servico: "rotakids" }));

  app.use("/api/auth", authRouter);
  app.use("/api/alunos", alunosRouter);
  app.use("/api/vinculos", vinculosRouter);
  app.use("/api/rota", rotasRouter);

  return app;
}
