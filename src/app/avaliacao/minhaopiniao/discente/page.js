'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Building2 } from 'lucide-react';

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

export default function DiscentePage() {
  const [allData, setAllData] = useState([]);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [selectedFiltersA, setSelectedFiltersA] = useState(DEFAULT_FILTERS);
  const [selectedFiltersB, setSelectedFiltersB] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    fetch('/api/discente')
      .then((res) => res.json())
      .then((data) => {
        const studentData = data[2]?.data || data;
        setAllData(studentData || []);
      })
      .catch((err) => console.error('Erro ao carregar dados:', err));
  }, []);

  const filteredDataA = useMemo(() => applyFilters(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filteredDataB = useMemo(() => applyFilters(allData, selectedFiltersB), [allData, selectedFiltersB]);

  const filterOptionsA = useMemo(() => buildFilterOptions(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filterOptionsB = useMemo(() => buildFilterOptions(allData, selectedFiltersB), [allData, selectedFiltersB]);

  const topUnitA = useMemo(() => calcTopUnit(filteredDataA), [filteredDataA]);
  const topUnitB = useMemo(() => calcTopUnit(filteredDataB), [filteredDataB]);

  // Cores: A (Laranja) e B (Azul)
  const chartsByDimensionA = useMemo(
    () => buildChartsByDimension(filteredDataA, 'rgba(255, 142, 41, 0.8)', 'rgba(255, 142, 41, 1)'),
    [filteredDataA]
  );

  const chartsByDimensionB = useMemo(
    () => buildChartsByDimension(filteredDataB, 'rgba(54, 162, 235, 0.8)', 'rgba(54, 162, 235, 1)'),
    [filteredDataB]
  );

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
      <Header
        title="Análise de Respostas dos Discentes"
        subtitle="Dados referentes ao questionário 'Minha Opinião'"
      />

      {/* Stats Section */}
      <div className={`${styles.statsGrid} ${compareEnabled ? styles.statsGridCompare : ''}`}>
        <StatCard
          title={compareEnabled ? 'Total Participantes (A)' : 'Total de Participantes'}
          value={filteredDataA.length.toLocaleString('pt-BR')}
          icon={<Users />}
        />
        <StatCard
          title={compareEnabled ? 'Top Unidade (A)' : 'Unidade com mais participantes'}
          value={`${topUnitA.name} — ${topUnitA.count.toLocaleString('pt-BR')}`}
          icon={<Building2 />}
        />
        {compareEnabled && (
          <>
            <StatCard
              title="Total Participantes (B)"
              value={filteredDataB.length.toLocaleString('pt-BR')}
              icon={<Users />}
            />
            <StatCard
              title="Top Unidade (B)"
              value={`${topUnitB.name} — ${topUnitB.count.toLocaleString('pt-BR')}`}
              icon={<Building2 />}
            />
          </>
        )}
      </div>

      {/* Filters Section */}
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
            if (checked) setSelectedFiltersB(selectedFiltersA);
          }}
        />

        {compareEnabled && (
          <DiscenteFilters
            title="Filtros (B)"
            filters={filterOptionsB}
            selectedFilters={selectedFiltersB}
            onFilterChange={handleFilterChangeB}
            questionMap={questionMapping}
            dimensionMap={dimensionMapping}
          />
        )}
      </div>
{/* Main Charts Section */}
<div className={styles.chartsMainContainer}>
  {compareEnabled ? (
    // COMPARAÇÃO: mantém par A/B por dimensão
    chartsByDimensionA.map(({ dimensionName, chartData }, index) => (
      <section key={`dim-section-${dimensionName}`} className={styles.dimensionWrapper}>
        <div className={styles.equalGrid}>
          <div className={styles.chartContainerCard}>
            <QuestionChart
              chartData={chartData}
              title={`${dimensionName} (A)`}
              questionMap={questionMapping}
            />
          </div>

          {chartsByDimensionB[index] && (
            <div className={styles.chartContainerCard}>
              <QuestionChart
                chartData={chartsByDimensionB[index].chartData}
                title={`${dimensionName} (B)`}
                questionMap={questionMapping}
              />
            </div>
          )}
        </div>
      </section>
    ))
  ) : (
    // SEM COMPARAÇÃO: UM GRID com todos os gráficos (2 por linha)
    <div className={styles.singleGrid}>
      {chartsByDimensionA.map(({ dimensionName, chartData }) => (
        <div key={`dim-card-${dimensionName}`} className={styles.chartContainerCard}>
          <QuestionChart
            chartData={chartData}
            title={dimensionName}
            questionMap={questionMapping}
          />
        </div>
      ))}
    </div>
  )}
</div>
    </div>
  );
}

/* --- Funções de Apoio (Mantidas) --- */
function applyFilters(allData, selectedFilters) {
  if (!Array.isArray(allData)) return [];
  return allData.filter((d) => {
    const matchCampus = selectedFilters.campus === 'todos' || d.CAMPUS_DISCENTE === selectedFilters.campus;
    const matchUnidade = selectedFilters.unidade === 'todos' || d.UNIDADE_DISCENTE === selectedFilters.unidade;
    const matchCurso = selectedFilters.curso === 'todos' || d.CURSO_DISCENTE === selectedFilters.curso;
    return matchCampus && matchUnidade && matchCurso;
  });
}

function buildFilterOptions(allData) {
  if (!Array.isArray(allData) || !allData.length) return { campus: [], unidades: [], cursos: [] };
  const uniq = (data, key) => [...new Set(data.map((d) => d[key]))].filter(Boolean).sort();
  return {
    campus: uniq(allData, 'CAMPUS_DISCENTE'),
    unidades: uniq(allData, 'UNIDADE_DISCENTE'),
    cursos: uniq(allData, 'CURSO_DISCENTE'),
  };
}

function calcTopUnit(filteredData) {
  if (!filteredData?.length) return { name: '-', count: 0 };
  const counts = filteredData.reduce((acc, row) => {
    const name = row.UNIDADE_DISCENTE || 'N/I';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { name: top[0], count: top[1] };
}

function buildChartsByDimension(filteredData, bgColor, borderColor) {
  if (!dimensionMapping) return [];
  return Object.entries(dimensionMapping).map(([dimensionName, questionKeys]) => {
    const dataPoints = questionKeys.map((key) => {
      const scores = (filteredData || [])
        .map((item) => ratingToScore[item[key]])
        .filter((v) => v !== null && v !== undefined);
      if (!scores.length) return 0;
      return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
    });

    return {
      dimensionName,
      chartData: {
        labels: questionKeys,
        datasets: [
          {
            label: 'Média',
            data: dataPoints,
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: 1,
          },
        ],
      },
    };
  });
}
