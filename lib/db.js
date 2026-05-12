import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing');
}

export const sql = neon(process.env.DATABASE_URL);

// Helper para queries con un solo resultado
export async function queryOne(text, params) {
  const rows = await sql(text, params);
  return rows[0];
}

// Helper para transacciones simples o múltiples queries
export async function query(text, params) {
  return await sql(text, params);
}
