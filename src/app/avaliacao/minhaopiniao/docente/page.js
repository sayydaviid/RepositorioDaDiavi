'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import DocenteFilters from '../components/DocenteFilters';
import QuestionChart from '../components/QuestionChart';
import styles from '../../../../styles/dados.module.css';
import { Users, Building } from 'lucide-react';
import { questionMappingDocente, ratingToScore } from '../lib/questionMappingDocente';
import { dimensionMapping as dimensionMappingDocente } from '../lib/DimensionMappingDocente';

const DEFAULT_FILTERS = {
  lotacao: 'todos',
  cargo: 'todos',
  pergunta: 'todas',
  dimensao: 'todas',
};

export default function DocentePage() {
  const [allData, setAllData] = useState([]);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [selectedFiltersA, setSelectedFiltersA] = useState(DEFAULT_FILTERS);
  const [selectedFiltersB, setSelectedFiltersB] = useState(DEFAULT_FILTERS);

  /* =====================================================
     Carregamento inicial
  ===================================================== */
  useEffect(() => {
    fetch('/api/docente')
      .then((res) => (res.ok ? res.json() : Promise.reject('Falha ao buscar dados')))
      .then((data) => {
        const teacherData = data[2]?.data || data;
        setAllData(Array.isArray(teacherData) ? teacherData : []);
      })
      .catch((error) => console.error('Não foi possível carregar os dados dos docentes:', error));
  }, []);

  /* =====================================================
     Aplicação de filtros (A e B)
  ===================================================== */
  const filteredDataA = useMemo(() => applyFiltersDocente(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filteredDataB = useMemo(() => applyFiltersDocente(allData, selectedFiltersB), [allData, selectedFiltersB]);

  /* =====================================================
     Opções de filtros em cascata (A e B)
  ===================================================== */
  const filterOptionsA = useMemo(
    () => buildDocenteFilterOptions(allData, selectedFiltersA),
    [allData, selectedFiltersA.lotacao, selectedFiltersA.cargo]
  );

  const filterOptionsB = useMemo(
    () => buildDocenteFilterOptions(allData, selectedFiltersB),
    [allData, selectedFiltersB.lotacao, selectedFiltersB.cargo]
  );

  /* =====================================================
     Estatística: top lotação (A e B)
  ===================================================== */
  const topLotacaoA = useMemo(() => calcTopLotacao(filteredDataA), [filteredDataA]);
  const topLotacaoB = useMemo(() => calcTopLotacao(filteredDataB), [filteredDataB]);

  /* =====================================================
     Handle filters (A e B)
  ===================================================== */
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

  /* =====================================================
     GRÁFICOS POR DIMENSÃO (A e B)
     Regra:
       - Se selectedFiltersX.dimensao !== 'todas', mostra só aquela dimensão
       - Caso contrário, mostra todas
  ===================================================== */
  const chartsByDimensionA = useMemo(
    () => buildChartsByDimensionDocente(filteredDataA, selectedFiltersA.dimensao),
    [filteredDataA, selectedFiltersA.dimensao]
  );

  const chartsByDimensionB = useMemo(
    () => buildChartsByDimensionDocente(filteredDataB, selectedFiltersB.dimensao, true),
    [filteredDataB, selectedFiltersB.dimensao]
  );

  return (
    <div className={styles.container}>
      <Header
        title="Análise de Respostas dos Docentes"
        subtitle="Dados referentes ao questionário de autoavaliação"
      />

      {/* Stats */}
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

      {/* Filters */}
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
            if (checked) setSelectedFiltersB(selectedFiltersA);
          }}
        />

        {compareEnabled && (
          <DocenteFilters
            title="Filtros (B)"
            filters={filterOptionsB}
            selectedFilters={selectedFiltersB}
            onFilterChange={handleFilterChangeB}
            questionMap={questionMappingDocente}
            dimensionMap={dimensionMappingDocente}
          />
        )}
      </div>

      {/* Charts */}
      <div className={styles.chartsMainContainer}>
        {compareEnabled ? (
          // COMPARAÇÃO: par A/B por dimensão (igual Discente)
          chartsByDimensionA.map(({ dimensionName, chartData }, index) => (
            <section key={`dim-section-${dimensionName}`} className={styles.dimensionWrapper}>
              <div className={styles.equalGrid}>
                <div className={styles.chartContainerCard}>
                  <QuestionChart
                    chartData={chartData}
                    title={`${dimensionName} (A)`}
                    questionMap={questionMappingDocente}
                  />
                </div>

                {chartsByDimensionB[index] && (
                  <div className={styles.chartContainerCard}>
                    <QuestionChart
                      chartData={chartsByDimensionB[index].chartData}
                      title={`${dimensionName} (B)`}
                      questionMap={questionMappingDocente}
                    />
                  </div>
                )}
              </div>
            </section>
          ))
        ) : (
          // SEM COMPARAÇÃO: grid único 2 por linha
          <div className={styles.singleGrid}>
            {chartsByDimensionA.map(({ dimensionName, chartData }) => (
              <div key={`dim-card-${dimensionName}`} className={styles.chartContainerCard}>
                <QuestionChart
                  chartData={chartData}
                  title={dimensionName}
                  questionMap={questionMappingDocente}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   Helpers
===================================================== */

function applyFiltersDocente(allData, selectedFilters) {
  if (!Array.isArray(allData)) return [];
  let data = allData;

  if (selectedFilters.lotacao !== 'todos') {
    data = data.filter((d) => d.UND_LOTACAO_DOCENTE === selectedFilters.lotacao);
  }
  if (selectedFilters.cargo !== 'todos') {
    data = data.filter((d) => d.CARGO_DOCENTE === selectedFilters.cargo);
  }

  // OBS: não filtramos por "pergunta" aqui; ela serve para o QuestionChart (se ele suportar)
  // e para limitar as opções do select.
  return data;
}

function buildDocenteFilterOptions(allData, selectedFilters) {
  if (!Array.isArray(allData) || !allData.length) return { lotacoes: [], cargos: [] };

  let lotacaoData = allData;
  let cargoData = allData;

  if (selectedFilters.lotacao !== 'todos') {
    cargoData = cargoData.filter((d) => d.UND_LOTACAO_DOCENTE === selectedFilters.lotacao);
  }
  if (selectedFilters.cargo !== 'todos') {
    lotacaoData = lotacaoData.filter((d) => d.CARGO_DOCENTE === selectedFilters.cargo);
  }

  const lotacoesRaw = [...new Set(lotacaoData.map((d) => d.UND_LOTACAO_DOCENTE))].filter(Boolean);
  const lotacaoIndefinida = 'NÃO INFORMADO';
  const lotacoesSorted = lotacoesRaw.filter((l) => l !== lotacaoIndefinida).sort();
  if (lotacoesRaw.includes(lotacaoIndefinida)) lotacoesSorted.push(lotacaoIndefinida);

  const cargosFiltered = [...new Set(cargoData.map((d) => d.CARGO_DOCENTE))]
    .filter(Boolean)
    .filter((c) => c !== 'CARGO INDEFINIDO' && c !== 'MEDICO-AREA')
    .sort();

  return { lotacoes: lotacoesSorted, cargos: cargosFiltered };
}

function calcTopLotacao(filteredData) {
  if (!filteredData?.length) return 'N/A';

  const counts = new Map();
  for (const row of filteredData) {
    const lotacao = row.UND_LOTACAO_DOCENTE || 'NÃO INFORMADO';
    counts.set(lotacao, (counts.get(lotacao) || 0) + 1);
  }

  const top = [...counts.entries()].sort(
    (a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), 'pt-BR')
  )[0];

  return `${top[0]} — ${top[1].toLocaleString('pt-BR')}`;
}

function buildChartsByDimensionDocente(filteredData, selectedDim = 'todas', isB = false) {
  if (!dimensionMappingDocente) return [];

  const entries =
    selectedDim !== 'todas'
      ? [[selectedDim, dimensionMappingDocente[selectedDim] || []]]
      : Object.entries(dimensionMappingDocente);

  // Mantém a mesma ordem de Object.entries para A e B (assumindo mesmo mapping)
  return entries
    .map(([dimensionName, questionKeys]) => {
      const dataPoints = (questionKeys || []).map((key) => {
        const scores = (filteredData || [])
          .map((item) => ratingToScore[item[key]])
          .filter((v) => v !== null && v !== undefined);

        if (!scores.length) return 0;

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return Number(avg.toFixed(2));
      });

      return {
        dimensionName,
        chartData: {
          labels: questionKeys,
          datasets: [
            {
              label: 'Média de Respostas',
              data: dataPoints,
              backgroundColor: isB ? 'rgba(54, 162, 235, 0.8)' : 'rgba(255, 142, 41, 0.8)',
              borderColor: isB ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 142, 41, 1)',
              borderWidth: 1,
            },
          ],
        },
      };
    })
    .filter((d) => d.chartData.labels && d.chartData.labels.length > 0);
}
