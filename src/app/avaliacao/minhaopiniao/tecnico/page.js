'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Building, Loader2 } from 'lucide-react';

// Componentes
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import TecnicoFilters from '../components/TecnicoFilters';
import QuestionChart from '../components/QuestionChart';

// Utils e Estilos
import styles from '../../../../styles/dados.module.css';
import { questionMappingTecnico, ratingToScore } from '../lib/questionMappingTecnico';
import { dimensionMappingTecnico } from '../lib/dimensionMappingTecnico';

const DEFAULT_FILTERS = {
  lotacao: 'todos',
  exercicio: 'todos',
  cargo: 'todos',
  pergunta: 'todas',
  dimensao: 'todas',
};

/* ==========================================================================
   Componente de Loading Overlay (Bloqueio de Tela com Progresso)
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
        <Loader2 style={{ 
          width: '48px', height: '48px', color: '#FF8E29', 
          marginBottom: '1.5rem', animation: 'spin 1s linear infinite' 
        }} />
        <h2 style={{ fontSize: '1.5rem', color: '#1a1a1a', marginBottom: '0.5rem', fontWeight: '700' }}>
          Carregando Técnicos
        </h2>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>
          Organizando dados de autoavaliação...
        </p>
        
        <div style={{ 
          width: '100%', height: '12px', backgroundColor: '#f0f0f0', 
          borderRadius: '10px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            width: `${progress}%`, height: '100%', backgroundColor: '#FF8E29', 
            transition: 'width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)',
            backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
            backgroundSize: '1rem 1rem'
          }} />
        </div>
        
        <div style={{ 
          marginTop: '12px', display: 'flex', justifyContent: 'space-between', 
          fontSize: '0.9rem', fontWeight: '600', color: '#FF8E29' 
        }}>
          <span>{progress < 100 ? 'Baixando...' : 'Finalizando...'}</span>
          <span>{progress}%</span>
        </div>
      </div>
      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function TecnicoPage() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [selectedFiltersA, setSelectedFiltersA] = useState(DEFAULT_FILTERS);
  const [selectedFiltersB, setSelectedFiltersB] = useState(DEFAULT_FILTERS);

  /* =====================================================
     Fetch de dados com progresso real (ReadableStream)
  ===================================================== */
  useEffect(() => {
    async function loadTecnicoData() {
      try {
        const response = await fetch('/api/tecnico');
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
          
          if (totalSize > 0) {
            setProgress(Math.round((loadedSize / totalSize) * 100));
          }
        }

        const allChunks = new Uint8Array(loadedSize);
        let position = 0;
        for(let chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }

        const data = JSON.parse(new TextDecoder("utf-8").decode(allChunks));
        const tecnicoData = data[2]?.data || data;
        setAllData(Array.isArray(tecnicoData) ? tecnicoData : []);
        
        // Delay para suavizar a transição visual
        setTimeout(() => setLoading(false), 600);
      } catch (err) {
        console.error('Não foi possível carregar os dados dos técnicos:', err);
        setLoading(false);
      }
    }
    loadTecnicoData();
  }, []);

  /* =====================================================
     Filtros e Cálculos Memoizados
  ===================================================== */
  const filteredDataA = useMemo(() => loading ? [] : applyFiltersTecnico(allData, selectedFiltersA), [allData, selectedFiltersA, loading]);
  const filteredDataB = useMemo(() => loading ? [] : applyFiltersTecnico(allData, selectedFiltersB), [allData, selectedFiltersB, loading]);

  const filterOptionsA = useMemo(() => buildTecnicoFilterOptions(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filterOptionsB = useMemo(() => buildTecnicoFilterOptions(allData, selectedFiltersB), [allData, selectedFiltersB]);

  const topLotacaoA = useMemo(() => calcTopLotacaoTecnico(filteredDataA), [filteredDataA]);
  const topLotacaoB = useMemo(() => calcTopLotacaoTecnico(filteredDataB), [filteredDataB]);

  const chartsA = useMemo(() => buildChartsTecnico(filteredDataA, selectedFiltersA, false), [filteredDataA, selectedFiltersA]);
  const chartsB = useMemo(() => buildChartsTecnico(filteredDataB, selectedFiltersB, true), [filteredDataB, selectedFiltersB]);

  const chartsBByName = useMemo(() => {
    const m = new Map();
    for (const c of chartsB) m.set(c.dimensionName, c);
    return m;
  }, [chartsB]);

  /* =====================================================
     Handlers
  ===================================================== */
  const handleFilterChangeA = (e) => {
    const { name, value } = e.target;
    if (name === 'lotacao') {
      setSelectedFiltersA(prev => ({ ...prev, lotacao: value, exercicio: 'todos', cargo: 'todos' }));
      return;
    }
    if (name === 'exercicio') {
      setSelectedFiltersA(prev => ({ ...prev, exercicio: value, cargo: 'todos' }));
      return;
    }
    if (name === 'dimensao') {
      setSelectedFiltersA(prev => ({ ...prev, dimensao: value, pergunta: 'todas' }));
      return;
    }
    setSelectedFiltersA(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChangeB = (e) => {
    const { name, value } = e.target;
    if (name === 'lotacao') {
      setSelectedFiltersB(prev => ({ ...prev, lotacao: value, exercicio: 'todos', cargo: 'todos' }));
      return;
    }
    if (name === 'exercicio') {
      setSelectedFiltersB(prev => ({ ...prev, exercicio: value, cargo: 'todos' }));
      return;
    }
    if (name === 'dimensao') {
      setSelectedFiltersB(prev => ({ ...prev, dimensao: value, pergunta: 'todas' }));
      return;
    }
    setSelectedFiltersB(prev => ({ ...prev, [name]: value }));
  };

  const specialPairSideBySide = compareEnabled && chartsA.length === 1 && chartsB.length === 1;

  return (
    <div className={styles.container}>
      {loading && <LoadingOverlay progress={progress} />}

      <Header
        title="Análise de Respostas dos Técnicos"
        subtitle="Dados referentes ao questionário de autoavaliação"
      />

      <div style={{ 
        opacity: loading ? 0 : 1, 
        transition: 'opacity 0.8s ease-in-out',
        pointerEvents: loading ? 'none' : 'auto' 
      }}>
        {/* Stats Section */}
        <div className={`${styles.statsGrid} ${compareEnabled ? styles.statsGridCompare : ''}`}>
          <StatCard
            title={compareEnabled ? 'Total Participantes (A)' : 'Total de Participantes'}
            value={filteredDataA.length.toLocaleString('pt-BR')}
            icon={<Users />}
          />
          <StatCard
            title={compareEnabled ? 'Top Lotação (A)' : 'Lotação com Mais Participantes'}
            value={topLotacaoA}
            icon={<Building />}
          />

          {compareEnabled && (
            <>
              <StatCard
                title="Total Participantes (B)"
                value={filteredDataB.length.toLocaleString('pt-BR')}
                icon={<Users />}
              />
              <StatCard
                title="Top Lotação (B)"
                value={topLotacaoB}
                icon={<Building />}
              />
            </>
          )}
        </div>

        {/* Filters Section */}
        <div className={compareEnabled ? styles.filtersCompareGrid : styles.filtersSingle}>
          <TecnicoFilters
            title={compareEnabled ? 'Filtros (A)' : 'Filtros'}
            filters={filterOptionsA}
            selectedFilters={selectedFiltersA}
            onFilterChange={handleFilterChangeA}
            questionMap={questionMappingTecnico}
            dimensionMap={dimensionMappingTecnico}
            showCompareToggle
            compareEnabled={compareEnabled}
            onCompareChange={(checked) => {
              setCompareEnabled(checked);
              if (checked) setSelectedFiltersB({ ...selectedFiltersA });
            }}
          />

          {compareEnabled && (
            <TecnicoFilters
              title="Filtros (B)"
              filters={filterOptionsB}
              selectedFilters={selectedFiltersB}
              onFilterChange={handleFilterChangeB}
              questionMap={questionMappingTecnico}
              dimensionMap={dimensionMappingTecnico}
            />
          )}
        </div>

        {/* Charts Main Container */}
        <div className={styles.chartsMainContainer}>
          {compareEnabled ? (
            specialPairSideBySide ? (
              <section className={styles.dimensionWrapper}>
                <div className={styles.equalGrid}>
                  <div className={styles.chartContainerCard}>
                    <QuestionChart chartData={chartsA[0].chartData} title={`${chartsA[0].dimensionName} (A)`} questionMap={questionMappingTecnico} />
                  </div>
                  <div className={styles.chartContainerCard}>
                    <QuestionChart chartData={chartsB[0].chartData} title={`${chartsB[0].dimensionName} (B)`} questionMap={questionMappingTecnico} />
                  </div>
                </div>
              </section>
            ) : (
              chartsA.map(({ dimensionName, chartData }) => {
                const chartB = chartsBByName.get(dimensionName);
                return (
                  <section key={`dim-section-${dimensionName}`} className={styles.dimensionWrapper}>
                    <div className={styles.equalGrid}>
                      <div className={styles.chartContainerCard} style={!chartB ? { gridColumn: '1 / -1' } : undefined}>
                        <QuestionChart chartData={chartData} title={`${dimensionName} (A)`} questionMap={questionMappingTecnico} />
                      </div>
                      {chartB && (
                        <div className={styles.chartContainerCard}>
                          <QuestionChart chartData={chartB.chartData} title={`${dimensionName} (B)`} questionMap={questionMappingTecnico} />
                        </div>
                      )}
                    </div>
                  </section>
                );
              })
            )
          ) : (
            <div className={styles.singleGrid}>
              {chartsA.map(({ dimensionName, chartData }) => (
                <div key={`dim-card-${dimensionName}`} className={styles.chartContainerCard}>
                  <QuestionChart chartData={chartData} title={String(dimensionName)} questionMap={questionMappingTecnico} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   Helpers
===================================================== */

function applyFiltersTecnico(allData, selectedFilters) {
  if (!Array.isArray(allData)) return [];
  let data = allData;
  if (selectedFilters.lotacao !== 'todos') data = data.filter((d) => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao);
  if (selectedFilters.exercicio !== 'todos') data = data.filter((d) => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio);
  if (selectedFilters.cargo !== 'todos') data = data.filter((d) => d.CARGO_TECNICO === selectedFilters.cargo);
  return data;
}

function buildTecnicoFilterOptions(allData, selectedFilters) {
  if (!Array.isArray(allData) || !allData.length) return { lotacoes: [], exercicios: [], cargos: [] };
  let lotData = allData, exeData = allData, carData = allData;

  if (selectedFilters.lotacao !== 'todos') { exeData = exeData.filter(d => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao); carData = carData.filter(d => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao); }
  if (selectedFilters.exercicio !== 'todos') { lotData = lotData.filter(d => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio); carData = carData.filter(d => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio); }
  if (selectedFilters.cargo !== 'todos') { lotData = lotData.filter(d => d.CARGO_TECNICO === selectedFilters.cargo); exeData = exeData.filter(d => d.CARGO_TECNICO === selectedFilters.cargo); }

  const uSort = (data, key) => [...new Set(data.map(d => d[key]))].filter(Boolean).sort();
  return { lotacoes: uSort(lotData, 'UND_LOTACAO_TECNICO'), exercicios: uSort(exeData, 'UND_EXERCICIO_TECNICO'), cargos: uSort(carData, 'CARGO_TECNICO') };
}

function calcTopLotacaoTecnico(filteredData) {
  if (!filteredData?.length) return 'N/A';
  const counts = new Map();
  for (const row of filteredData) { const lot = row.UND_LOTACAO_TECNICO || 'N/A'; counts.set(lot, (counts.get(lot) || 0) + 1); }
  const top = [...counts.entries()].sort((a, b) => (b[1] - a[1]))[0];
  return `${top[0]} — ${top[1].toLocaleString('pt-BR')}`;
}

function buildChartsTecnico(filteredData, selectedFilters, isB = false) {
  if (!questionMappingTecnico || !dimensionMappingTecnico) return [];
  const bg = isB ? 'rgba(54, 162, 235, 0.8)' : 'rgba(255, 142, 41, 0.8)';
  const border = isB ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 142, 41, 1)';

  if (selectedFilters.pergunta !== 'todas') {
    const key = selectedFilters.pergunta;
    const sc = (filteredData || []).map(i => ratingToScore[i[key]]).filter(v => v != null);
    const avg = sc.length ? Number((sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(2)) : 0;
    return [{ dimensionName: 'Pergunta (selecionada)', chartData: { labels: [key], datasets: [{ label: 'Média', data: [avg], backgroundColor: bg, borderColor: border, borderWidth: 1 }] } }];
  }

  const entries = selectedFilters.dimensao !== 'todas' ? [[selectedFilters.dimensao, dimensionMappingTecnico[selectedFilters.dimensao] || []]] : Object.entries(dimensionMappingTecnico);
  return entries.map(([name, keys]) => {
    const labels = [], points = [];
    for (const k of keys || []) {
      const sc = (filteredData || []).map(i => ratingToScore[i[k]]).filter(v => v != null);
      if (sc.length) { labels.push(k); points.push(Number((sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(2))); }
    }
    return labels.length ? { dimensionName: name, chartData: { labels, datasets: [{ label: 'Média', data: points, backgroundColor: bg, borderColor: border, borderWidth: 1 }] } } : null;
  }).filter(Boolean);
}