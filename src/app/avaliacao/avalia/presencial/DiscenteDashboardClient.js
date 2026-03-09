'use client';

import { useState, useEffect, useMemo } from 'react';
import DiscenteFilters from '../components/DiscenteFilterAvalia';
import StatCard from '../components/StatCard';
import LoadingOverlay from '../components/LoadingOverlay';
import styles from '../../../../styles/dados.module.css';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';

// ✅ Abas modularizadas
import DimensoesGeraisTab from './dimensoes_gerais/DimensoesGeraisTab';
import AutoavaliacaoTab from './autoavaliacao_discente/AutoavaliacaoTab';
import AtividadesAcademicasTab from './atividades_academicas/AtividadesAcademicasTab';
import BaseDocenteTab from './base_docente/BaseDocenteTab';
import InstalacoesFisicasTab from './instalacoes_fisicas/InstalacoesFisicasTab';

const API_BASE =
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE) || '';

const make = (path) => (API_BASE ? `${API_BASE}${path}` : `/backend${path}`);

// ======================================================
// LIMITADOR GLOBAL DE CONCORRÊNCIA (2–3 simultâneos)
// ======================================================
const MAX_CONCURRENT_REQUESTS = 3;

function abortError() {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

function createPromisePool(concurrency = 3) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= concurrency) return;
    const item = queue.shift();
    if (!item) return;

    active++;
    const { task, resolve, reject } = item;

    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return function pool(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
  };
}

const requestPool = createPromisePool(MAX_CONCURRENT_REQUESTS);

function pooled(task, signal) {
  return requestPool(async () => {
    if (signal?.aborted) throw abortError();
    return task();
  });
}

const disableZoomOptions = {
  chart: {
    zoom: { enabled: false },
    toolbar: { show: false },
  },
};

const twoDecTooltip = (suffix = '') => ({
  callbacks: {
    label: (ctx) => {
      const lbl = ctx.dataset?.label ? `${ctx.dataset.label}: ` : '';
      const v =
        typeof ctx.parsed === 'object'
          ? ctx.parsed?.y ?? ctx.raw
          : ctx.parsed ?? ctx.raw;
      const num = Number(v);
      return `${lbl}${Number.isFinite(num) ? num.toFixed(2) : v}${suffix}`;
    },
  },
});

function wrapLabel(label, maxWidth = 20) {
  if (typeof label !== 'string' || label.length <= maxWidth) return label;
  const words = label.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + word).length <= maxWidth || currentLine.length === 0) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatItemCodeLabel(val) {
  const s = String(val ?? '').trim();

  const m = s.match(/^(\d+)\.(\d{2})(.*)$/);
  if (m) {
    const [, p1, p2, rest] = m;
    if (p2.startsWith('1')) {
      const finalCode = `${p1}.1.${p2.slice(1)}`;
      return rest && rest.trim() ? `${finalCode}${rest}` : finalCode;
    }
    return s;
  }

  if (/^\d{3,}$/.test(s)) {
    return `${s.slice(0, -2)}.${s.slice(-2)}`;
  }

  return s;
}

function formatProporcoesChartData(apiData) {
  if (!apiData || apiData.length === 0) return { labels: [], datasets: [] };
  const labels = [...new Set(apiData.map((item) => item.dimensao))].map((l) =>
    wrapLabel(l)
  );
  const conceitos = ['Excelente', 'Bom', 'Regular', 'Insuficiente'];
  const colorMap = {
    Excelente: '#1D556F',
    Bom: '#288FB4',
    Regular: '#F0B775',
    Insuficiente: '#FA360A',
  };
  const datasets = conceitos.map((conceito) => ({
    label: conceito,
    data: labels.map((label) => {
      const originalLabel = Array.isArray(label) ? label.join(' ') : label;
      return (
        apiData.find(
          (d) => d.dimensao === originalLabel && d.conceito === conceito
        )?.valor || 0
      );
    }),
    backgroundColor: colorMap[conceito],
  }));
  return { labels, datasets };
}

function formatMediasChartData(apiData) {
  if (!apiData || apiData.length === 0) return { labels: [], datasets: [] };
  return {
    labels: apiData.map((d) => wrapLabel(d.dimensao)),
    datasets: [
      {
        label: 'Média',
        data: apiData.map((d) => d.media),
        backgroundColor: 'rgba(40,143,180,.7)',
      },
    ],
  };
}

function formatAtividadesChartData(apiData) {
  if (!apiData || apiData.length === 0) return { labels: [], datasets: [] };
  return {
    labels: apiData.map((d) => wrapLabel(d.atividade, 25)),
    datasets: [
      {
        label: 'Percentual de Participação',
        data: apiData.map((d) => d.percentual),
        backgroundColor: 'rgba(40,143,180,.7)',
      },
    ],
  };
}

