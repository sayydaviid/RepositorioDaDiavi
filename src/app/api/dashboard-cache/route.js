import {
  ensureCacheTable,
  getCachedPayload,
  saveCachedPayload,
} from '../../avaliacao/avalia/lib/neon-cache';

const HF_BASE = 'https://sayydaviid-avalia-backend.hf.space';

// endpoints que NÃO devem usar neon cache
const SKIP_CACHE_ENDPOINTS = new Set(['/filters', '/health', '/']);

// deduplicação de requests em memória
const inflightRequests = new Map();

const globalForDashboardCache = globalThis;
const memoryCache =
  globalForDashboardCache.__dashboardMemoryCache ?? new Map();

if (!globalForDashboardCache.__dashboardMemoryCache) {
  globalForDashboardCache.__dashboardMemoryCache = memoryCache;
}

const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000;
const MEMORY_CACHE_STALE_MS = 24 * 60 * 60 * 1000;
const MEMORY_CACHE_MAX_ENTRIES = 400;

let cacheDisabledUntil = 0;

function normalizeTextParam(value, fallback = 'todos') {
  if (value === null || value === undefined) return fallback;

  const s = String(value).trim();
  if (!s) return fallback;

  const lower = s.toLowerCase();
  if (
    ['all', 'todos', 'todas', 'todo', 'qualquer', 'none', 'null', 'undefined'].includes(
      lower
    )
  ) {
    return 'todos';
  }

  return s;
}

function buildHfUrl(endpoint, ano, campus, curso) {
  const qs = new URLSearchParams();

  if (ano) qs.set('ano', ano);

  if (endpoint === '/filters') {
    if (campus && campus !== 'todos') qs.set('campus', campus);
    if (curso && curso !== 'todos') qs.set('curso', curso);
  } else {
    if (campus) qs.set('campus', campus);
    if (curso) qs.set('curso', curso);
  }

  const query = qs.toString();
  return `${HF_BASE}${endpoint}${query ? `?${query}` : ''}`;
}

function getUpstreamTimeout(endpoint) {
  if (endpoint === '/filters') return 45000;
  if (endpoint === '/discente/geral/summary') return 30000;

  if (
    endpoint.includes('/boxplot') ||
    endpoint.includes('/descritivas') ||
    endpoint.includes('/estatisticas')
  ) {
    return 35000;
  }

  if (
    endpoint.includes('/proporcoes') ||
    endpoint.includes('/medias') ||
    endpoint.includes('/percentual')
  ) {
    return 25000;
  }

  return 20000;
}

function getRetryCount(endpoint) {
  if (endpoint === '/filters') return 2;
  if (endpoint === '/discente/geral/summary') return 2;
  if (endpoint.includes('/boxplot')) return 1;
  return 1;
}

function shouldBypassCache(endpoint) {
  if (SKIP_CACHE_ENDPOINTS.has(endpoint)) return true;
  return Date.now() < cacheDisabledUntil;
}

function disableCacheTemporarily(ms = 120000) {
  cacheDisabledUntil = Date.now() + ms;
}

function buildMemoryKey({ endpoint, ano, campus, curso }) {
  return JSON.stringify({
    endpoint,
    ano: ano || null,
    campus: campus || 'todos',
    curso: curso || 'todos',
  });
}

function getMemoryCacheEntry(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.updatedAt;
  if (age > MEMORY_CACHE_STALE_MS) {
    memoryCache.delete(key);
    return null;
  }

  return {
    payload: entry.payload,
    age,
  };
}

function setMemoryCacheEntry(key, payload) {
  memoryCache.set(key, {
    payload,
    updatedAt: Date.now(),
  });

  if (memoryCache.size <= MEMORY_CACHE_MAX_ENTRIES) return;

  const firstKey = memoryCache.keys().next().value;
  if (firstKey !== undefined) {
    memoryCache.delete(firstKey);
  }
}

function isRetryableFetchError(err) {
  const msg = String(err?.message || '').toLowerCase();
  const causeCode = err?.cause?.code;

  return (
    err?.name === 'TimeoutError' ||
    err?.code === 23 ||
    causeCode === 'UND_ERR_CONNECT_TIMEOUT' ||
    causeCode === 'UND_ERR_HEADERS_TIMEOUT' ||
    causeCode === 'UND_ERR_BODY_TIMEOUT' ||
    causeCode === 'UND_ERR_SOCKET' ||
    causeCode === 'ETIMEDOUT' ||
    causeCode === 'ECONNRESET' ||
    causeCode === 'EAI_AGAIN' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted due to timeout') ||
    msg.includes('connect timeout') ||
    msg.includes('fetch failed')
  );
}

function isCacheTimeoutError(err) {
  const msg = String(err?.message || '').toLowerCase();

  return (
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ECONNRESET' ||
    err?.code === '57P01' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('connection terminated') ||
    msg.includes('socket hang up')
  );
}

async function tryEnsureCacheTable(requestId) {
  try {
    await ensureCacheTable();
    return true;
  } catch (err) {
    console.error(`[dashboard-cache][${requestId}] ensure cache table error:`, err);

    if (isCacheTimeoutError(err)) {
      disableCacheTemporarily(120000);
    }

    return false;
  }
}

async function fetchJsonWithRetry(url, timeoutMs, retries = 1) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });

      return res;
    } catch (err) {
      lastError = err;

      const retryable = isRetryableFetchError(err);
      if (!retryable || attempt === retries) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }

  throw lastError;
}

