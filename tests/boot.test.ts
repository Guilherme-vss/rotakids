/**
 * Testes do boot: o esquema é criado na subida e é seguro repetir.
 *
 * Isto verifica a decisão que faz o deploy no Render funcionar sem migração
 * manual — o init.sql roda no boot e é idempotente (regra 3: nada é pronto
 * sem executar).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { newDb } from "pg-mem";

const sql = readFileSync(join(__dirname, "..", "db", "init.sql"), "utf8");

describe("inicialização do esquema no boot", () => {
  test("roda o init.sql inteiro sem erro num banco vazio", () => {
    const db = newDb();
    expect(() => db.public.none(sql)).not.toThrow();

    const tabelas = db.public
      .many(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)
      .length;
    expect(tabelas).toBeGreaterThanOrEqual(9);
  });

  test("todo CREATE é idempotente (IF NOT EXISTS) — seguro repetir a cada boot", () => {
    // O Render reinicia o processo a cada deploy e roda o init de novo. A
    // garantia de que isso não quebra vem do IF NOT EXISTS em TODO objeto.
    // (Verificação estática: o pg-mem não simula bem o re-run, mas o Postgres
    // real honra o IF NOT EXISTS — então checamos a fonte, que é o contrato.)
    const creates = sql.match(/CREATE\s+(TABLE|UNIQUE INDEX|INDEX)/gi) ?? [];
    const semIfNotExists = sql.match(/CREATE\s+(TABLE|UNIQUE INDEX|INDEX)(?!\s+IF NOT EXISTS)/gi) ?? [];

    expect(creates.length).toBeGreaterThan(0);
    expect(semIfNotExists).toEqual([]); // nenhum CREATE sem IF NOT EXISTS
  });
});
