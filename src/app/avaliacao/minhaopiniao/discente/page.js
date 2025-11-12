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
      .catch(error => console.error("Não foi possível carregar os dados:", error));
  }, []);

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
    if (selectedFilters.dimensao !== 'todos') {
      const questionKeysInDim = dimensionMapping ? dimensionMapping[selectedFilters.dimensao] : [];
      if (questionKeysInDim && questionKeysInDim.length > 0) {
        data = data.filter(respondente => {
          return questionKeysInDim.some(key => respondente[key] && respondente[key] !== '5');
        });
      }
    }
    setFilteredData(data);
  }, [selectedFilters, allData]);

  // 1. LÓGICA DE FILTROS SIMPLIFICADA PARA NÃO RESETAR SELEÇÕES
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'dimensao') {
      setSelectedFilters(prev => ({ ...prev, dimensao: value, pergunta: 'todas' }));
    } else {
      setSelectedFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  // 2. LÓGICA ATUALIZADA PARA FILTROS INTERDEPENDENTES (CASCATA)
  const filterOptions = useMemo(() => {
    if (allData.length === 0) return { campus: [], unidades: [], cursos: [] };

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

    const getUniqueSorted = (data, key) => [...new Set(data.map(d => d[key]))].filter(Boolean).sort();

    return {
      campus: getUniqueSorted(campusData, 'CAMPUS_DISCENTE'),
      unidades: getUniqueSorted(unidadeData, 'UNIDADE_DISCENTE'),
      cursos: getUniqueSorted(cursoData, 'CURSO_DISCENTE'),
    };
  }, [allData, selectedFilters]);

  const topUnit = useMemo(() => {
    if (!filteredData.length) return { name: '-', count: 0 };
    const counts = new Map();
    for (const row of filteredData) {
      const name = row.UNIDADE_DISCENTE || 'Sem unidade';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    let best = { name: '-', count: 0 };
    [...counts.entries()]
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'pt-BR'))
      .forEach(([name, count], idx) => {
        if (idx === 0) best = { name, count };
      });
    return best;
  }, [filteredData]);

  const questionChartData = useMemo(() => {
    const getQuestionKeys = () => {
      if (selectedFilters.pergunta !== 'todas') {
        return [selectedFilters.pergunta];
      }
      if (selectedFilters.dimensao !== 'todas') {
        return dimensionMapping ? (dimensionMapping[selectedFilters.dimensao] || []) : [];
      }
      return questionMapping ? Object.keys(questionMapping) : [];
    };

    const questionKeys = getQuestionKeys();
    const labels = questionKeys;

    const dataPoints = questionKeys.map(key => {
      const scores = filteredData
        .map(item => ratingToScore[item[key]])
        .filter(score => score !== null && score !== undefined);
      
      // Retorna null para não plotar perguntas sem respostas
      if (scores.length === 0) return null;

      return scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    return {
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
    };
  }, [filteredData, selectedFilters.pergunta, selectedFilters.dimensao]);

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
      <QuestionChart
        chartData={questionChartData}
        title="Média de Respostas por Pergunta"
        questionMap={questionMapping}
      />
    </div>
  );
}