'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Building2, Loader2 } from 'lucide-react';

// Contexto Global
import { useGlobalData } from '../context/DataContext'; 

// Componentes
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import DiscenteFilters from '../components/DiscenteFilters';
import QuestionChart from '../components/QuestionChart';

// Utils e Estilos
import styles from '../../../../styles/dados.module.css';
import { questionMapping, ratingToScore } from '../lib/questionMapping';
import { dimensionMapping } from '../lib/DimensionMappingDiscente';

const DEFAULT_FILTERS = {
  campus: 'todos',
  unidade: 'todos',
  curso: 'todos',
  pergunta: 'todas',
  dimensao: 'todas',
};

/* ==========================================================================
   PARSER DE CSV ROBUSTO (Máquina de Estado)
   Ajustado para o novo layout: Curso (3), Campus (4), Unidade/Instituto (5)
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

  const dataRows = rows.slice(1);
  return dataRows.map(columns => {
    // Verificação de segurança para o número de colunas
    if (columns.length < 10) return null;

    /* Mapeamento baseado na sua estrutura enviada:
       0: nome, 1: sexo, 2: tipo, 3: curso, 4: campus, 5: unidade (Instituto), 6: sugestão
    */
    const rowObj = {
      CURSO_DISCENTE: columns[3] || 'N/I',
      CAMPUS_DISCENTE: columns[4] ? columns[4].replace(/^"|"$/g, '') : 'N/I',
      UNIDADE_DISCENTE: columns[5] ? columns[5].replace(/^"|"$/g, '') : 'N/I', // <--- Agora captura o Instituto
    };

    // Perguntas começam após a Sugestão (Índice 6), portanto no Índice 7
    for (let q = 1; q <= 34; q++) {
      rowObj[`Pergunta_${q}`] = columns[6 + q]; 
    }
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
        <h2 style={{ fontSize: '1.5rem', color: '#1a1a1a', marginBottom: '0.5rem', fontWeight: '700' }}>Carregando Dados</h2>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>Mapeando Institutos e Unidades...</p>
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

