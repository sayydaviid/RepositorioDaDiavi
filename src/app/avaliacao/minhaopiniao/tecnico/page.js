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

export default function TecnicoPage() {
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({
    lotacao: 'todos',
    exercicio: 'todos',
    cargo: 'todos',
    pergunta: 'todas',
    dimensao: 'todas',
  });

  /* =====================================================
     Carregamento inicial
  ===================================================== */
  useEffect(() => {
    fetch('/api/tecnico')
      .then(res => (res.ok ? res.json() : Promise.reject('Falha ao buscar dados')))
      .then(data => {
        const tecnicoData = data[2]?.data || data;
        setAllData(tecnicoData);
        setFilteredData(tecnicoData);
      })
      .catch(error =>
        console.error('Não foi possível carregar os dados dos técnicos:', error)
      );
  }, []);

  /* =====================================================
     Aplicação dos filtros (lotacao/exercicio/cargo)
     OBS: não filtramos por dimensão aqui, porque agora exibimos por dimensão em grid.
     A seleção de dimensão será aplicada na construção dos gráficos (chartsByDimension).
  ===================================================== */
  useEffect(() => {
    let data = [...allData];

    if (selectedFilters.lotacao !== 'todos') {
      data = data.filter(d => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao);
    }
    if (selectedFilters.exercicio !== 'todos') {
      data = data.filter(d => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio);
    }
    if (selectedFilters.cargo !== 'todos') {
      data = data.filter(d => d.CARGO_TECNICO === selectedFilters.cargo);
    }

    setFilteredData(data);
  }, [
    allData,
    selectedFilters.lotacao,
    selectedFilters.exercicio,
    selectedFilters.cargo,
  ]);

  /* =====================================================
     Handle filters (cascata + resets dependentes)
  ===================================================== */
  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    if (name === 'lotacao') {
      setSelectedFilters(prev => ({
        ...prev,
        lotacao: value,
        exercicio: 'todos',
        cargo: 'todos',
      }));
    } else if (name === 'exercicio') {
      setSelectedFilters(prev => ({
        ...prev,
        exercicio: value,
        cargo: 'todos',
      }));
    } else if (name === 'dimensao') {
      setSelectedFilters(prev => ({
        ...prev,
        dimensao: value,
        pergunta: 'todas',
      }));
    } else {
      setSelectedFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  /* =====================================================
     Opções dos filtros em cascata
  ===================================================== */
  const filterOptions = useMemo(() => {
    if (!allData.length) return { lotacoes: [], exercicios: [], cargos: [] };

    let lotacaoData = allData;
    let exercicioData = allData;
    let cargoData = allData;

    if (selectedFilters.lotacao !== 'todos') {
      exercicioData = exercicioData.filter(d => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao);
      cargoData = cargoData.filter(d => d.UND_LOTACAO_TECNICO === selectedFilters.lotacao);
    }

    if (selectedFilters.exercicio !== 'todos') {
      lotacaoData = lotacaoData.filter(d => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio);
      cargoData = cargoData.filter(d => d.UND_EXERCICIO_TECNICO === selectedFilters.exercicio);
    }

    if (selectedFilters.cargo !== 'todos') {
      lotacaoData = lotacaoData.filter(d => d.CARGO_TECNICO === selectedFilters.cargo);
      exercicioData = exercicioData.filter(d => d.CARGO_TECNICO === selectedFilters.cargo);
    }

    const getUniqueSorted = (data, key) =>
      [...new Set(data.map(d => d[key]))].filter(Boolean).sort();

    return {
      lotacoes: getUniqueSorted(lotacaoData, 'UND_LOTACAO_TECNICO'),
      exercicios: getUniqueSorted(exercicioData, 'UND_EXERCICIO_TECNICO'),
      cargos: getUniqueSorted(cargoData, 'CARGO_TECNICO'),
    };
  }, [allData, selectedFilters]);

  /* =====================================================
     Estatística: top lotação
  ===================================================== */
  const topLotacao = useMemo(() => {
    if (!filteredData.length) return 'N/A';

    const counts = new Map();
    for (const row of filteredData) {
      const lotacao = row.UND_LOTACAO_TECNICO || 'N/A';
      counts.set(lotacao, (counts.get(lotacao) || 0) + 1);
    }

    let best = { name: 'N/A', count: 0 };
    [...counts.entries()]
      .sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
      .forEach(([name, count], idx) => {
        if (idx === 0) best = { name, count };
      });

    return `${best.name} — ${best.count.toLocaleString('pt-BR')}`;
  }, [filteredData]);

  /* =====================================================
     GRÁFICOS POR DIMENSÃO (2xN)
     Regras:
       - se pergunta != todas -> 1 gráfico (da pergunta)
       - senão, se dimensao != todas -> 1 dimensão (com várias perguntas)
       - senão -> todas as dimensões (grid 2xN)
  ===================================================== */
  const chartsByDimension = useMemo(() => {
    if (!questionMappingTecnico || !dimensionMappingTecnico) return [];

    // Caso 1: pergunta específica
    if (selectedFilters.pergunta !== 'todas') {
      const key = selectedFilters.pergunta;

      const scores = filteredData
        .map(item => ratingToScore[item[key]])
        .filter(v => v !== null && v !== undefined);

      const avg = scores.length
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : null;

      return [
        {
          dimensionName: `Pergunta ${key}`,
          chartData: {
            labels: [key],
            datasets: [
              {
                label: 'Média de Respostas',
                data: [avg],
                backgroundColor: 'rgba(255, 142, 41, 0.8)',
                borderColor: 'rgba(255, 142, 41, 1)',
                borderWidth: 1,
              },
            ],
          },
        },
      ];
    }

    // Caso 2: 1 dimensão selecionada
    const dimensionEntries =
      selectedFilters.dimensao !== 'todas'
        ? [[selectedFilters.dimensao, dimensionMappingTecnico[selectedFilters.dimensao] || []]]
        : Object.entries(dimensionMappingTecnico);

    // Caso 3: todas as dimensões
    return dimensionEntries
      .map(([dimensionName, questionKeys]) => {
        const labels = questionKeys;

        const dataPoints = questionKeys.map(key => {
          const scores = filteredData
            .map(item => ratingToScore[item[key]])
            .filter(v => v !== null && v !== undefined);

          if (!scores.length) return null;

          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          return Number(avg.toFixed(2));
        });

        return {
          dimensionName,
          chartData: {
            labels,
            datasets: [
              {
                label: 'Média de Respostas',
                data: dataPoints,
                backgroundColor: 'rgba(255, 142, 41, 0.8)',
                borderColor: 'rgba(255, 142, 41, 1)',
                borderWidth: 1,
              },
            ],
          },
        };
      })
      .filter(d => d.chartData.labels && d.chartData.labels.length > 0);
  }, [filteredData, selectedFilters.pergunta, selectedFilters.dimensao]);

  return (
    <div>
      <Header
        title="Análise de Respostas dos Técnicos"
        subtitle="Dados referentes ao questionário de autoavaliação"
      />

      <div className={styles.statsGrid}>
        <StatCard
          title="Total de Participantes"
          value={filteredData.length.toLocaleString('pt-BR')}
          icon={<Users />}
        />
        <StatCard
          title="Lotação com Mais Participantes"
          value={topLotacao}
          icon={<Building />}
        />
      </div>

      <TecnicoFilters
        filters={filterOptions}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        questionMap={questionMappingTecnico}
        dimensionMap={dimensionMappingTecnico}
      />

      {/* GRID 2xN POR DIMENSÃO */}
      <div className={styles.dimensionGrid}>
        {chartsByDimension.map(({ dimensionName, chartData }) => (
          <QuestionChart
            key={dimensionName}
            chartData={chartData}
            title={String(dimensionName)}
            questionMap={questionMappingTecnico}
          />
        ))}
      </div>
    </div>
  );
}
