'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import TecnicoFilters from '../components/TecnicoFilters';
import QuestionChart from '../components/QuestionChart';
import styles from '../../../../styles/dados.module.css';
import { Users, Building } from 'lucide-react';
import { questionMappingTecnico, ratingToScore } from '../lib/questionMappingTecnico';
import { dimensionMappingTecnico } from '../lib/dimensionMappingTecnico';

const DEFAULT_FILTERS = {
  lotacao: 'todos',
  exercicio: 'todos',
  cargo: 'todos',
  pergunta: 'todas',
  dimensao: 'todas',
};

export default function TecnicoPage() {
  const [allData, setAllData] = useState([]);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const [selectedFiltersA, setSelectedFiltersA] = useState(DEFAULT_FILTERS);
  const [selectedFiltersB, setSelectedFiltersB] = useState(DEFAULT_FILTERS);

  /* =====================================================
     Carregamento inicial
  ===================================================== */
  useEffect(() => {
    fetch('/api/tecnico')
      .then((res) => (res.ok ? res.json() : Promise.reject('Falha ao buscar dados')))
      .then((data) => {
        const tecnicoData = data[2]?.data || data;
        setAllData(Array.isArray(tecnicoData) ? tecnicoData : []);
      })
      .catch((error) => console.error('Não foi possível carregar os dados dos técnicos:', error));
  }, []);

  /* =====================================================
     Handle filters (A e B) com resets em cascata
  ===================================================== */
  const handleFilterChangeA = (e) => {
    const { name, value } = e.target;

    if (name === 'lotacao') {
      setSelectedFiltersA((prev) => ({ ...prev, lotacao: value, exercicio: 'todos', cargo: 'todos' }));
      return;
    }
    if (name === 'exercicio') {
      setSelectedFiltersA((prev) => ({ ...prev, exercicio: value, cargo: 'todos' }));
      return;
    }
    if (name === 'dimensao') {
      setSelectedFiltersA((prev) => ({ ...prev, dimensao: value, pergunta: 'todas' }));
      return;
    }
    setSelectedFiltersA((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterChangeB = (e) => {
    const { name, value } = e.target;

    if (name === 'lotacao') {
      setSelectedFiltersB((prev) => ({ ...prev, lotacao: value, exercicio: 'todos', cargo: 'todos' }));
      return;
    }
    if (name === 'exercicio') {
      setSelectedFiltersB((prev) => ({ ...prev, exercicio: value, cargo: 'todos' }));
      return;
    }
    if (name === 'dimensao') {
      setSelectedFiltersB((prev) => ({ ...prev, dimensao: value, pergunta: 'todas' }));
      return;
    }
    setSelectedFiltersB((prev) => ({ ...prev, [name]: value }));
  };

  /* =====================================================
     Aplicação dos filtros (A e B): lotacao/exercicio/cargo
  ===================================================== */
  const filteredDataA = useMemo(() => applyFiltersTecnico(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filteredDataB = useMemo(() => applyFiltersTecnico(allData, selectedFiltersB), [allData, selectedFiltersB]);

  /* =====================================================
     Opções dos filtros em cascata (A e B)
  ===================================================== */
  const filterOptionsA = useMemo(() => buildTecnicoFilterOptions(allData, selectedFiltersA), [allData, selectedFiltersA]);
  const filterOptionsB = useMemo(() => buildTecnicoFilterOptions(allData, selectedFiltersB), [allData, selectedFiltersB]);

  /* =====================================================
     Estatística: top lotação (A e B)
  ===================================================== */
  const topLotacaoA = useMemo(() => calcTopLotacaoTecnico(filteredDataA), [filteredDataA]);
  const topLotacaoB = useMemo(() => calcTopLotacaoTecnico(filteredDataB), [filteredDataB]);

  /* =====================================================
     Gráficos (A e B)
     Regras:
       - pergunta != todas -> 1 gráfico (pergunta)
       - senão, dimensao != todas -> 1 dimensão
       - senão -> todas as dimensões
  ===================================================== */
  const chartsA = useMemo(
    () => buildChartsTecnico(filteredDataA, selectedFiltersA),
    [filteredDataA, selectedFiltersA.pergunta, selectedFiltersA.dimensao]
  );

  const chartsB = useMemo(
    () => buildChartsTecnico(filteredDataB, selectedFiltersB, true),
    [filteredDataB, selectedFiltersB.pergunta, selectedFiltersB.dimensao]
  );

  // Map por nome (pareamento robusto no modo comparação)
  const chartsBByName = useMemo(() => {
    const m = new Map();
    for (const c of chartsB) m.set(c.dimensionName, c);
    return m;
  }, [chartsB]);

  return (
    <div className={styles.container}>
      <Header
        title="Análise de Respostas dos Técnicos"
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
            if (checked) setSelectedFiltersB(selectedFiltersA);
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

      {/* Charts */}
      <div className={styles.chartsMainContainer}>
        {compareEnabled ? (
          // COMPARAÇÃO: A/B por bloco (pareado por dimensionName)
          chartsA.map(({ dimensionName, chartData }) => {
            const chartB = chartsBByName.get(dimensionName);
            return (
              <section key={`dim-section-${dimensionName}`} className={styles.dimensionWrapper}>
                <div className={styles.equalGrid}>
                  <div className={styles.chartContainerCard}>
                    <QuestionChart
                      chartData={chartData}
                      title={`${dimensionName} (A)`}
                      questionMap={questionMappingTecnico}
                    />
                  </div>

                  <div className={styles.chartContainerCard}>
                    <QuestionChart
                      chartData={chartB?.chartData || emptyChartLike(chartData)}
                      title={`${dimensionName} (B)`}
                      questionMap={questionMappingTecnico}
                    />
                  </div>
                </div>
              </section>
            );
          })
        ) : (
          // SEM COMPARAÇÃO: grid único 2 por linha
          <div className={styles.singleGrid}>
            {chartsA.map(({ dimensionName, chartData }) => (
              <div key={`dim-card-${dimensionName}`} className={styles.chartContainerCard}>
                <QuestionChart
                  chartData={chartData}
                  title={String(dimensionName)}
                  questionMap={questionMappingTecnico}
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

function applyFiltersTecnico(allData, selectedFilters) {
  if (!Array.isArray(allData)) return [];
  let data = allData;

  if (selectedFilters.lotacao !== 'todos') {
    data = data.filter((d) => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao);
  }
  if (selectedFilters.exercicio !== 'todos') {
    data = data.filter((d) => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio);
  }
  if (selectedFilters.cargo !== 'todos') {
    data = data.filter((d) => d.CARGO_TECNICO === selectedFilters.cargo);
  }

  return data;
}

function buildTecnicoFilterOptions(allData, selectedFilters) {
  if (!Array.isArray(allData) || !allData.length) return { lotacoes: [], exercicios: [], cargos: [] };

  let lotacaoData = allData;
  let exercicioData = allData;
  let cargoData = allData;

  if (selectedFilters.lotacao !== 'todos') {
    exercicioData = exercicioData.filter((d) => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao);
    cargoData = cargoData.filter((d) => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao);
  }

  if (selectedFilters.exercicio !== 'todos') {
    lotacaoData = lotacaoData.filter((d) => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio);
    cargoData = cargoData.filter((d) => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio);
  }

  if (selectedFilters.cargo !== 'todos') {
    lotacaoData = lotacaoData.filter((d) => d.CARGO_TECNICO === selectedFilters.cargo);
    exercicioData = exercicioData.filter((d) => d.CARGO_TECNICO === selectedFilters.cargo);
  }

  const uniqSort = (data, key) => [...new Set(data.map((d) => d[key]))].filter(Boolean).sort();

  return {
    lotacoes: uniqSort(lotacaoData, 'UND_LOTACAO_TECNICO'),
    exercicios: uniqSort(exercicioData, 'UND_EXERCICIO_TECNICO'),
    cargos: uniqSort(cargoData, 'CARGO_TECNICO'),
  };
}

function calcTopLotacaoTecnico(filteredData) {
  if (!filteredData?.length) return 'N/A';

  const counts = new Map();
  for (const row of filteredData) {
    const lotacao = row.UND_LOTACAO_TECNICO || 'N/A';
    counts.set(lotacao, (counts.get(lotacao) || 0) + 1);
  }

  const top = [...counts.entries()].sort(
    (a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), 'pt-BR')
  )[0];

  return `${top[0]} — ${top[1].toLocaleString('pt-BR')}`;
}

function buildChartsTecnico(filteredData, selectedFilters, isB = false) {
  if (!questionMappingTecnico || !dimensionMappingTecnico) return [];

  // Caso 1: pergunta específica
  if (selectedFilters.pergunta !== 'todas') {
    const key = selectedFilters.pergunta;

    const scores = (filteredData || [])
      .map((item) => ratingToScore[item[key]])
      .filter((v) => v !== null && v !== undefined);

    const avg = scores.length
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : 0;

    return [
      {
        dimensionName: `Pergunta ${key}`,
        chartData: {
          labels: [key],
          datasets: [
            {
              label: 'Média de Respostas',
              data: [avg],
              backgroundColor: isB ? 'rgba(54, 162, 235, 0.8)' : 'rgba(255, 142, 41, 0.8)',
              borderColor: isB ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 142, 41, 1)',
              borderWidth: 1,
            },
          ],
        },
      },
    ];
  }

  const entries =
    selectedFilters.dimensao !== 'todas'
      ? [[selectedFilters.dimensao, dimensionMappingTecnico[selectedFilters.dimensao] || []]]
      : Object.entries(dimensionMappingTecnico);

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

// Gera um “chart vazio” compatível (quando B não tem aquela dimensão)
function emptyChartLike(referenceChartData) {
  return {
    labels: referenceChartData?.labels || [],
    datasets: [
      {
        label: 'Média de Respostas',
        data: (referenceChartData?.labels || []).map(() => 0),
        backgroundColor: 'rgba(54, 162, 235, 0.15)',
        borderColor: 'rgba(54, 162, 235, 0.35)',
        borderWidth: 1,
      },
    ],
  };
}
