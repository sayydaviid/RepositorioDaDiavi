'use client';

import { useState, useEffect, useMemo } from 'react';
import DiscenteFilters from '../components/DiscenteFilterAvalia';
import StatCard from '../components/StatCard';
import ActivityChart from '../components/ActivityChart';
import BoxplotChart from '../components/BoxplotChart';
import styles from '../../../../styles/dados.module.css';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE =
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE) || '';

const make = (path) => (API_BASE ? `${API_BASE}${path}` : `/backend${path}`);

const LoadingOverlay = ({ isFullScreen = false }) => (
  <>
    <style jsx global>{`
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
    <div
      style={{
        position: isFullScreen ? 'fixed' : 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        zIndex: 9990,
        backdropFilter: 'blur(5px)',
        borderRadius: isFullScreen ? 0 : '8px',
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          border: '6px solid #e0e0e0',
          borderTop: '6px solid #288FB4',
          borderRadius: '50%',
          animation: 'spin 1.2s linear infinite',
        }}
      />
    </div>
  </>
);

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
  autoavaliacao_docente: { propSub: null, medSub: null, boxSub: null },
  atitude: {
    discProp: null,
    discMed: null,
    discBox: null,
    docProp: null,
    docMed: null,
    docBox: null,
  },
  gestao: { discMed: null, discProp: null, docMed: null, docProp: null, discBox: null },
  processo: { discMed: null, discProp: null, discBox: null, docMed: null, docProp: null },
  instalacoes: { medItens: null, propItens: null, boxDisc: null, medDoc: null, propDoc: null },
  atividades: { doc: null },
  base_docente: { turmaMed: null, turmaProp: null, subMed: null, subProp: null, dimMed: null, dimProp: null },
});

async function fetchJson(url, signal, errMsg) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(errMsg || 'Falha ao buscar dados da API R');
  return r.json();
}
export default function DiscenteDashboardClient({ initialData, filtersOptions }) {
  const [activeTab, setActiveTab] = useState('dimensoes');
  const [selectedFilters, setSelectedFilters] = useState({
    campus: 'todos',
    curso: 'todos',
  });

  const [summaryData, setSummaryData] = useState(initialData.summary);
  const [dashboardData, setDashboardData] = useState(() => ({
    proporcoes: initialData.proporcoes,
    boxplot: initialData.boxplot,
    atividades: initialData.atividades,
    medias: initialData.medias,
  }));

  const [detailData, setDetailData] = useState(() => emptyDetailData());

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tabLoading, setTabLoading] = useState({});
  const [loadedTabs, setLoadedTabs] = useState({ dimensoes: true });

  const params = useMemo(
    () => new URLSearchParams(selectedFilters).toString(),
    [selectedFilters]
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const urls = [
          make(`/discente/geral/summary?${params}`),
          make(`/discente/dimensoes/medias?${params}`),
          make(`/discente/dimensoes/proporcoes?${params}`),
          make(`/discente/dimensoes/boxplot?${params}`),
          make(`/discente/atividades/percentual?${params}`),
        ];

        const [summary, medias, proporcoes, boxplot, atividades] =
          await Promise.all([
            fetchJson(urls[0], controller.signal, 'Falha ao buscar summary'),
            fetchJson(urls[1], controller.signal, 'Falha ao buscar medias'),
            fetchJson(urls[2], controller.signal, 'Falha ao buscar proporcoes'),
            fetchJson(urls[3], controller.signal, 'Falha ao buscar boxplot'),
            fetchJson(urls[4], controller.signal, 'Falha ao buscar atividades'),
          ]);

        if (cancelled) return;

        setSummaryData(summary);
        setDashboardData({ medias, proporcoes, boxplot, atividades });
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
  }, [params]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const runTab = async (tabKey) => {
      if (!tabKey || tabKey === 'dimensoes') return;
      if (loadedTabs[tabKey]) return;

      setTabLoading((p) => ({ ...p, [tabKey]: true }));
      setError(null);

      try {
        if (tabKey === 'autoavaliacao') {
          const [propItens, medItens, boxItens] = await Promise.all([
            fetchJson(
              make(`/discente/autoavaliacao/itens/proporcoes?${params}`),
              controller.signal,
              'Falha ao buscar autoavaliação (proporções)'
            ),
            fetchJson(
              make(`/discente/autoavaliacao/itens/medias?${params}`),
              controller.signal,
              'Falha ao buscar autoavaliação (médias)'
            ),
            fetchJson(
              make(`/discente/autoavaliacao/itens/boxplot?${params}`),
              controller.signal,
              'Falha ao buscar autoavaliação (boxplot)'
            ),
          ]);
          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            autoavaliacao: { propItens, medItens, boxItens },
          }));
        } else if (tabKey === 'autoavaliacao_docente') {
          const [propSub, medSub, boxSub] = await Promise.all([
            fetchJson(
              make(`/docente/autoavaliacao/subdimensoes/proporcoes?${params}`),
              controller.signal,
              'Falha ao buscar autoavaliação docente (proporções)'
            ),
            fetchJson(
              make(`/docente/autoavaliacao/subdimensoes/medias?${params}`),
              controller.signal,
              'Falha ao buscar autoavaliação docente (médias)'
            ),
            fetchJson(
              make(`/docente/autoavaliacao/subdimensoes/boxplot?${params}`),
              controller.signal,
              'Falha ao buscar autoavaliação docente (boxplot)'
            ),
          ]);
          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            autoavaliacao_docente: { propSub, medSub, boxSub },
          }));
        } else if (tabKey === 'atitude') {
          const [
            discProp,
            discMed,
            docProp,
            docMed,
            docBox,
            discBox,
          ] = await Promise.all([
            fetchJson(
              make(`/discente/atitudeprofissional/itens/proporcoes?${params}`),
              controller.signal,
              'Falha ao buscar atitude (discente proporções)'
            ),
            fetchJson(
              make(`/discente/atitudeprofissional/itens/medias?${params}`),
              controller.signal,
              'Falha ao buscar atitude (discente médias)'
            ),
            fetchJson(
              make(`/docente/atitudeprofissional/itens/proporcoes?${params}`),
              controller.signal,
              'Falha ao buscar atitude (docente proporções)'
            ),
            fetchJson(
              make(`/docente/atitudeprofissional/itens/medias?${params}`),
              controller.signal,
              'Falha ao buscar atitude (docente médias)'
            ),
            fetchJson(
              make(`/docente/atitudeprofissional/itens/boxplot?${params}`),
              controller.signal,
              'Falha ao buscar atitude (docente boxplot)'
            ),
            fetchJson(
              make(`/discente/atitudeprofissional/itens/boxplot?${params}`),
              controller.signal,
              'Falha ao buscar atitude (discente boxplot)'
            ),
          ]);
          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            atitude: { discProp, discMed, discBox, docProp, docMed, docBox },
          }));
        } else if (tabKey === 'gestao') {
          const [discMed, discProp, docMed, docProp, discBox] =
            await Promise.all([
              fetchJson(
                make(`/discente/gestaodidatica/itens/medias?${params}`),
                controller.signal,
                'Falha ao buscar gestão (discente médias)'
              ),
              fetchJson(
                make(`/discente/gestaodidatica/itens/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar gestão (discente proporções)'
              ),
              fetchJson(
                make(`/docente/gestaodidatica/itens/medias?${params}`),
                controller.signal,
                'Falha ao buscar gestão (docente médias)'
              ),
              fetchJson(
                make(`/docente/gestaodidatica/itens/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar gestão (docente proporções)'
              ),
              fetchJson(
                make(`/discente/gestaodidatica/itens/boxplot?${params}`),
                controller.signal,
                'Falha ao buscar gestão (discente boxplot)'
              ),
            ]);
          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            gestao: { discMed, discProp, docMed, docProp, discBox },
          }));
        } else if (tabKey === 'processo') {
          const [discMed, discProp, discBox, docMed, docProp] =
            await Promise.all([
              fetchJson(
                make(`/discente/processoavaliativo/itens/medias?${params}`),
                controller.signal,
                'Falha ao buscar processo (discente médias)'
              ),
              fetchJson(
                make(`/discente/processoavaliativo/itens/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar processo (discente proporções)'
              ),
              fetchJson(
                make(`/discente/processoavaliativo/itens/boxplot?${params}`),
                controller.signal,
                'Falha ao buscar processo (discente boxplot)'
              ),
              fetchJson(
                make(`/docente/processoavaliativo/itens/medias?${params}`),
                controller.signal,
                'Falha ao buscar processo (docente médias)'
              ),
              fetchJson(
                make(`/docente/processoavaliativo/itens/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar processo (docente proporções)'
              ),
            ]);
          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            processo: { discMed, discProp, discBox, docMed, docProp },
          }));
        } else if (tabKey === 'instalacoes') {
          const [medItens, propItens, boxDisc, medDoc, propDoc] =
            await Promise.all([
              fetchJson(
                make(`/discente/instalacoes/itens/medias?${params}`),
                controller.signal,
                'Falha ao buscar instalações (discente médias)'
              ),
              fetchJson(
                make(`/discente/instalacoes/itens/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar instalações (discente proporções)'
              ),
              fetchJson(
                make(`/discente/instalacoes/itens/boxplot?${params}`),
                controller.signal,
                'Falha ao buscar instalações (discente boxplot)'
              ),
              fetchJson(
                make(`/docente/instalacoes/itens/medias?${params}`),
                controller.signal,
                'Falha ao buscar instalações (docente médias)'
              ),
              fetchJson(
                make(`/docente/instalacoes/itens/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar instalações (docente proporções)'
              ),
            ]);
          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            instalacoes: { medItens, propItens, boxDisc, medDoc, propDoc },
          }));
        } else if (tabKey === 'atividades') {
          const doc = await fetchJson(
            make(`/docente/atividades/percentual?${params}`),
            controller.signal,
            'Falha ao buscar atividades do docente'
          );
          if (cancelled) return;
          setDetailData((prev) => ({ ...prev, atividades: { doc } }));
        } else if (tabKey === 'base_docente') {
          const [turmaMed, turmaProp, subMed, subProp, dimMed, dimProp] =
            await Promise.all([
              fetchJson(
                make(`/docente/avaliacaoturma/itens/medias?${params}`),
                controller.signal,
                'Falha ao buscar base docente (turma médias)'
              ),
              fetchJson(
                make(`/docente/avaliacaoturma/itens/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar base docente (turma proporções)'
              ),
              fetchJson(
                make(`/docente_base/autoavaliacao/subdimensoes/medias?${params}`),
                controller.signal,
                'Falha ao buscar base docente (subdim médias)'
              ),
              fetchJson(
                make(`/docente_base/autoavaliacao/subdimensoes/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar base docente (subdim proporções)'
              ),
              fetchJson(
                make(`/docente/dimensoes/medias?${params}`),
                controller.signal,
                'Falha ao buscar base docente (dim médias)'
              ),
              fetchJson(
                make(`/docente/dimensoes/proporcoes?${params}`),
                controller.signal,
                'Falha ao buscar base docente (dim proporções)'
              ),
            ]);
          if (cancelled) return;
          setDetailData((prev) => ({
            ...prev,
            base_docente: { turmaMed, turmaProp, subMed, subProp, dimMed, dimProp },
          }));
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
  }, [activeTab, params, loadedTabs]);

  const datasets = useMemo(
    () => ({
      proporcoes: formatProporcoesChartData(dashboardData.proporcoes),
      medias: formatMediasChartData(dashboardData.medias),
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
      { key: 'autoavaliacao_docente', label: 'Autoavaliação Docente' },
      { key: 'atividades', label: 'Atividades Acadêmicas' },
      { key: 'base_docente', label: 'Base Docente' },
      { key: 'atitude', label: 'Atitude Profissional' },
      { key: 'gestao', label: 'Gestão Didática' },
      { key: 'processo', label: 'Processo Avaliativo' },
      { key: 'instalacoes', label: 'Instalações Físicas' },
    ],
    []
  );

  const isBlockingLoading = isLoading || !!tabLoading[activeTab];

  const dd = detailData;
  const itensAutoProp = dd.autoavaliacao?.propItens;
  const itensAutoMed = dd.autoavaliacao?.medItens;
  const itensAutoBox = dd.autoavaliacao?.boxItens;

  const docenteProp = dd.autoavaliacao_docente?.propSub;
  const docenteMed = dd.autoavaliacao_docente?.medSub;
  const docenteBox = dd.autoavaliacao_docente?.boxSub;

  const itensAtitudePropDisc = dd.atitude?.discProp;
  const itensAtitudeMedDisc = dd.atitude?.discMed;
  const itensAtitudeBoxDisc = dd.atitude?.discBox;
  const itensAtitudePropDoc = dd.atitude?.docProp;
  const itensAtitudeMedDoc = dd.atitude?.docMed;
  const itensAtitudeBoxDoc = dd.atitude?.docBox;

  const itensGestaoMedDisc = dd.gestao?.discMed;
  const itensGestaoPropDisc = dd.gestao?.discProp;
  const itensGestaoMedDoc = dd.gestao?.docMed;
  const itensGestaoPropDoc = dd.gestao?.docProp;
  const itensGestaoBoxDisc = dd.gestao?.discBox;

  const procDiscMed = dd.processo?.discMed;
  const procDiscProp = dd.processo?.discProp;
  const procDiscBox = dd.processo?.discBox;
  const procDocMed = dd.processo?.docMed;
  const procDocProp = dd.processo?.docProp;

  const itensInstalacoesMed = dd.instalacoes?.medItens;
  const itensInstalacoesProp = dd.instalacoes?.propItens;
  const itensInstalacoesBoxDisc = dd.instalacoes?.boxDisc;
  const itensInstalacoesMedDoc = dd.instalacoes?.medDoc;
  const itensInstalacoesPropDoc = dd.instalacoes?.propDoc;

  const atividadesDoc = dd.atividades?.doc;

  const docTurmaMed = dd.base_docente?.turmaMed;
  const docTurmaProp = dd.base_docente?.turmaProp;
  const docSubMed = dd.base_docente?.subMed;
  const docSubProp = dd.base_docente?.subProp;
  const docDimMed = dd.base_docente?.dimMed;
  const docDimProp = dd.base_docente?.dimProp;

  const xTicksNoRot = { maxRotation: 0, minRotation: 0, autoSkip: false };
  return (
    <>
      {isBlockingLoading && <LoadingOverlay isFullScreen />}

      <div
        style={{
          opacity: isBlockingLoading ? 0.35 : 1,
          pointerEvents: isBlockingLoading ? 'none' : 'auto',
        }}
      >
        {error && <p className={styles.errorMessage}>{error}</p>}
        {!error && (
          <>
            <div className={styles.statsGrid}>
              <StatCard
                title="Total de Respondentes"
                value={v0(summaryData?.total_respondentes) ?? '...'}
                icon={<Users />}
              />
              <StatCard
                title="Campus Melhor Avaliado"
                value={v0(summaryData?.campus_melhor_avaliado?.campus) ?? '...'}
                subtitle={`Média: ${v0(summaryData?.campus_melhor_avaliado?.media) ?? 'N/A'}`}
                icon={<TrendingUp />}
              />
              <StatCard
                title="Campus Pior Avaliado"
                value={v0(summaryData?.campus_pior_avaliado?.campus) ?? '...'}
                subtitle={`Média: ${v0(summaryData?.campus_pior_avaliado?.media) ?? 'N/A'}`}
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

              <div className={styles.chartDisplayArea}>
                {activeTab === 'dimensoes' && (
                  <div className={styles.dashboardLayout}>
                    <div className={styles.chartContainer}>
                      <ActivityChart
                        chartData={datasets.proporcoes}
                        title="Proporções de respostas por Dimensão"
                      />
                    </div>
                    <div className={styles.sideCharts}>
                      <div className={styles.chartContainer}>
                        <ActivityChart
                          chartData={datasets.medias}
                          title="Médias por Dimensão"
                          customOptions={{
                            plugins: { legend: { display: false } },
                          }}
                        />
                      </div>
                      <div className={styles.chartContainer}>
                        {dashboardData.boxplot ? (
                          <BoxplotChart
                            apiData={dashboardData.boxplot}
                            title="Distribuição das Médias das Avaliações"
                          />
                        ) : (
                          <p>Carregando...</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'autoavaliacao' && (
                  <div style={{ position: 'relative' }}>
                    <div>
                      <div
                        className={styles.chartContainer}
                        style={{ marginBottom: '1rem', height: 500 }}
                      >
                        {itensAutoProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(itensAutoProp)}
                            title="Proporções de respostas — Itens de Autoavaliação (Discente)"
                          />
                        ) : (
                          <p>Dados de proporções não disponíveis.</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className={styles.chartContainer} style={{ flex: 1, height: 400 }}>
                          {itensAutoMed ? (
                            <ActivityChart
                              chartData={formatMediasItensChartData(itensAutoMed)}
                              title="Médias — Itens de Autoavaliação (Discente)"
                              customOptions={{
                                plugins: { legend: { display: false } },
                              }}
                            />
                          ) : (
                            <p>Dados de médias não disponíveis.</p>
                          )}
                        </div>
                        <div className={styles.chartContainer} style={{ flex: 1, height: 400 }}>
                          {itensAutoBox ? (
                            <BoxplotChart apiData={itensAutoBox} title="Boxplot Discente" />
                          ) : (
                            <p>Dados de boxplot não disponíveis.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'autoavaliacao_docente' && (
                  <div style={{ position: 'relative' }}>
                    <div>
                      <div
                        className={styles.chartContainer}
                        style={{ marginBottom: '1rem', height: 500 }}
                      >
                        {docenteProp ? (
                          <ActivityChart
                            chartData={formatProporcoesSubdimChartData(docenteProp)}
                            title="Proporções por Subdimensão — Autoavaliação Docente"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip() },
                            }}
                          />
                        ) : (
                          <p>Dados de proporções não disponíveis.</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className={styles.chartContainer} style={{ flex: 1, height: 400 }}>
                          {docenteMed ? (
                            <ActivityChart
                              chartData={formatMediasSubdimChartData(docenteMed)}
                              title="Médias por Subdimensão — Autoavaliação Docente"
                              customOptions={{
                                plugins: {
                                  legend: { display: false },
                                  tooltip: twoDecTooltip(),
                                },
                                scales: { y: { max: 4 } },
                              }}
                            />
                          ) : (
                            <p>Dados de médias não disponíveis.</p>
                          )}
                        </div>
                        <div className={styles.chartContainer} style={{ flex: 1, height: 400 }}>
                          {docenteBox ? (
                            <BoxplotChart
                              apiData={docenteBox}
                              title="Boxplot das Médias — Autoavaliação Docente"
                            />
                          ) : (
                            <p>Dados de boxplot não disponíveis.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'atividades' && (
                  <div style={{ position: 'relative' }}>
                    <div className={styles.dashboardLayout} style={{ gridTemplateColumns: '1fr' }}>
                      <div className={styles.chartContainerFlex}>
                        <ActivityChart
                          chartData={datasets.atividades}
                          title="Percentual de Participação em Atividades (Discente)"
                          customOptions={{
                            plugins: { tooltip: twoDecTooltip('%') },
                            scales: { x: { ticks: xTicksNoRot } },
                          }}
                        />
                      </div>

                      <div className={styles.chartContainerFlex}>
                        {atividadesDoc ? (
                          <ActivityChart
                            chartData={formatAtividadesChartData(atividadesDoc)}
                            title="Percentual de Participação em Atividades (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: { x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Dados de atividades do docente não disponíveis.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'base_docente' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {docTurmaProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(docTurmaProp)}
                            title="Proporções — Itens de Avaliação da Turma (Docente)"
                            customOptions={{
                              layout: { padding: { top: 8, right: -12, bottom: 0, left: -30 } },
                              scales: { y: { max: 100 }, x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Proporções (itens) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {docTurmaMed ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(docTurmaMed)}
                            title="Médias dos itens — Avaliação da Turma (Docente)"
                            customOptions={{
                              plugins: { legend: { display: false }, tooltip: twoDecTooltip() },
                              layout: { padding: { top: 8, right: 6, bottom: 0, left: 6 } },
                              scales: { x: { ticks: xTicksNoRot }, y: { max: 4 } },
                            }}
                          />
                        ) : (
                          <p>Médias (itens) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {docSubMed ? (
                          <ActivityChart
                            chartData={formatMediasSubdimChartData(docSubMed)}
                            title="Médias por Subdimensão — Autoavaliação da Ação Docente (Base Docente)"
                            customOptions={{
                              plugins: { legend: { display: false }, tooltip: twoDecTooltip() },
                              layout: { padding: { top: 10, right: 6, bottom: 0, left: 6 } },
                              scales: { y: { max: 5 }, x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Médias por subdimensão não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {docSubProp ? (
                          <ActivityChart
                            chartData={formatProporcoesSubdimChartData(docSubProp)}
                            title="Proporções por Subdimensão — Autoavaliação da Ação Docente (Base Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              layout: { padding: { top: 50, right: 6, bottom: 0, left: 1 } },
                              scales: { x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Proporções por subdimensão não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {docDimMed ? (
                          <ActivityChart
                            chartData={formatMediasDimDocente(docDimMed)}
                            title="Médias por Dimensão (Docente)"
                            customOptions={{
                              plugins: { legend: { display: false }, tooltip: twoDecTooltip() },
                              layout: { padding: { top: 8, right: 6, bottom: 0, left: 6 } },
                              scales: { y: { max: 5 }, x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Médias por dimensão não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {docDimProp ? (
                          <ActivityChart
                            chartData={formatProporcoesDimDocente(docDimProp)}
                            title="Proporções por Dimensão (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              layout: { padding: { top: 8, right: 6, bottom: 0, left: 6 } },
                              scales: { x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Proporções por dimensão não disponíveis.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'atitude' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div className={styles.chartContainer}>
                        {itensAtitudeMedDisc ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(itensAtitudeMedDisc)}
                            title="Médias — Itens de Atitude Profissional (Discente)"
                            customOptions={{
                              plugins: { legend: { display: false }, tooltip: twoDecTooltip() },
                              scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Médias (Discente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {itensAtitudeMedDoc ? (
                          <ActivityChart
                            chartData={normalizeAtitudeDocenteChartData(
                              formatMediasItensChartData(itensAtitudeMedDoc)
                            )}
                            title="Médias — Itens de Atitude Profissional (Docente)"
                            customOptions={{
                              plugins: { legend: { display: false }, tooltip: twoDecTooltip() },
                              scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Médias (Docente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {itensAtitudePropDisc ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(itensAtitudePropDisc)}
                            title="Proporções — Itens de Atitude Profissional (Discente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
                            }}
                          />
                        ) : (
                          <p>Proporções (Discente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {itensAtitudePropDoc ? (
                          <ActivityChart
                            chartData={normalizeAtitudeDocenteChartData(
                              formatProporcoesItensChartData(itensAtitudePropDoc)
                            )}
                            title="Proporções — Itens de Atitude Profissional (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
                            }}
                          />
                        ) : (
                          <p>Proporções (Docente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {itensAtitudeBoxDisc ? (
                          <BoxplotChart
                            apiData={itensAtitudeBoxDisc}
                            title="Boxplot — Distribuição das Médias por Item (Atitude Profissional • Discente)"
                          />
                        ) : (
                          <p>Boxplot (Discente) não disponível.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'gestao' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div className={styles.chartContainer}>
                        {itensGestaoMedDisc ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(itensGestaoMedDisc)}
                            title="Médias — Itens de Gestão Didática (Discente)"
                            customOptions={{
                              plugins: { legend: { display: false } },
                              scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Médias (Discente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {itensGestaoMedDoc && itensGestaoMedDoc.length > 0 ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(itensGestaoMedDoc)}
                            title="Médias — Itens de Gestão Didática (Docente)"
                            customOptions={{
                              plugins: { legend: { display: false }, tooltip: twoDecTooltip() },
                              scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
                            }}
                          />
                        ) : (
                          <p>Médias — Itens de Gestão Didática (Docente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {itensGestaoPropDisc ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(itensGestaoPropDisc)}
                            title="Proporções — Itens de Gestão Didática (Discente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
                            }}
                          />
                        ) : (
                          <p>Proporções (Discente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {itensGestaoPropDoc && itensGestaoPropDoc.length > 0 ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(itensGestaoPropDoc)}
                            title="Proporções — Itens de Gestão Didática (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
                            }}
                          />
                        ) : (
                          <p>Proporções — Itens de Gestão Didática (Docente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {itensGestaoBoxDisc ? (
                          <BoxplotChart
                            apiData={itensGestaoBoxDisc}
                            title="Boxplot — Distribuição das Médias por Item (Gestão Didática • Discente)"
                          />
                        ) : (
                          <p>Boxplot — Gestão Didática (Discente) não disponível.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'processo' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div className={styles.chartContainer}>
                        {procDiscMed ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(procDiscMed)}
                            title="Médias — Itens de Processo Avaliativo (Discente)"
                            customOptions={{
                              plugins: { legend: { display: false } },
                              scales: { y: { max: 4 } },
                            }}
                          />
                        ) : (
                          <p>Dados de médias (Discente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {procDocMed ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(procDocMed)}
                            title="Médias — Itens de Processo Avaliativo (Docente)"
                            customOptions={{
                              plugins: { legend: { display: false } },
                              scales: { y: { max: 4 } },
                            }}
                          />
                        ) : (
                          <p>Dados de médias (Docente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {procDiscProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(procDiscProp)}
                            title="Proporções — Itens de Processo Avaliativo (Discente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
                            }}
                          />
                        ) : (
                          <p>Proporções (Discente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {procDocProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(procDocProp)}
                            title="Proporções — Itens de Processo Avaliativo (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
                            }}
                          />
                        ) : (
                          <p>Proporções (Docente) não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer} style={{ gridColumn: '1 / -1' }}>
                        {procDiscBox ? (
                          <BoxplotChart
                            apiData={procDiscBox}
                            title="Boxplot — Distribuição das Médias por Item (Processo Avaliativo • Discente)"
                          />
                        ) : (
                          <p>Boxplot (Discente) não disponível.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'instalacoes' && (
                  <div style={{ position: 'relative' }}>
                    <div className={styles.dashboardLayout} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                      <div className={styles.chartContainer}>
                        {itensInstalacoesProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(itensInstalacoesProp)}
                            title="Proporções — Itens de Instalações Físicas (Discente)"
                            customOptions={{ plugins: { tooltip: twoDecTooltip('%') } }}
                          />
                        ) : (
                          <p>Dados não disponíveis.</p>
                        )}
                      </div>

                      <div className={styles.chartContainer}>
                        {itensInstalacoesPropDoc ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(itensInstalacoesPropDoc)}
                            title="Proporções — Itens de Instalações Físicas (Docente)"
                            customOptions={{ plugins: { tooltip: twoDecTooltip('%') } }}
                          />
                        ) : (
                          <p>Proporções (Docente) não disponíveis.</p>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                        <div className={styles.chartContainer}>
                          {itensInstalacoesMed ? (
                            <ActivityChart
                              chartData={formatMediasItensChartData(itensInstalacoesMed)}
                              title="Médias — Itens de Instalações Físicas (Discente)"
                              customOptions={{ plugins: { legend: { display: false } }, scales: { y: { max: 4 } } }}
                            />
                          ) : (
                            <p>Dados não disponíveis.</p>
                          )}
                        </div>
                        <div className={styles.chartContainer}>
                          {itensInstalacoesMedDoc ? (
                            <ActivityChart
                              chartData={formatMediasItensChartData(itensInstalacoesMedDoc)}
                              title="Médias — Itens de Instalações Físicas (Docente)"
                              customOptions={{ plugins: { legend: { display: false } }, scales: { y: { max: 4 } } }}
                            />
                          ) : (
                            <p>Médias (Docente) não disponíveis.</p>
                          )}
                        </div>
                      </div>

                      <div className={styles.chartContainer}>
                        {itensInstalacoesBoxDisc ? (
                          <BoxplotChart
                            apiData={itensInstalacoesBoxDisc}
                            title="Boxplot — Distribuição das Médias por Item (Instalações Físicas • Discente)"
                          />
                        ) : (
                          <p>Boxplot (Discente) não disponível.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
