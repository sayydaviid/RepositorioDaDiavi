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

  useEffect(() => {
    fetch('/api/docente')
      .then((res) => (res.ok ? res.json() : Promise.reject('Falha ao buscar dados')))
      .then((data) => {
        const teacherData = data[2]?.data || data;
        setAllData(Array.isArray(teacherData) ? teacherData : []);
      })
      .catch((error) =>
        console.error('Não foi possível carregar os dados dos docentes:', error)
      );
  }, []);

  // Filtragem base (lotacao/cargo)
  const filteredDataA = useMemo(
    () => applyFiltersDocente(allData, selectedFiltersA),
    [allData, selectedFiltersA]
  );
  const filteredDataB = useMemo(
    () => applyFiltersDocente(allData, selectedFiltersB),
    [allData, selectedFiltersB]
  );

  // Opções em cascata
  const filterOptionsA = useMemo(
    () => buildDocenteFilterOptions(allData, selectedFiltersA),
    [allData, selectedFiltersA.lotacao, selectedFiltersA.cargo]
  );
  const filterOptionsB = useMemo(
    () => buildDocenteFilterOptions(allData, selectedFiltersB),
    [allData, selectedFiltersB.lotacao, selectedFiltersB.cargo]
  );

  const topLotacaoA = useMemo(() => calcTopLotacao(filteredDataA), [filteredDataA]);
  const topLotacaoB = useMemo(() => calcTopLotacao(filteredDataB), [filteredDataB]);

  // Handle filters
  const handleFilterChangeA = (e) => {
    const { name, value } = e.target;

    // Mantém coerência Dimensão -> Pergunta
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

  // Gráficos (agora respeitam dimensão + pergunta)
  const chartsByDimensionA = useMemo(
    () => buildChartsByDimensionDocente(filteredDataA, selectedFiltersA, false),
    [filteredDataA, selectedFiltersA]
  );

  const chartsByDimensionB = useMemo(
    () => buildChartsByDimensionDocente(filteredDataB, selectedFiltersB, true),
    [filteredDataB, selectedFiltersB]
  );

  // Mapa p/ parear dimensões por nome (robusto)
  const bMap = useMemo(
    () => new Map((chartsByDimensionB || []).map((c) => [c.dimensionName, c])),
    [chartsByDimensionB]
  );

  // Mesmo “atalho” do Discente: se A e B têm 1 gráfico cada, renderiza lado a lado
  const specialPairSideBySide =
    compareEnabled &&
    chartsByDimensionA.length === 1 &&
    chartsByDimensionB.length === 1;

  return (
    <div className={styles.container}>
      <Header
        title="Análise de Respostas dos Docentes"
        subtitle="Dados referentes ao questionário de autoavaliação"
      />

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
            if (checked) {
              // IMPORTANTE: clonar, não compartilhar referência
              setSelectedFiltersB({ ...selectedFiltersA });
            }
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

      <div className={styles.chartsMainContainer}>
        {compareEnabled ? (
          specialPairSideBySide ? (
            <section className={styles.dimensionWrapper}>
              <div className={styles.equalGrid}>
                <div className={styles.chartContainerCard}>
                  <QuestionChart
                    chartData={chartsByDimensionA[0].chartData}
                    title={`${chartsByDimensionA[0].dimensionName} (A)`}
                    questionMap={questionMappingDocente}
                  />
                </div>

                <div className={styles.chartContainerCard}>
                  <QuestionChart
                    chartData={chartsByDimensionB[0].chartData}
                    title={`${chartsByDimensionB[0].dimensionName} (B)`}
                    questionMap={questionMappingDocente}
                  />
                </div>
              </div>
            </section>
          ) : (
            // Pareia por dimensionName (não por index)
            chartsByDimensionA.map(({ dimensionName, chartData }) => {
              const b = bMap.get(dimensionName);

              // Se B não tem essa dimensão, ainda renderiza A em largura total
              return (
                <section key={`dim-section-${dimensionName}`} className={styles.dimensionWrapper}>
                  <div className={styles.equalGrid}>
                    <div
                      className={styles.chartContainerCard}
                      style={!b ? { gridColumn: '1 / -1' } : undefined}
                    >
                      <QuestionChart
                        chartData={chartData}
                        title={`${dimensionName} (A)`}
                        questionMap={questionMappingDocente}
                      />
                    </div>

                    {b && (
                      <div className={styles.chartContainerCard}>
                        <QuestionChart
                          chartData={b.chartData}
                          title={`${dimensionName} (B)`}
                          questionMap={questionMappingDocente}
                        />
                      </div>
                    )}
                  </div>
                </section>
              );
            })
          )
        ) : (
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

/**
 * Agora respeita:
 * - selectedFilters.dimensao
 * - selectedFilters.pergunta
 * E remove perguntas sem dados (pra não ficar “0” que mascara diferença)
 */
function buildChartsByDimensionDocente(filteredData, selectedFilters, isB = false) {
  if (!dimensionMappingDocente) return [];

  const selectedDim = selectedFilters?.dimensao || 'todas';
  const selectedQuestion = selectedFilters?.pergunta || 'todas';

  const entries =
    selectedDim !== 'todas'
      ? [[selectedDim, dimensionMappingDocente[selectedDim] || []]]
      : Object.entries(dimensionMappingDocente);

  return entries
    .map(([dimensionName, questionKeys]) => {
      let keys = Array.isArray(questionKeys) ? [...questionKeys] : [];

      // Se selecionou pergunta, reduz para ela (desde que pertença à dimensão)
      if (selectedQuestion && selectedQuestion !== 'todas') {
        keys = keys.includes(selectedQuestion) ? [selectedQuestion] : [];
      }

      if (!keys.length) return null;

      const labels = [];
      const dataPoints = [];

      for (const key of keys) {
        const scores = (filteredData || [])
          .map((item) => ratingToScore[item[key]])
          .filter((v) => v !== null && v !== undefined);

        if (!scores.length) continue; 

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        labels.push(key);
        dataPoints.push(Number(avg.toFixed(2)));
      }

      if (!labels.length) return null; 

      return {
        dimensionName,
        chartData: {
          labels,
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
    .filter(Boolean);
}
