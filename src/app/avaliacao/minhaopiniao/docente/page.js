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
   PARSER ROBUSTO (MÁQUINA DE ESTADO)
   Filtra docentes com mais de 3 respostas nulas (NULL).
   ========================================================================== */
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let insideQuote = false;
  const cleanText = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentVal += '"';
        i++; 
      } else {
        insideQuote = !insideQuote;
      }
    } 
    else if (char === ',' && !insideQuote) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } 
    else if (char === '\n' && !insideQuote) {
      currentRow.push(currentVal.trim());
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [];
      currentVal = '';
    } 
    else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  const headers = rows[0]; 
  const dataRows = rows.slice(1);

  return dataRows.map(columns => {
    if (columns.length < 40) return null;

    // --- LÓGICA DE FILTRAGEM DE NULLS ---
    // Índices 9 a 56 são Pergunta_35 a Pergunta_82
    let nullCount = 0;
    for (let j = 9; j <= 56; j++) {
      const val = columns[j];
      if (!val || val === 'NULL' || val === 'N/I') {
        nullCount++;
      }
    }

    // Se tiver mais de 3 nulls, o docente não entra na contagem nem na análise
    if (nullCount > 3) return null;

    const rowObj = {
      CARGO_DOCENTE: columns[5] || 'N/I',
      UND_LOTACAO_DOCENTE: columns[6] || 'N/I',
    };

    // Mapeia perguntas dinamicamente baseado nos headers (Pergunta_35...)
    headers.forEach((header, index) => {
      if (header.startsWith('Pergunta_')) {
        rowObj[header] = columns[index];
      }
    });

    return rowObj;
  }).filter(Boolean);
}

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
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>Sincronizando dados e filtrando inconsistências...</p>
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
  const { cache, saveToCache } = useGlobalData();

  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [selectedFiltersA, setSelectedFiltersA] = useState(DEFAULT_FILTERS);
  const [selectedFiltersB, setSelectedFiltersB] = useState(DEFAULT_FILTERS);

  useEffect(() => {
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
        let pos = 0;
        for(let c of chunks) { allChunks.set(c, pos); pos += c.length; }

        const data = parseCSV(new TextDecoder("utf-8").decode(allChunks));

        saveToCache('docente', data);
        setAllData(data);
        setTimeout(() => setLoading(false), 600);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setLoading(false);
      }
    }
    loadTeacherData();
  }, [cache.docente, saveToCache]);

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
    setSelectedFiltersA((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterChangeB = (e) => {
    const { name, value } = e.target;
    setSelectedFiltersB((prev) => ({ ...prev, [name]: value }));
  };

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
          ) : (
            <div className={styles.singleGrid}>
              {chartsByDimensionA.map(({ dimensionName, chartData }) => (
                <div key={`dim-card-${dimensionName}`} className={styles.chartContainerCard} style={chartsByDimensionA.length === 1 ? { gridColumn: '1 / -1' } : {}}>
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
   Helpers
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
  
  const uniq = (key, data) => [...new Set(data.map(r => r[key]))].filter(v => v && v !== 'N/I' && v !== 'NÃO INFORMADO').sort();

  return { 
    lotacoes: uniq('UND_LOTACAO_DOCENTE', allData), 
    cargos: uniq('CARGO_DOCENTE', allData) 
  };
}

function calcTopLotacao(filteredData) {
  if (!filteredData?.length) return 'N/A';
  const counts = filteredData.reduce((acc, r) => { const l = r.UND_LOTACAO_DOCENTE || 'N/I'; acc[l] = (acc[l] || 0) + 1; return acc; }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return `${top[0]} — ${top[1].toLocaleString('pt-BR')}`;
}

function buildChartsByDimensionDocente(filteredData, selectedFilters, isB = false) {
  if (!dimensionMappingDocente) return [];
  const sDim = selectedFilters?.dimensao || 'todas', sQ = selectedFilters?.pergunta || 'todas';
  
  return Object.entries(dimensionMappingDocente)
    .filter(([name]) => sDim === 'todas' || name === sDim)
    .map(([dimensionName, questionCodes]) => {
      const labels = [], dataPoints = [];
      for (const code of questionCodes) {
        if (sQ !== 'todas' && code !== sQ) continue;

        // Traduz 'P.x.35' para 'Pergunta_35'
        const match = code.match(/\.(\d+)$/);
        const dataKey = match ? `Pergunta_${match[1]}` : code;

        const scores = filteredData.map(i => {
          const val = i[dataKey];
          const numeric = parseFloat(val);
          return !isNaN(numeric) ? numeric : (ratingToScore ? ratingToScore[val] : null);
        }).filter(v => v !== null && v !== undefined);

        if (scores.length) { 
          labels.push(code); 
          dataPoints.push(Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))); 
        }
      }
      return labels.length ? { dimensionName, chartData: { labels, datasets: [{ label: 'Média de Respostas', data: dataPoints, backgroundColor: isB ? 'rgba(54, 162, 235, 0.8)' : 'rgba(255, 142, 41, 0.8)', borderColor: isB ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 142, 41, 1)', borderWidth: 1 }] } } : null;
    }).filter(Boolean);
}