export default function DiscentePage() {
  const { cache, saveToCache } = useGlobalData();

  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [selectedFiltersA, setSelectedFiltersA] = useState(DEFAULT_FILTERS);
  const [selectedFiltersB, setSelectedFiltersB] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    if (cache.discente && cache.discente.length > 0) {
      setAllData(cache.discente);
      setProgress(100);
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        const response = await fetch('/api/discente');
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

        saveToCache('discente', data);
        setAllData(data);
        setTimeout(() => setLoading(false), 600);
      } catch (err) {
        console.error('Erro ao carregar:', err);
        setLoading(false);
      }
    }
    loadData();
  }, [cache.discente, saveToCache]);

  const filteredDataA = useMemo(() => loading ? [] : applyFilters(allData, selectedFiltersA), [allData, selectedFiltersA, loading]);
  const filteredDataB = useMemo(() => loading ? [] : applyFilters(allData, selectedFiltersB), [allData, selectedFiltersB, loading]);

  const filterOptionsA = useMemo(() => buildFilterOptions(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filterOptionsB = useMemo(() => buildFilterOptions(allData, selectedFiltersB), [allData, selectedFiltersB]);

  const topUnitA = useMemo(() => calcTopUnit(filteredDataA), [filteredDataA]);
  const topUnitB = useMemo(() => calcTopUnit(filteredDataB), [filteredDataB]);

  const chartsByDimensionA = useMemo(() => buildChartsByDimension(filteredDataA, 'rgba(255, 142, 41, 0.8)', 'rgba(255, 142, 41, 1)', selectedFiltersA), [filteredDataA, selectedFiltersA]);
  const chartsByDimensionB = useMemo(() => buildChartsByDimension(filteredDataB, 'rgba(54, 162, 235, 0.8)', 'rgba(54, 162, 235, 1)', selectedFiltersB), [filteredDataB, selectedFiltersB]);

  const handleFilterChangeA = (e) => {
    const { name, value } = e.target;
    setSelectedFiltersA((prev) => sanitizeFilters(allData, { ...prev, [name]: value }));
  };

  const handleFilterChangeB = (e) => {
    const { name, value } = e.target;
    setSelectedFiltersB((prev) => sanitizeFilters(allData, { ...prev, [name]: value }));
  };

  const specialPairSideBySide = compareEnabled && chartsByDimensionA.length === 1 && chartsByDimensionB.length === 1;

  return (
    <div className={styles.container}>
      {loading && <LoadingOverlay progress={progress} />}

      <Header title="Análise de Respostas dos Discentes" subtitle="Dados referentes ao questionário 'Minha Opinião'" />

      <div style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.8s ease-in-out', pointerEvents: loading ? 'none' : 'auto' }}>
        
        <div className={`${styles.statsGrid} ${compareEnabled ? styles.statsGridCompare : ''}`}>
          <StatCard title={compareEnabled ? 'Total Participantes (A)' : 'Total de Participantes'} value={filteredDataA.length.toLocaleString('pt-BR')} icon={<Users />} />
          <StatCard title={compareEnabled ? 'Top Unidade (A)' : 'Unidade com mais participantes'} value={`${topUnitA.name} — ${topUnitA.count.toLocaleString('pt-BR')}`} icon={<Building2 />} />

          {compareEnabled && (
            <>
              <StatCard title="Total Participantes (B)" value={filteredDataB.length.toLocaleString('pt-BR')} icon={<Users />} />
              <StatCard title="Top Unidade (B)" value={`${topUnitB.name} — ${topUnitB.count.toLocaleString('pt-BR')}`} icon={<Building2 />} />
            </>
          )}
        </div>

        <div className={compareEnabled ? styles.filtersCompareGrid : styles.filtersSingle}>
          <DiscenteFilters
            title={compareEnabled ? 'Filtros (A)' : 'Filtros'}
            filters={filterOptionsA}
            selectedFilters={selectedFiltersA}
            onFilterChange={handleFilterChangeA}
            questionMap={questionMapping}
            dimensionMap={dimensionMapping}
            showCompareToggle
            compareEnabled={compareEnabled}
            onCompareChange={(checked) => {
              setCompareEnabled(checked);
              if (checked) setSelectedFiltersB(sanitizeFilters(allData, { ...selectedFiltersA }));
            }}
          />

          {compareEnabled && (
            <DiscenteFilters title="Filtros (B)" filters={filterOptionsB} selectedFilters={selectedFiltersB} onFilterChange={handleFilterChangeB} questionMap={questionMapping} dimensionMap={dimensionMapping} />
          )}
        </div>

        <div className={styles.chartsMainContainer}>
          {compareEnabled ? (
            specialPairSideBySide ? (
              <section className={styles.dimensionWrapper}>
                <div className={styles.equalGrid}>
                  <div className={styles.chartContainerCard}>
                    <QuestionChart chartData={chartsByDimensionA[0].chartData} title={`${chartsByDimensionA[0].dimensionName} (A)`} questionMap={questionMapping} />
                  </div>
                  <div className={styles.chartContainerCard}>
                    <QuestionChart chartData={chartsByDimensionB[0].chartData} title={`${chartsByDimensionB[0].dimensionName} (B)`} questionMap={questionMapping} />
                  </div>
                </div>
              </section>
            ) : (
              <CompareDimensions chartsA={chartsByDimensionA} chartsB={chartsByDimensionB} questionMap={questionMapping} styles={styles} />
            )
          ) : (
            <div className={styles.singleGrid}>
              {chartsByDimensionA.map(({ dimensionName, chartData }) => (
                <div key={`dim-card-${dimensionName}`} className={styles.chartContainerCard} style={chartsByDimensionA.length === 1 ? { gridColumn: '1 / -1' } : {}}>
                  <QuestionChart chartData={chartData} title={dimensionName} questionMap={questionMapping} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Lógica de Comparação e Helpers
   ========================================================================== */
function CompareDimensions({ chartsA, chartsB, questionMap, styles }) {
  const aMap = new Map((chartsA || []).map((c) => [c.dimensionName, c]));
  const bMap = new Map((chartsB || []).map((c) => [c.dimensionName, c]));
  const allNames = Array.from(new Set([...(aMap.keys() || []), ...(bMap.keys() || [])]));

  return (
    <>
      {allNames.map((dimensionName) => {
        const a = aMap.get(dimensionName);
        const b = bMap.get(dimensionName);
        if (!a && !b) return null;
        return (
          <section key={`dim-section-${dimensionName}`} className={styles.dimensionWrapper}>
            <div className={styles.equalGrid}>
              {a && <div className={styles.chartContainerCard} style={!b ? { gridColumn: '1 / -1' } : undefined}><QuestionChart chartData={a.chartData} title={`${dimensionName} (A)`} questionMap={questionMap} /></div>}
              {b && <div className={styles.chartContainerCard} style={!a ? { gridColumn: '1 / -1' } : undefined}><QuestionChart chartData={b.chartData} title={`${dimensionName} (B)`} questionMap={questionMap} /></div>}
            </div>
          </section>
        );
      })}
    </>
  );
}

function norm(v) { return String(v ?? '').trim(); }
function rowMatch(rowValue, selectedValue) { return selectedValue === 'todos' || norm(rowValue) === norm(selectedValue); }

function applyFilters(allData, selectedFilters) {
  if (!Array.isArray(allData)) return [];
  const f = selectedFilters || {};
  return allData.filter((d) => {
    return rowMatch(d.CAMPUS_DISCENTE, f.campus) && 
           rowMatch(d.UNIDADE_DISCENTE, f.unidade) && 
           rowMatch(d.CURSO_DISCENTE, f.curso);
  });
}

function buildFilterOptions(allData, selectedFilters) {
  if (!Array.isArray(allData) || !allData.length) return { campus: [], unidades: [], cursos: [] };
  const f = selectedFilters || { campus: 'todos', unidade: 'todos', curso: 'todos' };
  
  function keepRow(row, ignoreKey) {
    const cOk = ignoreKey === 'CAMPUS_DISCENTE' ? true : rowMatch(row.CAMPUS_DISCENTE, f.campus);
    const uOk = ignoreKey === 'UNIDADE_DISCENTE' ? true : rowMatch(row.UNIDADE_DISCENTE, f.unidade);
    const crOk = ignoreKey === 'CURSO_DISCENTE' ? true : rowMatch(row.CURSO_DISCENTE, f.curso);
    return cOk && uOk && crOk;
  }

  function isValidLabel(text) {
    if (!text) return false;
    const str = String(text).trim();
    if (str.length < 2 || str.length > 80) return false; 
    if (/^\d+$/.test(str)) return false; 
    const lower = str.toLowerCase();
    return !['não informado', 'nao informado', 'n/i', 'ni'].includes(lower);
  }

  function uniq(key) {
    const s = new Set();
    for (const r of allData) { 
      if (keepRow(r, key)) { 
        const v = norm(r[key]); 
        if (isValidLabel(v)) s.add(v); 
      } 
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  return { campus: uniq('CAMPUS_DISCENTE'), unidades: uniq('UNIDADE_DISCENTE'), cursos: uniq('CURSO_DISCENTE') };
}

function sanitizeFilters(allData, filters) {
  return filters; 
}

function calcTopUnit(data) {
  if (!data?.length) return { name: '-', count: 0 };
  const counts = data.reduce((acc, r) => { const n = r.UNIDADE_DISCENTE || 'N/I'; acc[n] = (acc[n] || 0) + 1; return acc; }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { name: top[0], count: top[1] };
}

function buildChartsByDimension(filteredData, bgColor, borderColor, selectedFilters) {
  if (!dimensionMapping) return [];
  const sDim = selectedFilters?.dimensao || 'todas';
  const sQ = selectedFilters?.pergunta || 'todas';

  return Object.entries(dimensionMapping)
    .filter(([name]) => sDim === 'todas' || name === sDim)
    .map(([name, questionCodes]) => {
      let codes = Array.isArray(questionCodes) ? [...questionCodes] : [];
      if (sQ !== 'todas') codes = codes.includes(sQ) ? [sQ] : [];
      
      const labels = [], data = [];
      for (const code of codes) {
        const match = code.match(/\.(\d+)$/);
        const dataKey = match ? `Pergunta_${match[1]}` : code;

        const scores = filteredData.map(i => {
          const val = i[dataKey];
          const numeric = parseFloat(val);
          if (!isNaN(numeric)) return numeric;
          return ratingToScore ? ratingToScore[val] : null;
        }).filter(v => v !== null && v !== undefined);
        
        if (scores.length) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          labels.push(code);
          data.push(Number(avg.toFixed(2)));
        }
      }
      return labels.length ? { dimensionName: name, chartData: { labels, datasets: [{ label: 'Média', data, backgroundColor: bgColor, borderColor: borderColor, borderWidth: 1 }] } } : null;
    }).filter(Boolean);
}