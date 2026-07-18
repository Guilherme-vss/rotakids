/**
 * db.ts — conexão com o PostgreSQL.
 *
 * Local (docker-compose): a URL padrão aponta para o container.
 * Nuvem (Render): a DATABASE_URL vem do ambiente e exige SSL — detectamos
 * pela presença de "render.com" ou pela variável PGSSL.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL || "postgres://rotakids:rotakids@localhost:5432/rotakids";

// Render (e a maioria dos Postgres gerenciados) exige SSL; local não.
const precisaSsl =
  /render\.com|amazonaws\.com/.test(connectionString) || process.env.PGSSL === "true";

export const pool = new Pool({
  connectionString,
  ssl: precisaSsl ? { rejectUnauthorized: false } : undefined,
});

/** Atalho para consultas parametrizadas (sempre parametrize: evita SQL injection). */
export function query(texto: string, params: unknown[] = []) {
  return pool.query(texto, params);
}

/**
 * Cria o esquema na primeira subida.
 *
 * Em Docker o init.sql roda pelo entrypoint do Postgres; em nuvem (Render) não
 * há esse gancho, então rodamos o mesmo arquivo aqui no boot. É seguro repetir:
 * todo CREATE usa "IF NOT EXISTS" (idempotente). Sem isso, a primeira request
 * quebraria por falta de tabela.
 */
export async function inicializarEsquema(): Promise<void> {
  const caminho = join(__dirname, "..", "db", "init.sql");
  const sql = readFileSync(caminho, "utf8");
  await pool.query(sql);
  console.log("✅ Esquema do banco verificado/criado.");
}
