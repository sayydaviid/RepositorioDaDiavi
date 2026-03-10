// app/api/dashboard-cache/route.js
import { ensureCacheTable, getCachedPayload, saveCachedPayload } from '../../avaliacao/avalia/lib/neon-cache';

const HF_BASE = 'https://sayydaviid-avalia-backend.hf.space';

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

  // /filters sem ano deve funcionar sem campus/curso
  if (endpoint !== '/filters') {
    qs.set('campus', campus);
    qs.set('curso', curso);
  }

  const query = qs.toString();
  return `${HF_BASE}${endpoint}${query ? `?${query}` : ''}`;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const endpoint = searchParams.get('endpoint');
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

    const endpointsSemAno = new Set(['/filters', '/health', '/']);
    if (!ano && !endpointsSemAno.has(endpoint)) {
      return Response.json(
        { error: 'Parâmetro "ano" é obrigatório para esse endpoint.' },
        { status: 400 }
      );
    }

    await ensureCacheTable();

    const cached = await getCachedPayload({
      endpoint,
      ano,
      campus,
      curso,
    });

    if (cached !== null) {
      return Response.json(cached, {
        headers: {
          'X-Data-Source': 'neon-cache',
        },
      });
    }

    const hfUrl = buildHfUrl(endpoint, ano, campus, curso);

    const hfRes = await fetch(hfUrl, {
      cache: 'no-store',
    });

    if (!hfRes.ok) {
      const text = await hfRes.text();
      return Response.json(
        {
          error: 'Falha ao buscar dados da API de origem.',
          status: hfRes.status,
          endpoint,
          details: text,
          hfUrl,
        },
        { status: 502 }
      );
    }

    const payload = await hfRes.json();

    await saveCachedPayload({
      endpoint,
      ano,
      campus,
      curso,
      hfUrl,
      payload,
    });

    return Response.json(payload, {
      headers: {
        'X-Data-Source': 'huggingface',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: 'Erro interno no cache do dashboard.',
        details: error?.message ?? 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}