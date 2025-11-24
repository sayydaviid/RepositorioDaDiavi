'use client';

import { useState, useEffect, useMemo } from 'react';
import DiscenteFilters from '../components/DiscenteFilterAvalia';
import StatCard from '../components/StatCard';
import ActivityChart from '../components/ActivityChart';
import BoxplotChart from '../components/BoxplotChart';
import styles from '../../../../styles/dados.module.css';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';

/* =======================================================
   >>>>>>>>>>>> CONFIG DE BASE DA API <<<<<<<<<<<<
   - Produção (Vercel): defina NEXT_PUBLIC_API_BASE, ex.:
     NEXT_PUBLIC_API_BASE=https://sayydaviid-avalia-backend.hf.space
   - Dev/Proxy: crie um rewrite em /backend → http://localhost:8000
   ======================================================= */
const API_BASE =
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE) || '';

const make = (path) => (API_BASE ? `${API_BASE}${path}` : `/backend${path}`);

// =======================================================
// >>>>>>>>>>>> COMPONENTE DE CARREGAMENTO <<<<<<<<<<<<
// =======================================================
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

// ---------- Tooltip 2 casas ----------
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

// NOVO: Função auxiliar para quebrar labels longos em múltiplas linhas
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

/**
 * Formata códigos de item:
 * - "111"        -> "1.11"
 * - "2.11"       -> "2.1.1"
 * - "2.11 - XYZ" -> "2.1.1 - XYZ"
 */
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

// ---------- Formatadores base ----------
function formatProporcoesChartData(apiData) {
  if (!apiData || apiData.length === 0)
    return { labels: [], datasets: [] };
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
  if (!apiData || apiData.length === 0)
    return { labels: [], datasets: [] };
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
  if (!apiData || apiData.length === 0)
    return { labels: [], datasets: [] };
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

// >>> Ajustados: usam labels formatados mas buscam pelos itens brutos
function formatProporcoesItensChartData(apiData) {
  if (!apiData || apiData.length === 0)
    return { labels: [], datasets: [] };
  const rawItems = [...new Set(apiData.map((item) => item.item))].sort();
  const labels = rawItems.map((it) =>
    wrapLabel(formatItemCodeLabel(it), 25)
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
    data: rawItems.map(
      (raw) =>
        apiData.find((d) => d.item === raw && d.conceito === conceito)
          ?.valor || 0
    ),
    backgroundColor: colorMap[conceito],
  }));
  return { labels, datasets };
}

