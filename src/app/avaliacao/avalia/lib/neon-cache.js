// lib/neon-cache.js
import { Pool } from 'pg';

const globalForDb = globalThis;

export const pool =
  globalForDb.__dashboardPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

if (!globalForDb.__dashboardPool) {
  globalForDb.__dashboardPool = pool;
}

let tableReadyPromise = null;

function normalizeCacheValue(value, fallback = 'todos') {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

export async function ensureCacheTable() {
  if (tableReadyPromise) return tableReadyPromise;

  tableReadyPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dashboard_cache (
        id BIGSERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL,
        ano TEXT NULL,
        campus TEXT NOT NULL DEFAULT 'todos',
        curso TEXT NOT NULL DEFAULT 'todos',
        payload JSONB NOT NULL,
        hf_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_dashboard_cache_lookup
      ON dashboard_cache (endpoint, ano, campus, curso);
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_dashboard_cache_with_ano
      ON dashboard_cache (endpoint, ano, campus, curso)
      WHERE ano IS NOT NULL;
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_dashboard_cache_without_ano
      ON dashboard_cache (endpoint, campus, curso)
      WHERE ano IS NULL;
    `);
  })();

  return tableReadyPromise;
}

export async function getCachedPayload({
  endpoint,
  ano = null,
  campus = 'todos',
  curso = 'todos',
}) {
  const campusNorm = normalizeCacheValue(campus, 'todos');
  const cursoNorm = normalizeCacheValue(curso, 'todos');

  const { rows } = await pool.query(
    `
      SELECT payload
      FROM dashboard_cache
      WHERE endpoint = $1
        AND ano IS NOT DISTINCT FROM $2
        AND campus = $3
        AND curso = $4
      LIMIT 1
    `,
    [endpoint, ano, campusNorm, cursoNorm]
  );

  return rows[0]?.payload ?? null;
}

export async function saveCachedPayload({
  endpoint,
  ano = null,
  campus = 'todos',
  curso = 'todos',
  hfUrl,
  payload,
}) {
  const campusNorm = normalizeCacheValue(campus, 'todos');
  const cursoNorm = normalizeCacheValue(curso, 'todos');

  if (ano === null) {
    await pool.query(
      `
        INSERT INTO dashboard_cache (
          endpoint,
          ano,
          campus,
          curso,
          payload,
          hf_url,
          updated_at
        )
        VALUES ($1, NULL, $2, $3, $4::jsonb, $5, NOW())
        ON CONFLICT (endpoint, campus, curso)
        WHERE ano IS NULL
        DO UPDATE SET
          payload = EXCLUDED.payload,
          hf_url = EXCLUDED.hf_url,
          updated_at = NOW()
      `,
      [endpoint, campusNorm, cursoNorm, JSON.stringify(payload), hfUrl]
    );

    return;
  }

  await pool.query(
    `
      INSERT INTO dashboard_cache (
        endpoint,
        ano,
        campus,
        curso,
        payload,
        hf_url,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
      ON CONFLICT (endpoint, ano, campus, curso)
      WHERE ano IS NOT NULL
      DO UPDATE SET
        payload = EXCLUDED.payload,
        hf_url = EXCLUDED.hf_url,
        updated_at = NOW()
    `,
    [endpoint, ano, campusNorm, cursoNorm, JSON.stringify(payload), hfUrl]
  );
}