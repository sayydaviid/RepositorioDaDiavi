'use client';
import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import DiscenteFilters from '../components/DiscenteFilters';
import QuestionChart from '../components/QuestionChart';
import styles from '../../../../styles/dados.module.css';
import { Users, Building2 } from 'lucide-react';
import { questionMapping, ratingToScore } from '../lib/questionMapping';
import { dimensionMapping } from '../lib/DimensionMappingDiscente';

export default function DiscentePage() {
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({
    campus: 'todos',
    unidade: 'todos',
    curso: 'todos',
    pergunta: 'todas',
    dimensao: 'todas',
  });

  /* =====================================================
     Carregamento inicial
  ===================================================== */
  useEffect(() => {
    fetch('/api/discente')
      .then(res => {
        if (!res.ok) throw new Error('Falha ao buscar dados da API');
        return res.json();
      })
      .then(data => {
        const studentData = data[2]?.data || data;
        setAllData(studentData);
        setFilteredData(studentData);
      })
      .catch(error =>
        console.error('Não foi possível carregar os dados:', error)
      );
  }, []);

  /* =====================================================
     Aplicação dos filtros
  ===================================================== */
  useEffect(() => {
    let data = [...allData];

    if (selectedFilters.campus !== 'todos') {
      data = data.filter(d => d.CAMPUS_DISCENTE === selectedFilters.campus);
    }
    if (selectedFilters.unidade !== 'todos') {
      data = data.filter(d => d.UNIDADE_DISCENTE === selectedFilters.unidade);
    }
    if (selectedFilters.curso !== 'todos') {
      data = data.filter(d => d.CURSO_DISCENTE === selectedFilters.curso);
    }

    setFilteredData(data);
  }, [selectedFilters, allData]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setSelectedFilters(prev => ({ ...prev, [name]: value }));
  };

  /* =====================================================
     Filtros em cascata
  ===================================================== */
  const filterOptions = useMemo(() => {
    if (!allData.length) return { campus: [], unidades: [], cursos: [] };

    let campusData = allData;
    let unidadeData = allData;
    let cursoData = allData;

    if (selectedFilters.campus !== 'todos') {
      unidadeData = unidadeData.filter(d => d.CAMPUS_DISCENTE === selectedFilters.campus);
      cursoData = cursoData.filter(d => d.CAMPUS_DISCENTE === selectedFilters.campus);
    }
    if (selectedFilters.unidade !== 'todos') {
      campusData = campusData.filter(d => d.UNIDADE_DISCENTE === selectedFilters.unidade);
      cursoData = cursoData.filter(d => d.UNIDADE_DISCENTE === selectedFilters.unidade);
    }
    if (selectedFilters.curso !== 'todos') {
      campusData = campusData.filter(d => d.CURSO_DISCENTE === selectedFilters.curso);
      unidadeData = unidadeData.filter(d => d.CURSO_DISCENTE === selectedFilters.curso);
    }

    const uniq = (data, key) =>
      [...new Set(data.map(d => d[key]))].filter(Boolean).sort();

    return {
      campus: uniq(campusData, 'CAMPUS_DISCENTE'),
      unidades: uniq(unidadeData, 'UNIDADE_DISCENTE'),
      cursos: uniq(cursoData, 'CURSO_DISCENTE'),
    };
  }, [allData, selectedFilters]);

  /* =====================================================
     Estatística auxiliar
  ===================================================== */
  const topUnit = useMemo(() => {
    if (!filteredData.length) return { name: '-', count: 0 };

    const counts = new Map();
    filteredData.forEach(row => {
      const name = row.UNIDADE_DISCENTE || 'Sem unidade';
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])[0]
      ? { name: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0],
          count: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][1] }
      : { name: '-', count: 0 };
  }, [filteredData]);

  /* =====================================================
     GRÁFICOS POR DIMENSÃO (2xN)
  ===================================================== */
  const chartsByDimension = useMemo(() => {
    if (!dimensionMapping) return [];

    return Object.entries(dimensionMapping).map(
      ([dimensionName, questionKeys]) => {
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
      }
    );
  }, [filteredData]);

  /* =====================================================
     Render
  ===================================================== */
  return (
    <div>
      <Header
        title="Análise de Respostas dos Discentes"
        subtitle="Dados referentes ao questionário 'Minha Opinião'"
      />

      <div className={styles.statsGrid}>
        <StatCard
          title="Total de Participantes"
          value={filteredData.length.toLocaleString('pt-BR')}
          icon={<Users />}
        />
        <StatCard
          title="Unidade com mais participantes"
          value={`${topUnit.name} — ${topUnit.count.toLocaleString('pt-BR')}`}
          icon={<Building2 />}
        />
      </div>

      <DiscenteFilters
        filters={filterOptions}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        questionMap={questionMapping}
        dimensionMap={dimensionMapping}
      />

      {/* GRID 2xN POR DIMENSÃO */}
      <div className={styles.dimensionGrid}>
        {chartsByDimension.map(({ dimensionName, chartData }) => (
          <QuestionChart
            key={dimensionName}
            chartData={chartData}
            title={dimensionName}
            questionMap={questionMapping}
          />
        ))}
      </div>
    </div>
  );
}