function buildInflightKey({ endpoint, ano, campus, curso }) {
  return JSON.stringify({
    endpoint,
    ano: ano || null,
    campus: campus || 'todos',
    curso: curso || 'todos',
  });
}

async function fetchFromUpstreamDeduped({ endpoint, ano, campus, curso, hfUrl, requestId }) {
  const key = buildInflightKey({ endpoint, ano, campus, curso });

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const promise = (async () => {
    const hfRes = await fetchJsonWithRetry(
      hfUrl,
      getUpstreamTimeout(endpoint),
      getRetryCount(endpoint)
    );

    if (!hfRes.ok) {
      const text = await hfRes.text().catch(() => '');

      console.error(
        `[dashboard-cache][${requestId}] hf response error:`,
        hfRes.status,
        text
      );

      const error = new Error('Falha ao buscar dados da API de origem.');
      error.status = hfRes.status;
      error.details = text;
      throw error;
    }

    try {
      return await hfRes.json();
    } catch (jsonError) {
      console.error(
        `[dashboard-cache][${requestId}] invalid JSON from HF:`,
        jsonError
      );

      const error = new Error('A API de origem retornou uma resposta inválida.');
      error.details = jsonError?.message ?? 'JSON inválido';
      throw error;
    }
  })();

  inflightRequests.set(key, promise);

  try {
    return await promise;
  } finally {
    inflightRequests.delete(key);
  }
}

export async function GET(req) {
  const requestId = Math.random().toString(36).slice(2, 10);

  try {
    const { searchParams } = new URL(req.url);

    const endpoint = searchParams.get('endpoint');
    const fresh = searchParams.get('fresh') === '1';
    const anoRaw = searchParams.get('ano');
    const campus = normalizeTextParam(searchParams.get('campus'), 'todos');
    const curso = normalizeTextParam(searchParams.get('curso'), 'todos');

    if (!endpoint) {
      return Response.json(
        { error: 'Parâmetro "endpoint" é obrigatório.' },
        { status: 400 }
      );
    }

    const ano = anoRaw && String(anoRaw).trim() ? String(anoRaw).trim() : null;
    const memoryKey = buildMemoryKey({ endpoint, ano, campus, curso });

    const endpointsSemAno = new Set(['/filters', '/health', '/']);
    if (!ano && !endpointsSemAno.has(endpoint)) {
      return Response.json(
        { error: 'Parâmetro "ano" é obrigatório para esse endpoint.' },
        { status: 400 }
      );
    }

    const hfUrl = buildHfUrl(endpoint, ano, campus, curso);

    let skipCache = fresh || shouldBypassCache(endpoint);
    let cacheAvailable = false;

    if (!fresh) {
      const memoryEntry = getMemoryCacheEntry(memoryKey);
      if (memoryEntry && memoryEntry.age <= MEMORY_CACHE_TTL_MS) {
        return Response.json(memoryEntry.payload, {
          headers: {
            'X-Data-Source': 'memory-cache',
            'X-Cache-Status': 'HIT',
          },
        });
      }
    }

    if (!skipCache) {
      cacheAvailable = await tryEnsureCacheTable(requestId);
      if (!cacheAvailable) {
        skipCache = true;
      }
    }

    if (!skipCache && cacheAvailable) {
      try {
        const cached = await getCachedPayload({
          endpoint,
          ano,
          campus,
          curso,
        });

        if (cached !== null) {
          setMemoryCacheEntry(memoryKey, cached);
          return Response.json(cached, {
            headers: {
              'X-Data-Source': 'neon-cache',
              'X-Cache-Status': 'HIT',
            },
          });
        }
      } catch (cacheReadError) {
        console.error(
          `[dashboard-cache][${requestId}] cache read error:`,
          cacheReadError
        );

        if (isCacheTimeoutError(cacheReadError)) {
          disableCacheTemporarily(120000);
          skipCache = true;
        }
      }
    }

    let payload;
    try {
      payload = await fetchFromUpstreamDeduped({
        endpoint,
        ano,
        campus,
        curso,
        hfUrl,
        requestId,
      });
    } catch (fetchError) {
      console.error(`[dashboard-cache][${requestId}] hf fetch error:`, fetchError);

      if (!fresh) {
        const memoryEntry = getMemoryCacheEntry(memoryKey);
        if (memoryEntry) {
          return Response.json(memoryEntry.payload, {
            headers: {
              'X-Data-Source': 'memory-cache-stale',
              'X-Cache-Status': 'STALE',
            },
          });
        }
      }

      return Response.json(
        {
          error: 'Falha de rede ao buscar dados da API de origem.',
          endpoint,
          hfUrl,
          details: fetchError?.details ?? fetchError?.message ?? 'Erro desconhecido',
        },
        { status: 502 }
      );
    }

    if (!skipCache) {
      try {
        await saveCachedPayload({
          endpoint,
          ano,
          campus,
          curso,
          hfUrl,
          payload,
        });
      } catch (cacheWriteError) {
        console.error(
          `[dashboard-cache][${requestId}] cache write error:`,
          cacheWriteError
        );

        if (isCacheTimeoutError(cacheWriteError)) {
          disableCacheTemporarily(120000);
        }
      }
    }

    setMemoryCacheEntry(memoryKey, payload);

    return Response.json(payload, {
      headers: {
        'X-Data-Source': skipCache ? 'huggingface-no-cache' : 'huggingface',
        'X-Cache-Status': skipCache ? 'BYPASS' : 'MISS',
      },
    });
  } catch (error) {
    console.error('[dashboard-cache][fatal]', error);

    return Response.json(
      {
        error: 'Erro interno no cache do dashboard.',
        details: error?.message ?? 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}