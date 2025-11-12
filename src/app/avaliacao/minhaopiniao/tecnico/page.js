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

  useEffect(() => {
    fetch('/api/tecnico') 
      .then(res => res.ok ? res.json() : Promise.reject('Falha ao buscar dados'))
      .then(data => {
        const tecnicoData = data[2]?.data || data; 
        setAllData(tecnicoData);
        setFilteredData(tecnicoData);
      })
      .catch(error => console.error("Não foi possível carregar os dados dos técnicos:", error));
  }, []);

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
    if (selectedFilters.dimensao !== 'todas') {
      const keys = dimensionMappingTecnico ? (dimensionMappingTecnico[selectedFilters.dimensao] || []) : [];
      if (keys.length > 0) {
        data = data.filter(r => keys.some(key => r[key] && r[key] !== '5'));
      }
    }
    setFilteredData(data);
  }, [selectedFilters, allData]);

  // LÓGICA ATUALIZADA PARA RESETAR FILTROS DEPENDENTES
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'lotacao') {
      setSelectedFilters(prev => ({ ...prev, lotacao: value, exercicio: 'todos', cargo: 'todos' }));
    } else if (name === 'exercicio') {
      setSelectedFilters(prev => ({ ...prev, exercicio: value, cargo: 'todos' }));
    } else if (name === 'dimensao') {
      setSelectedFilters(prev => ({ ...prev, dimensao: value, pergunta: 'todas' }));
    } else {
      setSelectedFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  // LÓGICA ATUALIZADA PARA FILTROS CASCATA
  const filterOptions = useMemo(() => {
    if (allData.length === 0) return { lotacoes: [], exercicios: [], cargos: [] };

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

    const getUniqueSorted = (data, key) => [...new Set(data.map(d => d[key]))].filter(Boolean).sort();
    
    return {
      lotacoes: getUniqueSorted(lotacaoData, 'UND_LOTACAO_TECNICO'),
      exercicios: getUniqueSorted(exercicioData, 'UND_EXERCICIO_TECNICO'),
      cargos: getUniqueSorted(cargoData, 'CARGO_TECNICO'),
    };
  }, [allData, selectedFilters]);


  const topLotacao = useMemo(() => {
    if (filteredData.length === 0) return 'N/A';
    const counts = filteredData.reduce((acc, curr) => {
      const lotacao = curr.UND_LOTACAO_TECNICO;
      if (lotacao) acc[lotacao] = (acc[lotacao] || 0) + 1;
      return acc;
    }, {});
    if (Object.keys(counts).length === 0) return 'N/A';
    const topName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    return `${topName} — ${counts[topName]}`;
  }, [filteredData]);

  const questionChartData = useMemo(() => {
    const getKeys = () => {
      if (!questionMappingTecnico || !dimensionMappingTecnico) return [];
      if (selectedFilters.pergunta !== 'todas') return [selectedFilters.pergunta];
      if (selectedFilters.dimensao !== 'todas') return dimensionMappingTecnico[selectedFilters.dimensao] || [];
      return Object.keys(questionMappingTecnico);
    };

    const labels = getKeys();
    const dataPoints = labels.map(key => {
      const scores = filteredData.map(item => ratingToScore[item[key]]).filter(s => s != null);
      if (scores.length === 0) return null;
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    return { 
      labels, 
      datasets: [{ 
        label: 'Média de Respostas', 
        data: dataPoints, 
        backgroundColor: 'rgba(255, 142, 41, 0.8)',
        borderColor: 'rgba(255, 142, 41, 1)',
        borderWidth: 1,
      }] 
    };
  }, [filteredData, selectedFilters.pergunta, selectedFilters.dimensao]);

  return (
    <div>
      <Header title="Análise de Respostas dos Técnicos" subtitle="Dados referentes ao questionário de autoavaliação" />
      <div className={styles.statsGrid}>
        <StatCard title="Total de Participantes" value={filteredData.length.toLocaleString('pt-BR')} icon={<Users />} />
        <StatCard title="Lotação com Mais Participantes" value={topLotacao} icon={<Building />} />
      </div>
      <TecnicoFilters
        filters={filterOptions}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        questionMap={questionMappingTecnico}
        dimensionMap={dimensionMappingTecnico}
      />
      <QuestionChart
        chartData={questionChartData}
        title="Média de Respostas por Pergunta"
        questionMap={questionMappingTecnico}
      />
    </div>
  );
}