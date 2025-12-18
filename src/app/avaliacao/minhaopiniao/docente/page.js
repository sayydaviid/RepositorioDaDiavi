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

export default function DocentePage() {
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({
    lotacao: 'todos',
    cargo: 'todos',
    pergunta: 'todas',
    dimensao: 'todas',
  });

  /* =====================================================
     Carregamento inicial
  ===================================================== */
  useEffect(() => {
    fetch('/api/docente')
      .then(res => (res.ok ? res.json() : Promise.reject('Falha ao buscar dados')))
      .then(data => {
        const teacherData = data[2]?.data || data;
        setAllData(teacherData);
        setFilteredData(teacherData);
      })
      .catch(error =>
        console.error('Não foi possível carregar os dados dos docentes:', error)
      );
  }, []);

  /* =====================================================
     Aplicação dos filtros (lotacao/cargo)
     OBS: Não filtramos por dimensão aqui, porque agora mostramos todas as dimensões em grid.
     A dimensão continua existindo no filtro, mas você pode decidir usar para "mostrar só uma"
     (se quiser isso, eu adapto).
  ===================================================== */
  useEffect(() => {
    let data = [...allData];

    if (selectedFilters.lotacao !== 'todos') {
      data = data.filter(d => d.UND_LOTACAO_DOCENTE === selectedFilters.lotacao);
    }
    if (selectedFilters.cargo !== 'todos') {
      data = data.filter(d => d.CARGO_DOCENTE === selectedFilters.cargo);
    }

    setFilteredData(data);
  }, [selectedFilters.lotacao, selectedFilters.cargo, allData]);

  /* =====================================================
     Handle filters
  ===================================================== */
  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    if (name === 'dimensao') {
      setSelectedFilters(prev => ({ ...prev, dimensao: value, pergunta: 'todas' }));
    } else {
      setSelectedFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  /* =====================================================
     Filtros em cascata
  ===================================================== */
  const filterOptions = useMemo(() => {
    let lotacaoData = allData;
    let cargoData = allData;

    if (selectedFilters.lotacao !== 'todos') {
      cargoData = cargoData.filter(d => d.UND_LOTACAO_DOCENTE === selectedFilters.lotacao);
    }
    if (selectedFilters.cargo !== 'todos') {
      lotacaoData = lotacaoData.filter(d => d.CARGO_DOCENTE === selectedFilters.cargo);
    }

    const lotacoesRaw = [...new Set(lotacaoData.map(d => d.UND_LOTACAO_DOCENTE))].filter(Boolean);
    const lotacaoIndefinida = 'NÃO INFORMADO';
    const lotacoesSorted = lotacoesRaw.filter(l => l !== lotacaoIndefinida).sort();
    if (lotacoesRaw.includes(lotacaoIndefinida)) lotacoesSorted.push(lotacaoIndefinida);

    const cargosFiltered = [...new Set(cargoData.map(d => d.CARGO_DOCENTE))]
      .filter(Boolean)
      .filter(c => c !== 'CARGO INDEFINIDO' && c !== 'MEDICO-AREA')
      .sort();

    return {
      lotacoes: lotacoesSorted,
      cargos: cargosFiltered,
    };
  }, [allData, selectedFilters.lotacao, selectedFilters.cargo]);

  /* =====================================================
     Estatística: top lotação
  ===================================================== */
  const topLotacao = useMemo(() => {
    if (!filteredData.length) return 'N/A';

    const counts = new Map();
    for (const row of filteredData) {
      const lotacao = row.UND_LOTACAO_DOCENTE || 'NÃO INFORMADO';
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
     Regra:
       - Se selectedFilters.dimensao !== 'todas', mostra só aquela dimensão
       - Caso contrário, mostra todas
  ===================================================== */
  const chartsByDimension = useMemo(() => {
    if (!dimensionMappingDocente) return [];

    const entries =
      selectedFilters.dimensao !== 'todas'
        ? [[selectedFilters.dimensao, dimensionMappingDocente[selectedFilters.dimensao] || []]]
        : Object.entries(dimensionMappingDocente);

    return entries
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
      // Opcional: se dimensão estiver vazia (sem perguntas), não renderiza
      .filter(d => d.chartData.labels && d.chartData.labels.length > 0);
  }, [filteredData, selectedFilters.dimensao]);

  return (
    <div>
      <Header
        title="Análise de Respostas dos Docentes"
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

      <DocenteFilters
        filters={filterOptions}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        questionMap={questionMappingDocente}
        dimensionMap={dimensionMappingDocente}
      />

      {/* GRID 2xN POR DIMENSÃO */}
      <div className={styles.dimensionGrid}>
        {chartsByDimension.map(({ dimensionName, chartData }) => (
          <QuestionChart
            key={dimensionName}
            chartData={chartData}
            title={`${dimensionName}: ${String(dimensionName).toUpperCase?.() ? '' : ''}`}
            questionMap={questionMappingDocente}
          />
        ))}
      </div>
    </div>
  );
}