function formatProporcoesItensChartData(apiData) {
  if (!apiData || apiData.length === 0) return { labels: [], datasets: [] };
  const rawItems = [...new Set(apiData.map((item) => item.item))].sort();
  const labels = rawItems.map((it) => wrapLabel(formatItemCodeLabel(it), 25));
  const conceitos = ['Excelente', 'Bom', 'Regular', 'Insuficiente'];
  const colorMap = {
    Excelente: '#1D556F',
    Bom: '#288FB4',
    Regular: '#F0B775',
    Insuficiente: '#FA360A',
  };
  const datasets = conceitos.map((conceito) => ({
    label: conceito,
    data: rawItems.map(
      (raw) =>
        apiData.find((d) => d.item === raw && d.conceito === conceito)?.valor ||
        0
    ),
    backgroundColor: colorMap[conceito],
  }));
  return { labels, datasets };
}

function formatMediasItensChartData(apiData) {
  if (!apiData || apiData.length === 0) return { labels: [], datasets: [] };
  const sorted = [...apiData].sort((a, b) =>
    String(a.item).localeCompare(String(b.item))
  );
  return {
    labels: sorted.map((d) => wrapLabel(formatItemCodeLabel(d.item), 25)),
    datasets: [
      {
        label: 'Média',
        data: sorted.map((d) => d.media),
        backgroundColor: 'rgba(40,143,180,.7)',
      },
    ],
  };
}

function formatProporcoesSubdimChartData(apiData) {
  if (!apiData || apiData.length === 0) return { labels: [], datasets: [] };
  const labels = [...new Set(apiData.map((item) => item.subdimensao))]
    .sort()
    .map((l) => wrapLabel(l));
  const conceitos = ['Excelente', 'Bom', 'Regular', 'Insuficiente'];
  const colorMap = {
    Excelente: '#1D556F',
    Bom: '#288FB4',
    Regular: '#F0B775',
    Insuficiente: '#FA360A',
  };
  const datasets = conceitos.map((conceito) => ({
    label: conceito,
    data: labels.map((label) => {
      const originalLabel = Array.isArray(label) ? label.join(' ') : label;
      const v =
        apiData.find(
          (d) => d.subdimensao === originalLabel && d.conceito === conceito
        )?.valor ?? 0;
      return Number(Number(v).toFixed(2));
    }),
    backgroundColor: colorMap[conceito],
  }));
  return { labels, datasets };
}

function formatMediasSubdimChartData(apiData) {
  if (!apiData || apiData.length === 0) return { labels: [], datasets: [] };
  const sorted = [...apiData].sort((a, b) =>
    String(a.subdimensao).localeCompare(String(b.subdimensao))
  );
  return {
    labels: sorted.map((d) => wrapLabel(d.subdimensao)),
    datasets: [
      {
        label: 'Média',
        data: sorted.map((d) => Number(Number(d.media ?? 0).toFixed(2))),
        backgroundColor: 'rgba(40,143,180,.7)',
      },
    ],
  };
}

const formatMediasDimDocente = formatMediasChartData;
const formatProporcoesDimDocente = formatProporcoesChartData;

function normalizeAtitudeDocenteChartData(chartData) {
  if (!chartData) return chartData;
  const fixLabel = (label) => {
    const isArray = Array.isArray(label);
    const text = isArray ? label.join(' ') : String(label ?? '').trim();
    const m = text.match(/^(\d+)\.(\d{2})(.*)$/);
    if (m && m[2].startsWith('1')) {
      const [, p1, p2, rest] = m;
      const finalCode = `${p1}.1.${p2.slice(1)}`;
      const finalText = rest ? `${finalCode}${rest}` : finalCode;
      return isArray ? [finalText] : finalText;
    }
    return label;
  };
  return {
    ...chartData,
    labels: chartData.labels ? chartData.labels.map(fixLabel) : [],
  };
}

const v0 = (x) => (Array.isArray(x) ? x?.[0] : x);

const emptyDetailData = () => ({
  autoavaliacao: { propItens: null, medItens: null, boxItens: null },
  acao_docente_discente: { propSub: null, medSub: null, boxSub: null },
  autoavaliacao_docente: { propSub: null, medSub: null, boxSub: null },
  atitude: {
    discProp: null,
    discMed: null,
    discBox: null,
    docProp: null,
    docMed: null,
    docBox: null,
  },
  gestao: {
    discMed: null,
    discProp: null,
    discBox: null,
    docMed: null,
    docProp: null,
    docBox: null,
  },
  processo: {
    discMed: null,
    discProp: null,
    discBox: null,
    docMed: null,
    docProp: null,
  },
  instalacoes: {
    medItens: null,
    propItens: null,
    boxDisc: null,
    medDoc: null,
    propDoc: null,
  },
  atividades: { doc: null },
  base_docente: {
    turmaMed: null,
    turmaProp: null,
    subMed: null,
    subProp: null,
    dimMed: null,
    dimProp: null,
  },
});

async function fetchJson(url, signal, errMsg) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(errMsg || 'Falha ao buscar dados da API R');
  return r.json();
}

async function fetchJsonOptional(url, signal) {
  try {
    return await fetchJson(url, signal);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return null;
  }
}

function coerceRows(apiData) {
  if (Array.isArray(apiData)) return apiData;
  if (!apiData || typeof apiData !== 'object') return [];
  const candidates = [
    'data',
    'tabela',
    'tabela2',
    'tabela_items',
    'rows',
    'result',
    'descritivas',
  ];
  for (const k of candidates) {
    if (Array.isArray(apiData?.[k])) return apiData[k];
  }
  return [];
}

