'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Building, Loader2 } from 'lucide-react';

// Contexto Global
import { useGlobalData } from '../context/DataContext'; 

// Componentes
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import DocenteFilters from '../components/DocenteFilters';
import QuestionChart from '../components/QuestionChart';

// Utils e Estilos
import styles from '../../../../styles/dados.module.css';
import { questionMappingDocente, ratingToScore } from '../lib/questionMappingDocente';
import { dimensionMapping as dimensionMappingDocente } from '../lib/DimensionMappingDocente';

const DEFAULT_FILTERS = {
  lotacao: 'todos',
  cargo: 'todos',
  pergunta: 'todas',
  dimensao: 'todas',
};

/* ==========================================================================
   Componente de Loading Overlay
   ========================================================================== */
function LoadingOverlay({ progress }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(255, 255, 255, 0.98)', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ width: '350px', textAlign: 'center', padding: '2rem' }}>
        <Loader2 style={{ width: '48px', height: '48px', color: '#FF8E29', marginBottom: '1.5rem', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ fontSize: '1.5rem', color: '#1a1a1a', marginBottom: '0.5rem', fontWeight: '700' }}>Carregando Docentes</h2>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>Sincronizando dados de autoavaliação...</p>
        <div style={{ width: '100%', height: '12px', backgroundColor: '#f0f0f0', borderRadius: '10px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#FF8E29', transition: 'width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)' }} />
        </div>
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '600', color: '#FF8E29' }}>
          <span>{progress < 100 ? 'Baixando...' : 'Processando...'}</span>
          <span>{progress}%</span>
        </div>
      </div>
      <style jsx global>{` @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } `}</style>
    </div>
  );
}