function formatMediasItensChartData(apiData) {
  if (!apiData || apiData.length === 0)
    return { labels: [], datasets: [] };
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

// ===== SUBDIMENSÕES (DOCENTE) =====
function formatProporcoesSubdimChartData(apiData) {
  if (!apiData || apiData.length === 0)
    return { labels: [], datasets: [] };
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
  if (!apiData || apiData.length === 0)
    return { labels: [], datasets: [] };
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

// ===== DIMENSÕES (DOCENTE) =====
const formatMediasDimDocente = formatMediasChartData;
const formatProporcoesDimDocente = formatProporcoesChartData;

/**
 * Corrige labels do padrão 2.11 / 2.12 / 2.13 -> 2.1.1 / 2.1.2 / 2.1.3
 * direto no chartData pronto.
 */
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

export default function DiscenteDashboardClient({ initialData, filtersOptions }) {
  const [activeTab, setActiveTab] = useState('dimensoes');
  const [selectedFilters, setSelectedFilters] = useState({
    campus: 'todos',
    curso: 'todos',
  });

  const [summaryData, setSummaryData] = useState(initialData.summary);
  const [dashboardData, setDashboardData] = useState({
    proporcoes: initialData.proporcoes,
    boxplot: initialData.boxplot,
    atividades: initialData.atividades,
    medias: initialData.medias,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // controle de carregamento por aba
  const [tabLoading, setTabLoading] = useState({});

  // cache de abas já carregadas
  const [loadedTabs, setLoadedTabs] = useState({
    dimensoes: true,
  });

  // autoavaliação discente
  const [itensAutoProp, setItensAutoProp] = useState(null);
  const [itensAutoMed, setItensAutoMed] = useState(null);
  const [itensAutoBox, setItensAutoBox] = useState(null);

  // Atitude Profissional (discente x docente)
  const [itensAtitudePropDisc, setItensAtitudePropDisc] = useState(null);
  const [itensAtitudeMedDisc, setItensAtitudeMedDisc] = useState(null);
  const [itensAtitudePropDoc, setItensAtitudePropDoc] = useState(null);
  const [itensAtitudeMedDoc, setItensAtitudeMedDoc] = useState(null);
  const [itensAtitudeBoxDoc, setItensAtitudeBoxDoc] = useState(null);
  const [itensAtitudeBoxDisc, setItensAtitudeBoxDisc] = useState(null);

  // compat antigo
  const [itensAtitudeMed, setItensAtitudeMed] = useState(null);

  // Gestão didática
  const [itensGestaoMedDisc, setItensGestaoMedDisc] = useState(null);
  const [itensGestaoPropDisc, setItensGestaoPropDisc] = useState(null);
  const [itensGestaoMedDoc, setItensGestaoMedDoc] = useState(null);
  const [itensGestaoPropDoc, setItensGestaoPropDoc] = useState(null);
  const [itensGestaoBoxDisc, setItensGestaoBoxDisc] = useState(null);

  // Processo aval.
  const [procDiscMed, setProcDiscMed] = useState(null);
  const [procDiscProp, setProcDiscProp] = useState(null);
  const [procDiscBox, setProcDiscBox] = useState(null);
  const [procDocMed, setProcDocMed] = useState(null);
  const [procDocProp, setProcDocProp] = useState(null);

  // Instalações (discente + docente + boxplot)
  const [itensInstalacoesMed, setItensInstalacoesMed] = useState(null);
  const [itensInstalacoesProp, setItensInstalacoesProp] = useState(null);
  const [itensInstalacoesMedDoc, setItensInstalacoesMedDoc] = useState(null);
  const [itensInstalacoesPropDoc, setItensInstalacoesPropDoc] = useState(null);
  const [itensInstalacoesBoxDisc, setItensInstalacoesBoxDisc] = useState(null);

  // Docente (subdimensões) + atividades
  const [docenteProp, setDocenteProp] = useState(null);
  const [docenteMed, setDocenteMed] = useState(null);
  const [docenteBox, setDocenteBox] = useState(null);
  const [atividadesDoc, setAtividadesDoc] = useState(null);

  // Base Docente
  const [docTurmaMed, setDocTurmaMed] = useState(null);
  const [docTurmaProp, setDocTurmaProp] = useState(null);
  const [docDimMed, setDocDimMed] = useState(null);
  const [docDimProp, setDocDimProp] = useState(null);
  const [docSubMed, setDocSubMed] = useState(null);
  const [docSubProp, setDocSubProp] = useState(null);

  // =========================================================
  // 1) Dados gerais (sempre que filtro muda)
  // =========================================================
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchGeneralData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(selectedFilters).toString();
        const urls = {
          summary: make(`/discente/geral/summary?${params}`),
          medias: make(`/discente/dimensoes/medias?${params}`),
          proporcoes: make(`/discente/dimensoes/proporcoes?${params}`),
          boxplot: make(`/discente/dimensoes/boxplot?${params}`),
          atividades: make(`/discente/atividades/percentual?${params}`),
        };
        const responses = await Promise.all(
          Object.values(urls).map((url) =>
            fetch(url, { signal: controller.signal })
          )
        );
        for (const res of responses) {
          if (!res.ok) {
            throw new Error('Falha ao buscar dados filtrados da API R');
          }
        }
        const [summary, medias, proporcoes, boxplot, atividades] =
          await Promise.all(responses.map((res) => res.json()));
        if (cancelled) return;
        setSummaryData(summary);
        setDashboardData({ medias, proporcoes, boxplot, atividades });
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return;
        setError(err.message ?? 'Erro ao carregar dados gerais');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchGeneralData();

    // sempre que filtros mudam, zera cache de abas detalhadas
    setLoadedTabs({ dimensoes: true });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedFilters]);

  // =========================================================
  // 2) Dados detalhados por aba (carrega uma vez e guarda)
  // =========================================================
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const params = new URLSearchParams(selectedFilters).toString();
    const endpointMap = {
      autoavaliacao: {
        propItens: make(`/discente/autoavaliacao/itens/proporcoes?${params}`),
        medItens: make(`/discente/autoavaliacao/itens/medias?${params}`),
        boxItens: make(`/discente/autoavaliacao/itens/boxplot?${params}`),
      },
      autoavaliacao_docente: {
        propSub: make(
          `/docente/autoavaliacao/subdimensoes/proporcoes?${params}`
        ),
        medSub: make(`/docente/autoavaliacao/subdimensoes/medias?${params}`),
        boxSub: make(`/docente/autoavaliacao/subdimensoes/boxplot?${params}`),
      },
      atitude: {
        discProp: make(
          `/discente/atitudeprofissional/itens/proporcoes?${params}`
        ),
        discMed: make(`/discente/atitudeprofissional/itens/medias?${params}`),
        discBox: make(`/discente/atitudeprofissional/itens/boxplot?${params}`),
        docProp: make(
          `/docente/atitudeprofissional/itens/proporcoes?${params}`
        ),
        docMed: make(`/docente/atitudeprofissional/itens/medias?${params}`),
        docBox: make(`/docente/atitudeprofissional/itens/boxplot?${params}`),
      },
      gestao: {
        discMed: make(`/discente/gestaodidatica/itens/medias?${params}`),
        discProp: make(`/discente/gestaodidatica/itens/proporcoes?${params}`),
        docMed: make(`/docente/gestaodidatica/itens/medias?${params}`),
        docProp: make(`/docente/gestaodidatica/itens/proporcoes?${params}`),
        discBox: make(`/discente/gestaodidatica/itens/boxplot?${params}`),
      },
      processo: {
        discMed: make(`/discente/processoavaliativo/itens/medias?${params}`),
        discProp: make(
          `/discente/processoavaliativo/itens/proporcoes?${params}`
        ),
        discBox: make(`/discente/processoavaliativo/itens/boxplot?${params}`),
        docMed: make(`/docente/processoavaliativo/itens/medias?${params}`),
        docProp: make(
          `/docente/processoavaliativo/itens/proporcoes?${params}`
        ),
      },
      instalacoes: {
        medItens: make(`/discente/instalacoes/itens/medias?${params}`),
        propItens: make(`/discente/instalacoes/itens/proporcoes?${params}`),
        boxDisc: make(`/discente/instalacoes/itens/boxplot?${params}`),
        medDoc: make(`/docente/instalacoes/itens/medias?${params}`),
        propDoc: make(`/docente/instalacoes/itens/proporcoes?${params}`),
      },
      atividades: {
        doc: make(`/docente/atividades/percentual?${params}`),
      },
      base_docente: {
        turmaMed: make(`/docente/avaliacaoturma/itens/medias?${params}`),
        turmaProp: make(`/docente/avaliacaoturma/itens/proporcoes?${params}`),
        subMed: make(
          `/docente_base/autoavaliacao/subdimensoes/medias?${params}`
        ),
        subProp: make(
          `/docente_base/autoavaliacao/subdimensoes/proporcoes?${params}`
        ),
        dimMed: make(`/docente/dimensoes/medias?${params}`),
        dimProp: make(`/docente/dimensoes/proporcoes?${params}`),
      },
    };

    const fetchDataForTab = async (tabKey) => {
      const urls = endpointMap[tabKey];
      if (!urls) return;
      if (loadedTabs[tabKey]) return;
      if (cancelled) return;

      setTabLoading((prev) => ({ ...prev, [tabKey]: true }));
      setError(null);

      try {
        if (tabKey === 'autoavaliacao') {
          const responses = await Promise.all(
            Object.values(urls).map((url) =>
              fetch(url, { signal: controller.signal })
            )
          );
          for (const r of responses)
            if (!r.ok) throw new Error('Falha ao buscar dados detalhados');
          const [propI, medI, boxI] = await Promise.all(
            responses.map((r) => r.json())
          );
          if (cancelled) return;
          setItensAutoProp(propI);
          setItensAutoMed(medI);
          setItensAutoBox(boxI);
        } else if (tabKey === 'autoavaliacao_docente') {
          const responses = await Promise.all(
            Object.values(urls).map((url) =>
              fetch(url, { signal: controller.signal })
            )
          );
          for (const r of responses)
            if (!r.ok)
              throw new Error('Falha ao buscar autoavaliação docente');
          const [propS, medS, boxS] = await Promise.all(
            responses.map((r) => r.json())
          );
          if (cancelled) return;
          setDocenteProp(propS);
          setDocenteMed(medS);
          setDocenteBox(boxS);
        } else if (tabKey === 'atitude') {
          const responses = await Promise.all([
            fetch(urls.discProp, { signal: controller.signal }),
            fetch(urls.discMed, { signal: controller.signal }),
            fetch(urls.docProp, { signal: controller.signal }),
            fetch(urls.docMed, { signal: controller.signal }),
            fetch(urls.docBox, { signal: controller.signal }),
            fetch(urls.discBox, { signal: controller.signal }),
          ]);
          for (const r of responses)
            if (!r.ok)
              throw new Error('Falha ao buscar Atitude Profissional');
          const [dProp, dMed, dcProp, dcMed, dcBox, dBox] =
            await Promise.all(responses.map((r) => r.json()));
          if (cancelled) return;
          setItensAtitudePropDisc(dProp);
          setItensAtitudeMedDisc(dMed);
          setItensAtitudeMed(dMed);
          setItensAtitudePropDoc(dcProp);
          setItensAtitudeMedDoc(dcMed);
          setItensAtitudeBoxDoc(dcBox);
          setItensAtitudeBoxDisc(dBox);
        } else if (tabKey === 'gestao') {
          const responses = await Promise.all([
            fetch(urls.discMed, { signal: controller.signal }),
            fetch(urls.discProp, { signal: controller.signal }),
            fetch(urls.docMed, { signal: controller.signal }),
            fetch(urls.docProp, { signal: controller.signal }),
            fetch(urls.discBox, { signal: controller.signal }),
          ]);
          for (const r of responses)
            if (!r.ok) throw new Error('Falha ao buscar Gestão Didática');
          const [discMed, discProp, docMed, docProp, discBox] =
            await Promise.all(responses.map((r) => r.json()));
          if (cancelled) return;
          setItensGestaoMedDisc(discMed);
          setItensGestaoPropDisc(discProp);
          setItensGestaoMedDoc(docMed);
          setItensGestaoPropDoc(docProp);
          setItensGestaoBoxDisc(discBox);
        } else if (tabKey === 'processo') {
          const responses = await Promise.all([
            fetch(urls.discMed, { signal: controller.signal }),
            fetch(urls.discProp, { signal: controller.signal }),
            fetch(urls.discBox, { signal: controller.signal }),
            fetch(urls.docMed, { signal: controller.signal }),
            fetch(urls.docProp, { signal: controller.signal }),
          ]);
          for (const r of responses)
            if (!r.ok)
              throw new Error('Falha ao buscar Processo Avaliativo');
          const [discMed, discProp, discBox, docMed, docProp] =
            await Promise.all(responses.map((r) => r.json()));
          if (cancelled) return;
          setProcDiscMed(discMed);
          setProcDiscProp(discProp);
          setProcDiscBox(discBox);
          setProcDocMed(docMed);
          setProcDocProp(docProp);
        } else if (tabKey === 'instalacoes') {
          const responses = await Promise.all([
            fetch(urls.medItens, { signal: controller.signal }),
            fetch(urls.propItens, { signal: controller.signal }),
            fetch(urls.boxDisc, { signal: controller.signal }),
            fetch(urls.medDoc, { signal: controller.signal }),
            fetch(urls.propDoc, { signal: controller.signal }),
          ]);
          for (const r of responses)
            if (!r.ok) throw new Error('Falha ao buscar instalações');
          const [medI, propI, boxD, medDocI, propDocI] =
            await Promise.all(responses.map((r) => r.json()));
          if (cancelled) return;
          setItensInstalacoesMed(medI);
          setItensInstalacoesProp(propI);
          setItensInstalacoesBoxDisc(boxD);
          setItensInstalacoesMedDoc(medDocI);
          setItensInstalacoesPropDoc(propDocI);
        } else if (tabKey === 'atividades') {
          const r = await fetch(urls.doc, { signal: controller.signal });
          if (!r.ok) throw new Error('Falha ao buscar atividades do docente');
          const doc = await r.json();
          if (cancelled) return;
          setAtividadesDoc(doc);
        } else if (tabKey === 'base_docente') {
          const responses = await Promise.all([
            fetch(urls.turmaMed, { signal: controller.signal }),
            fetch(urls.turmaProp, { signal: controller.signal }),
            fetch(urls.subMed, { signal: controller.signal }),
            fetch(urls.subProp, { signal: controller.signal }),
            fetch(urls.dimMed, { signal: controller.signal }),
            fetch(urls.dimProp, { signal: controller.signal }),
          ]);
          for (const r of responses)
            if (!r.ok) throw new Error('Falha ao buscar Base Docente');
          const [tm, tp, sm, sp, dm, dp] = await Promise.all(
            responses.map((r) => r.json())
          );
          if (cancelled) return;
          setDocTurmaMed(tm);
          setDocTurmaProp(tp);
          setDocSubMed(sm);
          setDocSubProp(sp);
          setDocDimMed(dm);
          setDocDimProp(dp);
        }

        if (!cancelled) {
          setLoadedTabs((prev) => ({ ...prev, [tabKey]: true }));
        }
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return;
        setError(err.message ?? 'Erro ao carregar dados da aba');
      } finally {
        if (!cancelled) {
          setTabLoading((prev) => ({ ...prev, [tabKey]: false }));
        }
      }
    };

    if (endpointMap[activeTab]) {
      fetchDataForTab(activeTab);
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, selectedFilters, loadedTabs]);

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

  const tabs = [
    { key: 'dimensoes', label: 'Dimensões Gerais' },
    { key: 'autoavaliacao', label: 'Autoavaliação Discente' },
    { key: 'autoavaliacao_docente', label: 'Autoavaliação Docente' },
    { key: 'atividades', label: 'Atividades Acadêmicas' },
    { key: 'base_docente', label: 'Base Docente' },
    { key: 'atitude', label: 'Atitude Profissional' },
    { key: 'gestao', label: 'Gestão Didática' },
    { key: 'processo', label: 'Processo Avaliativo' },
    { key: 'instalacoes', label: 'Instalações Físicas' },
  ];

  // bloqueia a UI enquanto:
  // - dados gerais estão carregando OU
  // - a aba ativa ainda está carregando dados detalhados
  const isBlockingLoading = isLoading || !!tabLoading[activeTab];

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
                value={summaryData?.total_respondentes?.[0] ?? '...'}
                icon={<Users />}
              />
              <StatCard
                title="Campus Melhor Avaliado"
                value={
                  summaryData?.campus_melhor_avaliado?.campus?.[0] ?? '...'
                }
                subtitle={`Média: ${
                  summaryData?.campus_melhor_avaliado?.media?.[0] ?? 'N/A'
                }`}
                icon={<TrendingUp />}
              />
              <StatCard
                title="Campus Pior Avaliado"
                value={
                  summaryData?.campus_pior_avaliado?.campus?.[0] ?? '...'
                }
                subtitle={`Média: ${
                  summaryData?.campus_pior_avaliado?.media?.[0] ?? 'N/A'
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

            <div>
              <div className={styles.tabsContainer}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={
                      activeTab === tab.key ? styles.activeTab : styles.tab
                    }
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className={styles.chartDisplayArea}>
                {/* DIMENSÕES GERAIS */}
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

                {/* AUTOAVALIAÇÃO DISCENTE */}
                {activeTab === 'autoavaliacao' && (
                  <div style={{ position: 'relative' }}>
                    <div>
                      <div
                        className={styles.chartContainer}
                        style={{ marginBottom: '1rem', height: 500 }}
                      >
                        {itensAutoProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              itensAutoProp
                            )}
                            title="Proporções de respostas — Itens de Autoavaliação (Discente)"
                          />
                        ) : (
                          <p>Dados de proporções não disponíveis.</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div
                          className={styles.chartContainer}
                          style={{ flex: 1, height: 400 }}
                        >
                          {itensAutoMed ? (
                            <ActivityChart
                              chartData={formatMediasItensChartData(
                                itensAutoMed
                              )}
                              title="Médias — Itens de Autoavaliação (Discente)"
                              customOptions={{
                                plugins: { legend: { display: false } },
                              }}
                            />
                          ) : (
                            <p>Dados de médias não disponíveis.</p>
                          )}
                        </div>
                        <div
                          className={styles.chartContainer}
                          style={{ flex: 1, height: 400 }}
                        >
                          {itensAutoBox ? (
                            <BoxplotChart
                              apiData={itensAutoBox}
                              title="Boxplot Discente"
                            />
                          ) : (
                            <p>Dados de boxplot não disponíveis.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AUTOAVALIAÇÃO DOCENTE */}
                {activeTab === 'autoavaliacao_docente' && (
                  <div style={{ position: 'relative' }}>
                    <div>
                      <div
                        className={styles.chartContainer}
                        style={{ marginBottom: '1rem', height: 500 }}
                      >
                        {docenteProp ? (
                          <ActivityChart
                            chartData={formatProporcoesSubdimChartData(
                              docenteProp
                            )}
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
                        <div
                          className={styles.chartContainer}
                          style={{ flex: 1, height: 400 }}
                        >
                          {docenteMed ? (
                            <ActivityChart
                              chartData={formatMediasSubdimChartData(
                                docenteMed
                              )}
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
                        <div
                          className={styles.chartContainer}
                          style={{ flex: 1, height: 400 }}
                        >
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

                {/* ATIVIDADES */}
                {activeTab === 'atividades' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{ gridTemplateColumns: '1fr' }}
                    >
                      {/* Discente */}
                      <div className={styles.chartContainerFlex}>
                        <ActivityChart
                          chartData={datasets.atividades}
                          title="Percentual de Participação em Atividades (Discente)"
                          customOptions={{
                            plugins: { tooltip: twoDecTooltip('%') },
                            scales: {
                              x: {
                                ticks: {
                                  maxRotation: 0,
                                  minRotation: 0,
                                  autoSkip: false,
                                },
                              },
                            },
                          }}
                        />
                      </div>

                      {/* Docente */}
                      <div className={styles.chartContainerFlex}>
                        {atividadesDoc ? (
                          <ActivityChart
                            chartData={formatAtividadesChartData(atividadesDoc)}
                            title="Percentual de Participação em Atividades (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>Dados de atividades do docente não disponíveis.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* BASE DOCENTE */}
                {activeTab === 'base_docente' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {docTurmaProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              docTurmaProp
                            )}
                            title="Proporções — Itens de Avaliação da Turma (Docente)"
                            customOptions={{
                              layout: {
                                padding: {
                                  top: 8,
                                  right: -12,
                                  bottom: 0,
                                  left: -30,
                                },
                              },
                              scales: {
                                y: { max: 100 },
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>Proporções (itens) não disponíveis.</p>
                        )}
                      </div>

                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {docTurmaMed ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(docTurmaMed)}
                            title="Médias dos itens — Avaliação da Turma (Docente)"
                            customOptions={{
                              plugins: {
                                legend: { display: false },
                                tooltip: twoDecTooltip(),
                              },
                              layout: {
                                padding: {
                                  top: 8,
                                  right: 6,
                                  bottom: 0,
                                  left: 6,
                                },
                              },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                                y: { max: 4 },
                              },
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
                              plugins: {
                                legend: { display: false },
                                tooltip: twoDecTooltip(),
                              },
                              layout: {
                                padding: {
                                  top: 10,
                                  right: 6,
                                  bottom: 0,
                                  left: 6,
                                },
                              },
                              scales: {
                                y: { max: 5 },
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>Médias por subdimensão não disponíveis.</p>
                        )}
                      </div>
                      <div className={styles.chartContainer}>
                        {docSubProp ? (
                          <ActivityChart
                            chartData={formatProporcoesSubdimChartData(
                              docSubProp
                            )}
                            title="Proporções por Subdimensão — Autoavaliação da Ação Docente (Base Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              layout: {
                                padding: {
                                  top: 50,
                                  right: 6,
                                  bottom: 0,
                                  left: 1,
                                },
                              },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
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
                              plugins: {
                                legend: { display: false },
                                tooltip: twoDecTooltip(),
                              },
                              layout: {
                                padding: {
                                  top: 8,
                                  right: 6,
                                  bottom: 0,
                                  left: 6,
                                },
                              },
                              scales: {
                                y: { max: 5 },
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
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
                              layout: {
                                padding: {
                                  top: 8,
                                  right: 6,
                                  bottom: 0,
                                  left: 6,
                                },
                              },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>Proporções por dimensão não disponíveis.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ATITUDE PROFISSIONAL */}
                {activeTab === 'atitude' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      {/* Médias Discente */}
                      <div className={styles.chartContainer}>
                        {itensAtitudeMedDisc || itensAtitudeMed ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(
                              itensAtitudeMedDisc ?? itensAtitudeMed
                            )}
                            title="Médias — Itens de Atitude Profissional (Discente)"
                            customOptions={{
                              plugins: {
                                legend: { display: false },
                                tooltip: twoDecTooltip(),
                              },
                              scales: {
                                y: { max: 4 },
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>Médias (Discente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Médias Docente (ajustadas) */}
                      <div className={styles.chartContainer}>
                        {itensAtitudeMedDoc ? (
                          <ActivityChart
                            chartData={normalizeAtitudeDocenteChartData(
                              formatMediasItensChartData(itensAtitudeMedDoc)
                            )}
                            title="Médias — Itens de Atitude Profissional (Docente)"
                            customOptions={{
                              plugins: {
                                legend: { display: false },
                                tooltip: twoDecTooltip(),
                              },
                              scales: {
                                y: { max: 4 },
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>Médias (Docente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Proporções Discente */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {itensAtitudePropDisc ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              itensAtitudePropDisc
                            )}
                            title="Proporções — Itens de Atitude Profissional (Discente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                                y: { max: 100 },
                              },
                            }}
                          />
                        ) : (
                          <p>Proporções (Discente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Proporções Docente (ajustadas) */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {itensAtitudePropDoc ? (
                          <ActivityChart
                            chartData={normalizeAtitudeDocenteChartData(
                              formatProporcoesItensChartData(
                                itensAtitudePropDoc
                              )
                            )}
                            title="Proporções — Itens de Atitude Profissional (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                                y: { max: 100 },
                              },
                            }}
                          />
                        ) : (
                          <p>Proporções (Docente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Boxplot Discente */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
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

                {/* GESTÃO DIDÁTICA */}
                {activeTab === 'gestao' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      {/* Discente - Médias */}
                      <div className={styles.chartContainer}>
                        {itensGestaoMedDisc ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(
                              itensGestaoMedDisc
                            )}
                            title="Médias — Itens de Gestão Didática (Discente)"
                            customOptions={{
                              plugins: { legend: { display: false } },
                              scales: {
                                y: { max: 4 },
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>Médias (Discente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Docente - Médias */}
                      <div className={styles.chartContainer}>
                        {itensGestaoMedDoc && itensGestaoMedDoc.length > 0 ? (
                          <ActivityChart
                            chartData={formatMediasItensChartData(
                              itensGestaoMedDoc
                            )}
                            title="Médias — Itens de Gestão Didática (Docente)"
                            customOptions={{
                              plugins: {
                                legend: { display: false },
                                tooltip: twoDecTooltip(),
                              },
                              scales: {
                                y: { max: 4 },
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p>
                            Médias — Itens de Gestão Didática (Docente) não
                            disponíveis.
                          </p>
                        )}
                      </div>

                      {/* Discente - Proporções */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {itensGestaoPropDisc ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              itensGestaoPropDisc
                            )}
                            title="Proporções — Itens de Gestão Didática (Discente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                                y: { max: 100 },
                              },
                            }}
                          />
                        ) : (
                          <p>Proporções (Discente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Docente - Proporções */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {itensGestaoPropDoc &&
                        itensGestaoPropDoc.length > 0 ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              itensGestaoPropDoc
                            )}
                            title="Proporções — Itens de Gestão Didática (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                                y: { max: 100 },
                              },
                            }}
                          />
                        ) : (
                          <p>
                            Proporções — Itens de Gestão Didática (Docente) não
                            disponíveis.
                          </p>
                        )}
                      </div>

                      {/* Boxplot Discente */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {itensGestaoBoxDisc ? (
                          <BoxplotChart
                            apiData={itensGestaoBoxDisc}
                            title="Boxplot — Distribuição das Médias por Item (Gestão Didática • Discente)"
                          />
                        ) : (
                          <p>
                            Boxplot — Gestão Didática (Discente) não disponível.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* PROCESSO — atualizado */}
                {activeTab === 'processo' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(420px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      {/* Discente - Médias */}
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

                      {/* Docente - Médias */}
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

                      {/* Discente - Proporções */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {procDiscProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              procDiscProp
                            )}
                            title="Proporções — Itens de Processo Avaliativo (Discente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                                y: { max: 100 },
                              },
                            }}
                          />
                        ) : (
                          <p>Proporções (Discente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Docente - Proporções */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
                        {procDocProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              procDocProp
                            )}
                            title="Proporções — Itens de Processo Avaliativo (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                              scales: {
                                x: {
                                  ticks: {
                                    maxRotation: 0,
                                    minRotation: 0,
                                    autoSkip: false,
                                  },
                                },
                                y: { max: 100 },
                              },
                            }}
                          />
                        ) : (
                          <p>Proporções (Docente) não disponíveis.</p>
                        )}
                      </div>

                      {/* Boxplot Discente */}
                      <div
                        className={styles.chartContainer}
                        style={{ gridColumn: '1 / -1' }}
                      >
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

                {/* INSTALAÇÕES */}
                {activeTab === 'instalacoes' && (
                  <div style={{ position: 'relative' }}>
                    <div
                      className={styles.dashboardLayout}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '1rem',
                      }}
                    >
                      {/* 1) Proporções — Discente (linha inteira) */}
                      <div className={styles.chartContainer}>
                        {itensInstalacoesProp ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              itensInstalacoesProp
                            )}
                            title="Proporções — Itens de Instalações Físicas (Discente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                            }}
                          />
                        ) : (
                          <p>Dados não disponíveis.</p>
                        )}
                      </div>

                      {/* 2) Proporções — Docente (logo abaixo) */}
                      <div className={styles.chartContainer}>
                        {itensInstalacoesPropDoc ? (
                          <ActivityChart
                            chartData={formatProporcoesItensChartData(
                              itensInstalacoesPropDoc
                            )}
                            title="Proporções — Itens de Instalações Físicas (Docente)"
                            customOptions={{
                              plugins: { tooltip: twoDecTooltip('%') },
                            }}
                          />
                        ) : (
                          <p>Proporções (Docente) não disponíveis.</p>
                        )}
                      </div>

                      {/* 3) Médias lado a lado */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(360px, 1fr))',
                          gap: '1rem',
                        }}
                      >
                        <div className={styles.chartContainer}>
                          {itensInstalacoesMed ? (
                            <ActivityChart
                              chartData={formatMediasItensChartData(
                                itensInstalacoesMed
                              )}
                              title="Médias — Itens de Instalações Físicas (Discente)"
                              customOptions={{
                                plugins: { legend: { display: false } },
                                scales: { y: { max: 4 } },
                              }}
                            />
                          ) : (
                            <p>Dados não disponíveis.</p>
                          )}
                        </div>
                        <div className={styles.chartContainer}>
                          {itensInstalacoesMedDoc ? (
                            <ActivityChart
                              chartData={formatMediasItensChartData(
                                itensInstalacoesMedDoc
                              )}
                              title="Médias — Itens de Instalações Físicas (Docente)"
                              customOptions={{
                                plugins: { legend: { display: false } },
                                scales: { y: { max: 4 } },
                              }}
                            />
                          ) : (
                            <p>Médias (Docente) não disponíveis.</p>
                          )}
                        </div>
                      </div>

                      {/* 4) Boxplot linha inteira */}
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
