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

  // Dados filtrados (somente campus/unidade/curso)
  const filteredDataA = useMemo(
    () => applyFilters(allData, selectedFiltersA),
    [allData, selectedFiltersA]
  );
  const filteredDataB = useMemo(
    () => applyFilters(allData, selectedFiltersB),
    [allData, selectedFiltersB]
  );

  // Opções dependentes (NUNCA deixam o usuário escolher algo que vira 0)
  const filterOptionsA = useMemo(
    () => buildFilterOptions(allData, selectedFiltersA),
    [allData, selectedFiltersA]
  );
  const filterOptionsB = useMemo(
    () => buildFilterOptions(allData, selectedFiltersB),
    [allData, selectedFiltersB]
  );

  const topUnitA = useMemo(() => calcTopUnit(filteredDataA), [filteredDataA]);
  const topUnitB = useMemo(() => calcTopUnit(filteredDataB), [filteredDataB]);

  // Gráficos (já respeitando dimensão/pergunta selecionadas e removendo vazios)
  const chartsByDimensionA = useMemo(
    () =>
      buildChartsByDimension(
        filteredDataA,
        'rgba(255, 142, 41, 0.8)',
        'rgba(255, 142, 41, 1)',
        selectedFiltersA
      ),
    [filteredDataA, selectedFiltersA]
  );

  const chartsByDimensionB = useMemo(
    () =>
      buildChartsByDimension(
        filteredDataB,
        'rgba(54, 162, 235, 0.8)',
        'rgba(54, 162, 235, 1)',
        selectedFiltersB
      ),
    [filteredDataB, selectedFiltersB]
  );

  const handleFilterChangeA = (e) => {
    const { name, value } = e.target;
    setSelectedFiltersA((prev) => sanitizeFilters(allData, { ...prev, [name]: value }));
  };

  const handleFilterChangeB = (e) => {
    const { name, value } = e.target;
    setSelectedFiltersB((prev) => sanitizeFilters(allData, { ...prev, [name]: value }));
  };

  /**
   * CORREÇÃO:
   * Se A e B tiverem exatamente 1 gráfico cada, sempre renderiza lado a lado.
   * Isso evita o caso em que A escolhe uma dimensão e B escolhe outra e os gráficos
   * ficam um embaixo do outro por causa do CompareDimensions (que “une dimensões”).
   */
  const specialPairSideBySide =
    compareEnabled &&
    chartsByDimensionA.length === 1 &&
    chartsByDimensionB.length === 1;

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
            if (checked) setSelectedFiltersB(sanitizeFilters(allData, { ...selectedFiltersA }));
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
          specialPairSideBySide ? (
            // Agora: sempre lado a lado quando A e B têm 1 gráfico cada
            <section className={styles.dimensionWrapper}>
              <div className={styles.equalGrid}>
                <div className={styles.chartContainerCard}>
                  <QuestionChart
                    chartData={chartsByDimensionA[0].chartData}
                    title={`${chartsByDimensionA[0].dimensionName} (A)`}
                    questionMap={questionMapping}
                  />
                </div>

                <div className={styles.chartContainerCard}>
                  <QuestionChart
                    chartData={chartsByDimensionB[0].chartData}
                    title={`${chartsByDimensionB[0].dimensionName} (B)`}
                    questionMap={questionMapping}
                  />
                </div>
              </div>
            </section>
          ) : (
            // Comparação normal: une dimensões (sem renderizar “vazios”)
            <CompareDimensions
              chartsA={chartsByDimensionA}
              chartsB={chartsByDimensionB}
              questionMap={questionMapping}
              styles={styles}
            />
          )
        ) : (
          // Sem comparação: grid normal (já filtrado por dimensão/pergunta)
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

        {/* Opcional: estado vazio */}
        {!compareEnabled && chartsByDimensionA.length === 0 && (
          <div style={{ padding: 16, opacity: 0.75 }}>
            Nenhum dado encontrado para os filtros selecionados.
          </div>
        )}
        {compareEnabled && chartsByDimensionA.length === 0 && chartsByDimensionB.length === 0 && (
          <div style={{ padding: 16, opacity: 0.75 }}>
            Nenhum dado encontrado para os filtros selecionados.
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Render de comparação
========================= */
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
              {a && (
                <div
                  className={styles.chartContainerCard}
                  style={!b ? { gridColumn: '1 / -1' } : undefined}
                >
                  <QuestionChart
                    chartData={a.chartData}
                    title={`${dimensionName} (A)`}
                    questionMap={questionMap}
                  />
                </div>
              )}

              {b && (
                <div
                  className={styles.chartContainerCard}
                  style={!a ? { gridColumn: '1 / -1' } : undefined}
                >
                  <QuestionChart
                    chartData={b.chartData}
                    title={`${dimensionName} (B)`}
                    questionMap={questionMap}
                  />
                </div>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* =========================
   Funções de apoio
========================= */
function norm(v) {
  return String(v ?? '').trim();
}

function rowMatch(rowValue, selectedValue) {
  return selectedValue === 'todos' || norm(rowValue) === norm(selectedValue);
}

function applyFilters(allData, selectedFilters) {
  if (!Array.isArray(allData)) return [];
  const f = selectedFilters || {};
  return allData.filter((d) => {
    const okCampus = rowMatch(d.CAMPUS_DISCENTE, f.campus);
    const okUnidade = rowMatch(d.UNIDADE_DISCENTE, f.unidade);
    const okCurso = rowMatch(d.CURSO_DISCENTE, f.curso);
    return okCampus && okUnidade && okCurso;
  });
}

function buildFilterOptions(allData, selectedFilters) {
  if (!Array.isArray(allData) || !allData.length) {
    return { campus: [], unidades: [], cursos: [] };
  }

  const f = selectedFilters || { campus: 'todos', unidade: 'todos', curso: 'todos' };

  function keepRowForOptions(row, ignoreKey) {
    const campusOk = ignoreKey === 'CAMPUS_DISCENTE' ? true : rowMatch(row.CAMPUS_DISCENTE, f.campus);
    const unidadeOk = ignoreKey === 'UNIDADE_DISCENTE' ? true : rowMatch(row.UNIDADE_DISCENTE, f.unidade);
    const cursoOk = ignoreKey === 'CURSO_DISCENTE' ? true : rowMatch(row.CURSO_DISCENTE, f.curso);
    return campusOk && unidadeOk && cursoOk;
  }

  function uniqFrom(key, ignoreKey) {
    const set = new Set();
    for (const row of allData) {
      if (!keepRowForOptions(row, ignoreKey)) continue;
      const val = norm(row[key]);
      if (val) set.add(val);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  return {
    campus: uniqFrom('CAMPUS_DISCENTE', 'CAMPUS_DISCENTE'),
    unidades: uniqFrom('UNIDADE_DISCENTE', 'UNIDADE_DISCENTE'),
    cursos: uniqFrom('CURSO_DISCENTE', 'CURSO_DISCENTE'),
  };
}

function sanitizeFilters(allData, filters) {
  let next = { ...filters };

  for (let i = 0; i < 4; i++) {
    const opts = buildFilterOptions(allData, next);
    let changed = false;

    if (next.campus !== 'todos' && !opts.campus.includes(norm(next.campus))) {
      next.campus = 'todos';
      changed = true;
    }
    if (next.unidade !== 'todos' && !opts.unidades.includes(norm(next.unidade))) {
      next.unidade = 'todos';
      changed = true;
    }
    if (next.curso !== 'todos' && !opts.cursos.includes(norm(next.curso))) {
      next.curso = 'todos';
      changed = true;
    }

    if (!changed) break;
  }

  return next;
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

function buildChartsByDimension(filteredData, bgColor, borderColor, selectedFilters) {
  if (!dimensionMapping) return [];

  const selectedDim = selectedFilters?.dimensao || 'todas';
  const selectedQuestion = selectedFilters?.pergunta || 'todas';

  const dims = Object.entries(dimensionMapping).filter(([dimensionName]) => {
    if (!selectedDim || selectedDim === 'todas') return true;
    return dimensionName === selectedDim;
  });

  const charts = dims
    .map(([dimensionName, questionKeys]) => {
      let keys = Array.isArray(questionKeys) ? [...questionKeys] : [];

      if (selectedQuestion && selectedQuestion !== 'todas') {
        keys = keys.includes(selectedQuestion) ? [selectedQuestion] : [];
      }

      if (!keys.length) return null;

      const labels = [];
      const data = [];

      for (const key of keys) {
        const scores = (filteredData || [])
          .map((item) => ratingToScore[item[key]])
          .filter((v) => v !== null && v !== undefined);

        if (!scores.length) continue;

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        labels.push(key);
        data.push(Number(avg.toFixed(2)));
      }

      if (!labels.length) return null;

      return {
        dimensionName,
        chartData: {
          labels,
          datasets: [
            {
              label: 'Média',
              data,
              backgroundColor: bgColor,
              borderColor: borderColor,
              borderWidth: 1,
            },
          ],
        },
      };
    })
    .filter(Boolean);

  return charts;
}