export default function DocentePage() {
  // 1. Acesso ao Cache Global
  const { cache, saveToCache } = useGlobalData();

  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [selectedFiltersA, setSelectedFiltersA] = useState(DEFAULT_FILTERS);
  const [selectedFiltersB, setSelectedFiltersB] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    // 2. Lógica de Checagem de Cache
    if (cache.docente && cache.docente.length > 0) {
      setAllData(cache.docente);
      setProgress(100);
      setLoading(false);
      return;
    }

    async function loadTeacherData() {
      try {
        const response = await fetch('/api/docente');
        if (!response.ok) throw new Error('Falha ao buscar dados');

        const contentLength = response.headers.get('Content-Length');
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
        
        const reader = response.body.getReader();
        let loadedSize = 0;
        let chunks = [];

        while(true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loadedSize += value.length;
          if (totalSize > 0) setProgress(Math.round((loadedSize / totalSize) * 100));
        }

        const allChunks = new Uint8Array(loadedSize);
        let position = 0;
        for(let chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }

        const data = JSON.parse(new TextDecoder("utf-8").decode(allChunks));
        const teacherData = data[2]?.data || data;
        const finalData = Array.isArray(teacherData) ? teacherData : [];

        // 3. Salva no Cache Global para futuras visitas
        saveToCache('docente', finalData);
        
        setAllData(finalData);
        setTimeout(() => setLoading(false), 600);
      } catch (err) {
        console.error('Erro ao carregar dados dos docentes:', err);
        setLoading(false);
      }
    }
    loadTeacherData();
  }, [cache.docente, saveToCache]);

  /* =========================
     Cálculos Memoizados
  ========================= */
  const filteredDataA = useMemo(() => loading ? [] : applyFiltersDocente(allData, selectedFiltersA), [allData, selectedFiltersA, loading]);
  const filteredDataB = useMemo(() => loading ? [] : applyFiltersDocente(allData, selectedFiltersB), [allData, selectedFiltersB, loading]);

  const filterOptionsA = useMemo(() => buildDocenteFilterOptions(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filterOptionsB = useMemo(() => buildDocenteFilterOptions(allData, selectedFiltersB), [allData, selectedFiltersB]);

  const topLotacaoA = useMemo(() => calcTopLotacao(filteredDataA), [filteredDataA]);
  const topLotacaoB = useMemo(() => calcTopLotacao(filteredDataB), [filteredDataB]);

  const chartsByDimensionA = useMemo(() => buildChartsByDimensionDocente(filteredDataA, selectedFiltersA, false), [filteredDataA, selectedFiltersA]);
  const chartsByDimensionB = useMemo(() => buildChartsByDimensionDocente(filteredDataB, selectedFiltersB, true), [filteredDataB, selectedFiltersB]);

  const bMap = useMemo(() => new Map((chartsByDimensionB || []).map((c) => [c.dimensionName, c])), [chartsByDimensionB]);

  const handleFilterChangeA = (e) => {
    const { name, value } = e.target;
    if (name === 'dimensao') {
      setSelectedFiltersA((prev) => ({ ...prev, dimensao: value, pergunta: 'todas' }));
      return;
    }
    setSelectedFiltersA((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterChangeB = (e) => {
    const { name, value } = e.target;
    if (name === 'dimensao') {
      setSelectedFiltersB((prev) => ({ ...prev, dimensao: value, pergunta: 'todas' }));
      return;
    }
    setSelectedFiltersB((prev) => ({ ...prev, [name]: value }));
  };

  const specialPairSideBySide = compareEnabled && chartsByDimensionA.length === 1 && chartsByDimensionB.length === 1;

  return (
    <div className={styles.container}>
      {loading && <LoadingOverlay progress={progress} />}

      <Header title="Análise de Respostas dos Docentes" subtitle="Dados referentes ao questionário de autoavaliação" />

      <div style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.8s ease-in-out', pointerEvents: loading ? 'none' : 'auto' }}>
        
        <div className={`${styles.statsGrid} ${compareEnabled ? styles.statsGridCompare : ''}`}>
          <StatCard title={compareEnabled ? 'Total Participantes (A)' : 'Total de Participantes'} value={filteredDataA.length.toLocaleString('pt-BR')} icon={<Users />} />
          <StatCard title={compareEnabled ? 'Top Lotação (A)' : 'Lotação com Mais Participantes'} value={topLotacaoA} icon={<Building />} />

          {compareEnabled && (
            <>
              <StatCard title="Total Participantes (B)" value={filteredDataB.length.toLocaleString('pt-BR')} icon={<Users />} />
              <StatCard title="Top Lotação (B)" value={topLotacaoB} icon={<Building />} />
            </>
          )}
        </div>

        <div className={compareEnabled ? styles.filtersCompareGrid : styles.filtersSingle}>
          <DocenteFilters
            title={compareEnabled ? 'Filtros (A)' : 'Filtros'}
            filters={filterOptionsA}
            selectedFilters={selectedFiltersA}
            onFilterChange={handleFilterChangeA}
            questionMap={questionMappingDocente}
            dimensionMap={dimensionMappingDocente}
            showCompareToggle
            compareEnabled={compareEnabled}
            onCompareChange={(checked) => {
              setCompareEnabled(checked);
              if (checked) setSelectedFiltersB({ ...selectedFiltersA });
            }}
          />

          {compareEnabled && (
            <DocenteFilters title="Filtros (B)" filters={filterOptionsB} selectedFilters={selectedFiltersB} onFilterChange={handleFilterChangeB} questionMap={questionMappingDocente} dimensionMap={dimensionMappingDocente} />
          )}
        </div>

        <div className={styles.chartsMainContainer}>
          {compareEnabled ? (
            specialPairSideBySide ? (
              <section className={styles.dimensionWrapper}>
                <div className={styles.equalGrid}>
                  <div className={styles.chartContainerCard}>
                    <QuestionChart chartData={chartsByDimensionA[0].chartData} title={`${chartsByDimensionA[0].dimensionName} (A)`} questionMap={questionMappingDocente} />
                  </div>
                  <div className={styles.chartContainerCard}>
                    <QuestionChart chartData={chartsByDimensionB[0].chartData} title={`${chartsByDimensionB[0].dimensionName} (B)`} questionMap={questionMappingDocente} />
                  </div>
                </div>
              </section>
            ) : (
              chartsByDimensionA.map(({ dimensionName, chartData }) => {
                const b = bMap.get(dimensionName);
                return (
                  <section key={`dim-section-${dimensionName}`} className={styles.dimensionWrapper}>
                    <div className={styles.equalGrid}>
                      <div className={styles.chartContainerCard} style={!b ? { gridColumn: '1 / -1' } : undefined}>
                        <QuestionChart chartData={chartData} title={`${dimensionName} (A)`} questionMap={questionMappingDocente} />
                      </div>
                      {b && <div className={styles.chartContainerCard}><QuestionChart chartData={b.chartData} title={`${dimensionName} (B)`} questionMap={questionMappingDocente} /></div>}
                    </div>
                  </section>
                );
              })
            )
          ) : (
            <div className={styles.singleGrid}>
              {chartsByDimensionA.map(({ dimensionName, chartData }) => (
                <div key={`dim-card-${dimensionName}`} className={styles.chartContainerCard}>
                  <QuestionChart chartData={chartData} title={dimensionName} questionMap={questionMappingDocente} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Helpers (Lógica mantida)
========================= */

function applyFiltersDocente(allData, selectedFilters) {
  if (!Array.isArray(allData)) return [];
  let data = allData;
  if (selectedFilters.lotacao !== 'todos') data = data.filter((d) => d.UND_LOTACAO_DOCENTE === selectedFilters.lotacao);
  if (selectedFilters.cargo !== 'todos') data = data.filter((d) => d.CARGO_DOCENTE === selectedFilters.cargo);
  return data;
}

function buildDocenteFilterOptions(allData, selectedFilters) {
  if (!Array.isArray(allData) || !allData.length) return { lotacoes: [], cargos: [] };
  let lotacaoData = allData, cargoData = allData;
  if (selectedFilters.lotacao !== 'todos') cargoData = cargoData.filter((d) => d.UND_LOTACAO_DOCENTE === selectedFilters.lotacao);
  if (selectedFilters.cargo !== 'todos') lotacaoData = lotacaoData.filter((d) => d.CARGO_DOCENTE === selectedFilters.cargo);
  const lotacoesRaw = [...new Set(lotacaoData.map((d) => d.UND_LOTACAO_DOCENTE))].filter(Boolean);
  const lotacoesSorted = lotacoesRaw.filter((l) => l !== 'NÃO INFORMADO').sort();
  if (lotacoesRaw.includes('NÃO INFORMADO')) lotacoesSorted.push('NÃO INFORMADO');
  const cargosFiltered = [...new Set(cargoData.map((d) => d.CARGO_DOCENTE))].filter(Boolean).filter((c) => c !== 'CARGO INDEFINIDO' && c !== 'MEDICO-AREA').sort();
  return { lotacoes: lotacoesSorted, cargos: cargosFiltered };
}

function calcTopLotacao(filteredData) {
  if (!filteredData?.length) return 'N/A';
  const counts = new Map();
  for (const row of filteredData) { const lotacao = row.UND_LOTACAO_DOCENTE || 'NÃO INFORMADO'; counts.set(lotacao, (counts.get(lotacao) || 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return `${top[0]} — ${top[1].toLocaleString('pt-BR')}`;
}

function buildChartsByDimensionDocente(filteredData, selectedFilters, isB = false) {
  if (!dimensionMappingDocente) return [];
  const sDim = selectedFilters?.dimensao || 'todas', sQ = selectedFilters?.pergunta || 'todas';
  const entries = sDim !== 'todas' ? [[sDim, dimensionMappingDocente[sDim] || []]] : Object.entries(dimensionMappingDocente);
  return entries.map(([dimensionName, questionKeys]) => {
    let keys = Array.isArray(questionKeys) ? [...questionKeys] : [];
    if (sQ !== 'todas') keys = keys.includes(sQ) ? [sQ] : [];
    if (!keys.length) return null;
    const labels = [], dataPoints = [];
    for (const key of keys) {
      const scores = (filteredData || []).map((item) => ratingToScore[item[key]]).filter((v) => v != null);
      if (scores.length) { labels.push(key); dataPoints.push(Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))); }
    }
    return labels.length ? { dimensionName, chartData: { labels, datasets: [{ label: 'Média de Respostas', data: dataPoints, backgroundColor: isB ? 'rgba(54, 162, 235, 0.8)' : 'rgba(255, 142, 41, 0.8)', borderColor: isB ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 142, 41, 1)', borderWidth: 1 }] } } : null;
  }).filter(Boolean);
}