function renderDescritivasTable(apiData) {
  const rows = coerceRows(apiData);
  if (!rows.length)
    return (
      <p style={{ textAlign: 'center' }}>
        Estatísticas descritivas não disponíveis.
      </p>
    );

  const hasOwn = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

  const pick = (obj, candidates) => {
    for (const c of candidates) if (hasOwn(obj, c)) return obj[c];
    return undefined;
  };

  const fmt = (v) => {
    if (v === null || v === undefined) return '';
    const num = Number(v);
    if (Number.isFinite(num) && typeof v !== 'boolean') return num.toFixed(2);
    return String(v);
  };

  const firstKeys = Object.keys(rows[0] || {});
  const hasItemCol = firstKeys.some((k) => k.toLowerCase() === 'item');
  const hasMinLike = firstKeys.some((k) => k.toLowerCase() === 'min');

  if (hasItemCol && hasMinLike) {
    const itemKey =
      firstKeys.find((k) => k.toLowerCase() === 'item') || 'item';

    const byItem = new Map();
    for (const r of rows) {
      const it = pick(r, [itemKey, 'Item', 'ITEM']);
      if (it !== undefined && it !== null && String(it).trim() !== '') {
        byItem.set(String(it).trim(), r);
      }
    }

    const items = Array.from(byItem.keys());

    const parseCode = (s) =>
      String(s)
        .split('.')
        .map((x) => parseInt(x, 10))
        .filter((n) => Number.isFinite(n));

    items.sort((a, b) => {
      const A = parseCode(a);
      const B = parseCode(b);
      const len = Math.max(A.length, B.length);
      for (let i = 0; i < len; i++) {
        const av = A[i] ?? -1;
        const bv = B[i] ?? -1;
        if (av !== bv) return av - bv;
      }
      return String(a).localeCompare(String(b));
    });

    const stats = [
      { label: 'Min', keys: ['Min', 'min', 'MIN'] },
      { label: '1º Q.', keys: ['Q1', 'q1', '1st Qu.', '1st Qu', '1st_qu', '1st_qu.'] },
      { label: 'Mediana', keys: ['Mediana', 'mediana', 'Median', 'median'] },
      { label: 'Média', keys: ['Media', 'media', 'Mean', 'mean'] },
      { label: '3º Q.', keys: ['Q3', 'q3', '3rd Qu.', '3rd Qu', '3rd_qu', '3rd_qu.'] },
      { label: 'Max', keys: ['Max', 'max', 'MAX'] },
    ];

    return (
      <div style={{ width: '100%', padding: '0 10px', overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            backgroundColor: '#fff',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 8px',
                  borderBottom: '2px solid rgba(0,0,0,0.12)',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                Estatística
              </th>
              {items.map((it) => (
                <th
                  key={it}
                  style={{
                    textAlign: 'left',
                    padding: '10px 8px',
                    borderBottom: '2px solid rgba(0,0,0,0.12)',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {it}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {stats.map((st) => (
              <tr key={st.label}>
                <td
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {st.label}
                </td>

                {items.map((it) => {
                  const r = byItem.get(it);
                  const v = r ? pick(r, st.keys) : '';
                  return (
                    <td
                      key={`${st.label}-${it}`}
                      style={{
                        padding: '8px',
                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const keys = Object.keys(rows[0] || {});
  const preferredOrder = [
    'Estatística',
    'Estatistica',
    'estatistica',
    'Estatistica.',
    'dimensao',
    'DIMENSAO',
    'item',
    'ITEM',
    'n',
    'N',
    'media',
    'MEDIA',
    'media_geral',
    'desvio_padrao',
    'DP',
    'sd',
    'min',
    'MIN',
    'q1',
    'Q1',
    'mediana',
    'MEDIANA',
    'q3',
    'Q3',
    'max',
    'MAX',
  ];

  const ordered = [];
  for (const k of preferredOrder) if (keys.includes(k)) ordered.push(k);
  for (const k of keys) if (!ordered.includes(k)) ordered.push(k);

  return (
    <div style={{ width: '100%', padding: '0 10px', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          backgroundColor: '#fff',
        }}
      >
        <thead>
          <tr>
            {ordered.map((k) => (
              <th
                key={k}
                style={{
                  textAlign: 'left',
                  padding: '10px 8px',
                  borderBottom: '2px solid rgba(0,0,0,0.12)',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              {ordered.map((k) => (
                <td
                  key={k}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmt(r?.[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pickCampusRow(objLike) {
  const row = v0(objLike);
  if (!row || typeof row !== 'object') return null;
  const campus =
    row?.CAMPUS ??
    row?.campus ??
    row?.Campus ??
    row?.nome_campus ??
    null;
  const media =
    row?.media_geral ??
    row?.MEDIA_GERAL ??
    row?.media ??
    row?.MEDIA ??
    row?.Media ??
    null;
  return { campus, media };
}

export default function DiscenteDashboardClient({ initialData, filtersOptions }) {
  const [activeTab, setActiveTab] = useState('dimensoes');
  const [selectedFilters, setSelectedFilters] = useState({
    ano: '',
    campus: 'todos',
    curso: 'todos',
  });

  const [summaryData, setSummaryData] = useState(initialData?.summary ?? null);
  const [dashboardData, setDashboardData] = useState(() => ({
    proporcoes: initialData?.proporcoes ?? null,
    boxplot: initialData?.boxplot ?? null,
    atividades: initialData?.atividades ?? null,
    medias: initialData?.medias ?? null,
    docDimMedias: initialData?.docDimMedias ?? null,
    docDimProporcoes: initialData?.docDimProporcoes ?? null,
    turmaDimBoxplot: initialData?.turmaDimBoxplot ?? null,
    turmaDimDescritivas: initialData?.turmaDimDescritivas ?? null,
  }));

  const [detailData, setDetailData] = useState(() => emptyDetailData());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tabLoading, setTabLoading] = useState({});
  const [loadedTabs, setLoadedTabs] = useState({ dimensoes: true });

  const hasSelectedYear = Boolean(selectedFilters.ano);

  const params = useMemo(
    () => new URLSearchParams(selectedFilters).toString(),
    [selectedFilters]
  );

  useEffect(() => {
    if (!hasSelectedYear) {
      setIsLoading(false);
      setError(null);
      setSummaryData(null);
      setDashboardData({
        proporcoes: null,
        boxplot: null,
        atividades: null,
        medias: null,
        docDimMedias: null,
        docDimProporcoes: null,
        turmaDimBoxplot: null,
        turmaDimDescritivas: null,
      });
      setDetailData(emptyDetailData());
      setLoadedTabs({ dimensoes: true });
      setTabLoading({});
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const pFetch = (url, errMsg) =>
      pooled(
        () => fetchJson(url, controller.signal, errMsg),
        controller.signal
      );
    const pFetchOpt = (url) =>
      pooled(
        () => fetchJsonOptional(url, controller.signal),
        controller.signal
      );

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const urlSummary = make(`/discente/geral/summary?${params}`);
        const urlDiscMed = make(`/discente/dimensoes/medias?${params}`);
        const urlDiscProp = make(`/discente/dimensoes/proporcoes?${params}`);
        const urlDiscBox = make(`/discente/dimensoes/boxplot?${params}`);
        const urlDiscAtiv = make(`/discente/atividades/percentual?${params}`);

        const urlDocDimMed = make(`/docente/dimensoes/medias?${params}`);
        const urlDocDimProp = make(`/docente/dimensoes/proporcoes?${params}`);

        const urlTurmaDimBoxNew = make(
          `/docente/avaliacaoturma/dimensoes/boxplot?${params}`
        );
        const urlTurmaDimDescNew = make(
          `/docente/avaliacaoturma/dimensoes/descritivas?${params}`
        );

        const [summary, medias, proporcoes, boxplot, atividades] =
          await Promise.all([
            pFetch(urlSummary, 'Falha ao buscar summary'),
            pFetch(urlDiscMed, 'Falha ao buscar medias'),
            pFetch(urlDiscProp, 'Falha ao buscar proporcoes'),
            pFetch(urlDiscBox, 'Falha ao buscar boxplot'),
            pFetch(urlDiscAtiv, 'Falha ao buscar atividades'),
          ]);

        const [docDimMedias, docDimProporcoes] = await Promise.all([
          pFetchOpt(urlDocDimMed),
          pFetchOpt(urlDocDimProp),
        ]);

        let turmaDimBoxplot = await pFetchOpt(urlTurmaDimBoxNew);
        if (!turmaDimBoxplot) {
          turmaDimBoxplot = await pFetchOpt(
            make(`/docente/dimensoes/boxplot?${params}`)
          );
        }

        let turmaDimDescritivas = await pFetchOpt(urlTurmaDimDescNew);

        if (
          !turmaDimDescritivas &&
          turmaDimBoxplot &&
          typeof turmaDimBoxplot === 'object'
        ) {
          const hasTabela =
            Array.isArray(turmaDimBoxplot?.tabela2) ||
            Array.isArray(turmaDimBoxplot?.tabela) ||
            Array.isArray(turmaDimBoxplot?.rows);

          if (hasTabela) turmaDimDescritivas = turmaDimBoxplot;
        }

        if (!turmaDimDescritivas) {
          turmaDimDescritivas = await pFetchOpt(
            make(`/docente/avaliacaoturma/dimensoes/estatisticas?${params}`)
          );
        }

        if (!turmaDimDescritivas) {
          turmaDimDescritivas = await pFetchOpt(
            make(`/docente/dimensoes/descritivas?${params}`)
          );
        }

        if (cancelled) return;

        setSummaryData(summary);
        setDashboardData({
          medias,
          proporcoes,
          boxplot,
          atividades,
          docDimMedias,
          docDimProporcoes,
          turmaDimBoxplot,
          turmaDimDescritivas,
        });
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        setError(err?.message ?? 'Erro ao carregar dados gerais');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    setLoadedTabs({ dimensoes: true });
    setTabLoading({});
    setDetailData(emptyDetailData());

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [params, hasSelectedYear]);

  useEffect(() => {
    if (!hasSelectedYear) return;

    const controller = new AbortController();
    let cancelled = false;

    const pFetch = (url, errMsg) =>
      pooled(
        () => fetchJson(url, controller.signal, errMsg),
        controller.signal
      );
    const pFetchOpt = (url) =>
      pooled(
        () => fetchJsonOptional(url, controller.signal),
        controller.signal
      );

    const runTab = async (tabKey) => {
      if (!tabKey || tabKey === 'dimensoes') return;
      if (loadedTabs[tabKey]) return;

      setTabLoading((p) => ({ ...p, [tabKey]: true }));
      setError(null);

      try {
        if (tabKey === 'autoavaliacao') {
          const [
            propItens,
            medItens,
            boxItens,
            acPropSub,
            acMedSub,
            acBoxSub,
            adProp,
            adMed,
            adBox,
            atiProp,
            atiMed,
            atiBox,
            gesProp,
            gesMed,
            gesBox,
            proProp,
            proMed,
            proBox,
            instProp,
            instMed,
            instBox,
          ] = await Promise.all([
            pFetch(
              make(`/discente/autoavaliacao/itens/proporcoes?${params}`),
              'Falha (Autoavaliação proporções)'
            ),
            pFetch(
              make(`/discente/autoavaliacao/itens/medias?${params}`),
              'Falha (Autoavaliação médias)'
            ),
            pFetch(
              make(`/discente/autoavaliacao/itens/boxplot?${params}`),
              'Falha (Autoavaliação boxplot)'
            ),

            pFetch(
              make(`/discente/acaodocente/subdimensoes/proporcoes?${params}`),
              'Falha (Ação Docente subdim proporções)'
            ),
            pFetch(
              make(`/discente/acaodocente/subdimensoes/medias?${params}`),
              'Falha (Ação Docente subdim médias)'
            ),
            pFetchOpt(
              make(`/discente/acaodocente/subdimensoes/boxplot?${params}`)
            ),

            pFetch(
              make(`/docente/autoavaliacao/subdimensoes/proporcoes?${params}`),
              'Falha (Ação Docente docente proporções)'
            ),
            pFetch(
              make(`/docente/autoavaliacao/subdimensoes/medias?${params}`),
              'Falha (Ação Docente docente médias)'
            ),
            pFetch(
              make(`/docente/autoavaliacao/subdimensoes/boxplot?${params}`),
              'Falha (Ação Docente docente boxplot)'
            ),

            pFetch(
              make(`/discente/atitudeprofissional/itens/proporcoes?${params}`),
              'Falha (Atitude proporções)'
            ),
            pFetch(
              make(`/discente/atitudeprofissional/itens/medias?${params}`),
              'Falha (Atitude médias)'
            ),
            pFetch(
              make(`/discente/atitudeprofissional/itens/boxplot?${params}`),
              'Falha (Atitude boxplot)'
            ),

            pFetch(
              make(`/discente/gestaodidatica/itens/proporcoes?${params}`),
              'Falha (Gestão proporções)'
            ),
            pFetch(
              make(`/discente/gestaodidatica/itens/medias?${params}`),
              'Falha (Gestão médias)'
            ),
            pFetch(
              make(`/discente/gestaodidatica/itens/boxplot?${params}`),
              'Falha (Gestão boxplot)'
            ),

            pFetch(
              make(`/discente/processoavaliativo/itens/proporcoes?${params}`),
              'Falha (Processo proporções)'
            ),
            pFetch(
              make(`/discente/processoavaliativo/itens/medias?${params}`),
              'Falha (Processo médias)'
            ),
            pFetch(
              make(`/discente/processoavaliativo/itens/boxplot?${params}`),
              'Falha (Processo boxplot)'
            ),

            pFetch(
              make(`/discente/instalacoes/itens/proporcoes?${params}`),
              'Falha (Instalações proporções)'
            ),
            pFetch(
              make(`/discente/instalacoes/itens/medias?${params}`),
              'Falha (Instalações médias)'
            ),
            pFetch(
              make(`/discente/instalacoes/itens/boxplot?${params}`),
              'Falha (Instalações boxplot)'
            ),
          ]);

          if (cancelled) return;

          setDetailData((prev) => ({
            ...prev,
            autoavaliacao: { propItens, medItens, boxItens },
            acao_docente_discente: {
              propSub: acPropSub,
              medSub: acMedSub,
              boxSub: acBoxSub,
            },
            autoavaliacao_docente: { propSub: adProp, medSub: adMed, boxSub: adBox },
            atitude: {
              ...prev.atitude,
              discProp: atiProp,
              discMed: atiMed,
              discBox: atiBox,
            },
            gestao: {
              ...prev.gestao,
              discProp: gesProp,
              discMed: gesMed,
              discBox: gesBox,
            },
            processo: {
              ...prev.processo,
              discProp: proProp,
              discMed: proMed,
              discBox: proBox,
            },
            instalacoes: {
              ...prev.instalacoes,
              propItens: instProp,
              medItens: instMed,
              boxDisc: instBox,
            },
          }));
        } else if (tabKey === 'base_docente') {
          const [
            turmaMed,
            turmaProp,
            subMed,
            subProp,
            dimMed,
            dimProp,
            atiProp,
            atiMed,
            gesProp,
            gesMed,
            proProp,
            proMed,
            instMedDoc,
            instPropDoc,
          ] = await Promise.all([
            pFetch(
              make(`/docente/avaliacaoturma/itens/medias?${params}`),
              'Falha (turma médias)'
            ),
            pFetch(
              make(`/docente/avaliacaoturma/itens/proporcoes?${params}`),
              'Falha (turma proporções)'
            ),
            pFetch(
              make(`/docente_base/autoavaliacao/subdimensoes/medias?${params}`),
              'Falha (subdim médias)'
            ),
            pFetch(
              make(`/docente_base/autoavaliacao/subdimensoes/proporcoes?${params}`),
              'Falha (subdim proporções)'
            ),
            pFetch(make(`/docente/dimensoes/medias?${params}`), 'Falha (dim médias)'),
            pFetch(
              make(`/docente/dimensoes/proporcoes?${params}`),
              'Falha (dim proporções)'
            ),

            pFetch(
              make(`/docente/atitudeprofissional/itens/proporcoes?${params}`),
              'Falha (Atitude docente prop)'
            ),
            pFetch(
              make(`/docente/atitudeprofissional/itens/medias?${params}`),
              'Falha (Atitude docente med)'
            ),

            pFetch(
              make(`/docente/gestaodidatica/itens/proporcoes?${params}`),
              'Falha (Gestão docente prop)'
            ),
            pFetch(
              make(`/docente/gestaodidatica/itens/medias?${params}`),
              'Falha (Gestão docente med)'
            ),

            pFetch(
              make(`/docente/processoavaliativo/itens/proporcoes?${params}`),
              'Falha (Processo docente prop)'
            ),
            pFetch(
              make(`/docente/processoavaliativo/itens/medias?${params}`),
              'Falha (Processo docente med)'
            ),

            pFetch(
              make(`/docente/instalacoes/itens/medias?${params}`),
              'Falha (Instalações docente med)'
            ),
            pFetch(
              make(`/docente/instalacoes/itens/proporcoes?${params}`),
              'Falha (Instalações docente prop)'
            ),
          ]);

          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            base_docente: { turmaMed, turmaProp, subMed, subProp, dimMed, dimProp },
            atitude: { ...prev.atitude, docProp: atiProp, docMed: atiMed },
            gestao: { ...prev.gestao, docProp: gesProp, docMed: gesMed },
            processo: { ...prev.processo, docProp: proProp, docMed: proMed },
            instalacoes: {
              ...prev.instalacoes,
              medDoc: instMedDoc,
              propDoc: instPropDoc,
            },
          }));
        } else if (tabKey === 'instalacoes') {
          const [medItens, propItens, boxDisc, medDoc, propDoc] = await Promise.all([
            pFetch(
              make(`/discente/instalacoes/itens/medias?${params}`),
              'Falha ao buscar instalações (discente médias)'
            ),
            pFetch(
              make(`/discente/instalacoes/itens/proporcoes?${params}`),
              'Falha ao buscar instalações (discente proporções)'
            ),
            pFetch(
              make(`/discente/instalacoes/itens/boxplot?${params}`),
              'Falha ao buscar instalações (discente boxplot)'
            ),
            pFetch(
              make(`/docente/instalacoes/itens/medias?${params}`),
              'Falha ao buscar instalações (docente médias)'
            ),
            pFetch(
              make(`/docente/instalacoes/itens/proporcoes?${params}`),
              'Falha ao buscar instalações (docente proporções)'
            ),
          ]);

          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            instalacoes: { medItens, propItens, boxDisc, medDoc, propDoc },
          }));
        } else if (tabKey === 'atividades') {
          const doc = await pFetch(
            make(`/docente/atividades/percentual?${params}`),
            'Falha ao buscar atividades do docente'
          );
          if (cancelled) return;
          setDetailData((prev) => ({ ...prev, atividades: { doc } }));
        }

        if (!cancelled) setLoadedTabs((p) => ({ ...p, [tabKey]: true }));
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        setError(err?.message ?? 'Erro ao carregar dados da aba');
      } finally {
        if (!cancelled) setTabLoading((p) => ({ ...p, [tabKey]: false }));
      }
    };

    runTab(activeTab);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, params, loadedTabs, hasSelectedYear]);

  const datasets = useMemo(
    () => ({
      discProporcoes: formatProporcoesChartData(dashboardData.proporcoes),
      discMedias: formatMediasChartData(dashboardData.medias),
      docProporcoes: formatProporcoesDimDocente(dashboardData.docDimProporcoes),
      docMedias: formatMediasDimDocente(dashboardData.docDimMedias),
      atividades: formatAtividadesChartData(dashboardData.atividades),
    }),
    [dashboardData]
  );

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setSelectedFilters((prev) => ({ ...prev, [name]: value }));
  };

  const tabs = useMemo(
    () => [
      { key: 'dimensoes', label: 'Dimensões Gerais' },
      { key: 'autoavaliacao', label: 'Autoavaliação Discente' },
      { key: 'base_docente', label: 'Avaliação da Ação Docente' },
      { key: 'instalacoes', label: 'Instalações Físicas' },
      { key: 'atividades', label: 'Atividades Acadêmicas' },
    ],
    []
  );

  const isGlobalLoading = isLoading;
  const isTabLoading = !!tabLoading[activeTab];

  const dd = detailData;

  const itensAutoProp = dd.autoavaliacao?.propItens;
  const itensAutoMed = dd.autoavaliacao?.medItens;
  const itensAutoBox = dd.autoavaliacao?.boxItens;

  const acaoDocSubPropDisc = dd.acao_docente_discente?.propSub;
  const acaoDocSubMedDisc = dd.acao_docente_discente?.medSub;
  const acaoDocSubBoxDisc = dd.acao_docente_discente?.boxSub;

  const docenteProp = dd.autoavaliacao_docente?.propSub;
  const docenteMed = dd.autoavaliacao_docente?.medSub;
  const docenteBox = dd.autoavaliacao_docente?.boxSub;

  const itensAtitudePropDisc = dd.atitude?.discProp;
  const itensAtitudeMedDisc = dd.atitude?.discMed;
  const itensAtitudeBoxDisc = dd.atitude?.discBox;

  const itensGestaoMedDisc = dd.gestao?.discMed;
  const itensGestaoPropDisc = dd.gestao?.discProp;
  const itensGestaoBoxDisc = dd.gestao?.discBox;

  const procDiscMed = dd.processo?.discMed;
  const procDiscProp = dd.processo?.discProp;
  const procDiscBox = dd.processo?.discBox;

  const itensInstalacoesMed = dd.instalacoes?.medItens;
  const itensInstalacoesProp = dd.instalacoes?.propItens;
  const itensInstalacoesBoxDisc = dd.instalacoes?.boxDisc;

  const atividadesDoc = dd.atividades?.doc;

  const docTurmaMed = dd.base_docente?.turmaMed;
  const docTurmaProp = dd.base_docente?.turmaProp;
  const docSubMed = dd.base_docente?.subMed;
  const docSubProp = dd.base_docente?.subProp;
  const docDimMed = dd.base_docente?.dimMed;
  const docDimProp = dd.base_docente?.dimProp;

  const itensAtitudePropDoc = dd.atitude?.docProp;
  const itensAtitudeMedDoc = dd.atitude?.docMed;

  const itensGestaoMedDoc = dd.gestao?.docMed;
  const itensGestaoPropDoc = dd.gestao?.docProp;

  const procDocMed = dd.processo?.docMed;
  const procDocProp = dd.processo?.docProp;

  const itensInstalacoesMedDoc = dd.instalacoes?.medDoc;
  const itensInstalacoesPropDoc = dd.instalacoes?.propDoc;

  const xTicksNoRot = { maxRotation: 0, minRotation: 0, autoSkip: false };

  const bestCampus =
    pickCampusRow(summaryData?.campus_melhor_avaliado) ||
    pickCampusRow(summaryData?.melhor_campus_global) ||
    pickCampusRow(summaryData?.campusMelhorAvaliado) ||
    null;

  const worstCampus =
    pickCampusRow(summaryData?.campus_pior_avaliado) ||
    pickCampusRow(summaryData?.pior_campus_global) ||
    pickCampusRow(summaryData?.campusPiorAvaliado) ||
    null;

  return (
    <>
      {isGlobalLoading && <LoadingOverlay isFullScreen />}

      <div
        style={{
          opacity: isGlobalLoading ? 0.35 : 1,
          pointerEvents: isGlobalLoading ? 'none' : 'auto',
          position: 'relative',
        }}
      >
        {error && <p className={styles.errorMessage}>{error}</p>}

        {!error && (
          <>
            <div className={styles.statsGrid}>
              <StatCard
                title="Total de Respondentes"
                value={
                  hasSelectedYear
                    ? v0(summaryData?.total_respondentes) ?? '...'
                    : 'N/D'
                }
                icon={<Users />}
              />

              <StatCard
                title="Campus Melhor Avaliado"
                value={hasSelectedYear ? bestCampus?.campus ?? 'N/D' : 'N/D'}
                subtitle={`Média: ${
                  hasSelectedYear &&
                  bestCampus?.media !== null &&
                  bestCampus?.media !== undefined
                    ? Number(bestCampus.media).toFixed(2)
                    : 'N/D'
                }`}
                icon={<TrendingUp />}
              />

              <StatCard
                title="Campus Pior Avaliado"
                value={hasSelectedYear ? worstCampus?.campus ?? 'N/D' : 'N/D'}
                subtitle={`Média: ${
                  hasSelectedYear &&
                  worstCampus?.media !== null &&
                  worstCampus?.media !== undefined
                    ? Number(worstCampus.media).toFixed(2)
                    : 'N/D'
                }`}
                icon={<TrendingDown />}
              />
            </div>

            <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
              <DiscenteFilters
                filters={filtersOptions}
                selectedFilters={selectedFilters}
                onFilterChange={handleFilterChange}
              />
            </div>

            {!hasSelectedYear ? (
              <div
                className={styles.chartDisplayArea}
                style={{
                  minHeight: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '2rem',
                }}
              >
                <p style={{ fontSize: '1rem', color: '#666' }}>
                  Selecione um ano para visualizar os dados.
                </p>
              </div>
            ) : (
              <div>
                <div className={styles.tabsContainer}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={activeTab === tab.key ? styles.activeTab : styles.tab}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div
                  className={styles.chartDisplayArea}
                  style={{
                    position: 'relative',
                    minHeight: '300px',
                    overflow: 'visible',
                    height: 'auto',
                  }}
                >
                  {isTabLoading && <LoadingOverlay />}

                  {activeTab === 'dimensoes' && (
                    <DimensoesGeraisTab
                      datasets={datasets}
                      dashboardData={dashboardData}
                      styles={styles}
                      disableZoomOptions={disableZoomOptions}
                      twoDecTooltip={twoDecTooltip}
                      renderDescritivasTable={renderDescritivasTable}
                    />
                  )}

                  {activeTab === 'autoavaliacao' && (
                    <AutoavaliacaoTab
                      styles={styles}
                      disableZoomOptions={disableZoomOptions}
                      twoDecTooltip={twoDecTooltip}
                      xTicksNoRot={xTicksNoRot}
                      renderDescritivasTable={renderDescritivasTable}
                      formatMediasSubdimChartData={formatMediasSubdimChartData}
                      formatProporcoesSubdimChartData={formatProporcoesSubdimChartData}
                      formatMediasItensChartData={formatMediasItensChartData}
                      formatProporcoesItensChartData={formatProporcoesItensChartData}
                      acaoDocSubMedDisc={acaoDocSubMedDisc}
                      acaoDocSubPropDisc={acaoDocSubPropDisc}
                      acaoDocSubBoxDisc={acaoDocSubBoxDisc}
                      docenteMed={docenteMed}
                      docenteProp={docenteProp}
                      docenteBox={docenteBox}
                      itensAutoMed={itensAutoMed}
                      itensAutoProp={itensAutoProp}
                      itensAutoBox={itensAutoBox}
                      itensAtitudeMedDisc={itensAtitudeMedDisc}
                      itensAtitudePropDisc={itensAtitudePropDisc}
                      itensAtitudeBoxDisc={itensAtitudeBoxDisc}
                      itensGestaoMedDisc={itensGestaoMedDisc}
                      itensGestaoPropDisc={itensGestaoPropDisc}
                      itensGestaoBoxDisc={itensGestaoBoxDisc}
                      procDiscMed={procDiscMed}
                      procDiscProp={procDiscProp}
                      procDiscBox={procDiscBox}
                      itensInstalacoesMed={itensInstalacoesMed}
                      itensInstalacoesProp={itensInstalacoesProp}
                      itensInstalacoesBoxDisc={itensInstalacoesBoxDisc}
                    />
                  )}

                  {activeTab === 'atividades' && (
                    <AtividadesAcademicasTab
                      styles={styles}
                      disableZoomOptions={disableZoomOptions}
                      twoDecTooltip={twoDecTooltip}
                      xTicksNoRot={xTicksNoRot}
                      discenteChartData={datasets.atividades}
                      atividadesDoc={atividadesDoc}
                      formatAtividadesChartData={formatAtividadesChartData}
                    />
                  )}

                  {activeTab === 'base_docente' && (
                    <BaseDocenteTab
                      styles={styles}
                      disableZoomOptions={disableZoomOptions}
                      twoDecTooltip={twoDecTooltip}
                      xTicksNoRot={xTicksNoRot}
                      formatMediasSubdimChartData={formatMediasSubdimChartData}
                      formatProporcoesSubdimChartData={formatProporcoesSubdimChartData}
                      formatMediasItensChartData={formatMediasItensChartData}
                      formatProporcoesItensChartData={formatProporcoesItensChartData}
                      normalizeAtitudeDocenteChartData={normalizeAtitudeDocenteChartData}
                      formatMediasDimDocente={formatMediasDimDocente}
                      formatProporcoesDimDocente={formatProporcoesDimDocente}
                      docSubMed={docSubMed}
                      docSubProp={docSubProp}
                      docTurmaMed={docTurmaMed}
                      docTurmaProp={docTurmaProp}
                      itensAtitudeMedDoc={itensAtitudeMedDoc}
                      itensAtitudePropDoc={itensAtitudePropDoc}
                      itensGestaoMedDoc={itensGestaoMedDoc}
                      itensGestaoPropDoc={itensGestaoPropDoc}
                      procDocMed={procDocMed}
                      procDocProp={procDocProp}
                      itensInstalacoesMedDoc={itensInstalacoesMedDoc}
                      itensInstalacoesPropDoc={itensInstalacoesPropDoc}
                      docDimMed={docDimMed}
                      docDimProp={docDimProp}
                    />
                  )}

                  {activeTab === 'instalacoes' && (
                    <InstalacoesFisicasTab
                      styles={styles}
                      disableZoomOptions={disableZoomOptions}
                      twoDecTooltip={twoDecTooltip}
                      formatProporcoesItensChartData={formatProporcoesItensChartData}
                      formatMediasItensChartData={formatMediasItensChartData}
                      itensInstalacoesProp={itensInstalacoesProp}
                      itensInstalacoesPropDoc={itensInstalacoesPropDoc}
                      itensInstalacoesMed={itensInstalacoesMed}
                      itensInstalacoesMedDoc={itensInstalacoesMedDoc}
                      itensInstalacoesBoxDisc={itensInstalacoesBoxDisc}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}