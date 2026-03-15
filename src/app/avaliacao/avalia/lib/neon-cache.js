import { Pool } from 'pg';

const globalForDb = globalThis;

function sanitizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);

    // Evita conflito entre sslmode da URL e ssl no config
    url.searchParams.delete('sslmode');
    url.searchParams.delete('sslcert');
    url.searchParams.delete('sslkey');
    url.searchParams.delete('sslrootcert');

    return url.toString();
  } catch {
    return rawUrl;
  }
}

const connectionString = sanitizeDatabaseUrl(process.env.DATABASE_URL);

export const pool =
  globalForDb.__dashboardPool ??
  new Pool({
    connectionString,
    ssl: connectionString ? { rejectUnauthorized: false } : undefined,

    // Mais tolerante para ambiente serverless
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 12000,

    // Evita matar query curta demais
    query_timeout: 15000,
    statement_timeout: 15000,

    allowExitOnIdle: true,
  });

if (!globalForDb.__dashboardPool) {
  globalForDb.__dashboardPool = pool;

  pool.on('error', (err) => {
    console.error('[neon-cache] pool error:', err);
  });
}

let tableEnsured = false;
let tableEnsurePromise = null;

function normalizeCacheValue(value, fallback = 'todos') {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

export async function ensureCacheTable() {
  if (tableEnsured) return;
  if (tableEnsurePromise) return tableEnsurePromise;

  tableEnsurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dashboard_cache (
        endpoint TEXT NOT NULL,
        ano TEXT NULL,
        campus TEXT NOT NULL DEFAULT 'todos',
        curso TEXT NOT NULL DEFAULT 'todos',
        payload JSONB NOT NULL,
        hf_url TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // índice para registros com ano
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_cache_unique_with_ano
      ON dashboard_cache (endpoint, ano, campus, curso)
      WHERE ano IS NOT NULL
    `);

    // índice para registros sem ano
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_cache_unique_without_ano
      ON dashboard_cache (endpoint, campus, curso)
      WHERE ano IS NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS dashboard_cache_updated_at_idx
      ON dashboard_cache (updated_at DESC)
    `);

    tableEnsured = true;
  })();

  try {
    await tableEnsurePromise;
  } finally {
    tableEnsurePromise = null;
  }
}

export async function getCachedPayload({
  endpoint,
  ano = null,
  campus = 'todos',
  curso = 'todos',
}) {
  await ensureCacheTable();

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
  await ensureCacheTable();

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