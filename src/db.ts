/**
 * db.ts — conexão com o PostgreSQL.
 * O esquema é criado pelo db/init.sql na subida do container.
 */
import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://rotakids:rotakids@localhost:5432/rotakids",
});

/** Atalho para consultas parametrizadas (sempre parametrize: evita SQL injection). */
export function query(texto: string, params: unknown[] = []) {
  return pool.query(texto, params);
}
