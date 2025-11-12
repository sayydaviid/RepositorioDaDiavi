'use client';
import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import DocenteFilters from '../components/DocenteFilters';
import QuestionChart from '../components/QuestionChart';
import styles from '../../../../styles/dados.module.css';
import { Users, Building } from 'lucide-react';
import {questionMappingDocente, ratingToScore } from '../lib/questionMappingDocente';
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

  useEffect(() => {
    fetch('/api/docente')
      .then(res => res.ok ? res.json() : Promise.reject('Falha ao buscar dados'))
      .then(data => {
        const teacherData = data[2] ? data[2].data : data;
        setAllData(teacherData);
        setFilteredData(teacherData);
      })
      .catch(error => console.error("Não foi possível carregar os dados dos docentes:", error));
  }, []);

  useEffect(() => {
    let data = [...allData];
    if (selectedFilters.lotacao !== 'todos') {
      data = data.filter(d => d.UND_LOTACAO_DOCENTE === selectedFilters.lotacao);
    }
    if (selectedFilters.cargo !== 'todos') {
      data = data.filter(d => d.CARGO_DOCENTE === selectedFilters.cargo);
    }

    if (selectedFilters.dimensao !== 'todos') {
      const questionKeysInDim = dimensionMappingDocente ? dimensionMappingDocente[selectedFilters.dimensao] : [];
      
      if (questionKeysInDim && questionKeysInDim.length > 0) {
        data = data.filter(respondente => {
          return questionKeysInDim.some(key => respondente[key] && respondente[key] !== '5');
        });
      }
    }

    setFilteredData(data);
  }, [selectedFilters, allData]);

  // FUNÇÃO CORRIGIDA PARA NÃO RESETAR OS FILTROS
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'dimensao') {
      // Esta lógica para resetar a pergunta ao mudar a dimensão está correta
      setSelectedFilters(prev => ({ ...prev, dimensao: value, pergunta: 'todas' }));
    } else {
      // Lógica simplificada: Apenas atualiza o filtro que foi alterado (lotacao, cargo, etc.)
      setSelectedFilters(prev => ({ ...prev, [name]: value }));
    }
  };

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
    const lotacaoIndefinida = "NÃO INFORMADO";
    const lotacoesSorted = lotacoesRaw.filter(l => l !== lotacaoIndefinida).sort();
    if (lotacoesRaw.includes(lotacaoIndefinida)) {
      lotacoesSorted.push(lotacaoIndefinida);
    }

    const cargosFiltered = [...new Set(cargoData.map(d => d.CARGO_DOCENTE))]
      .filter(Boolean).filter(c => c !== 'CARGO INDEFINIDO' && c !== 'MEDICO-AREA').sort();
    
    return {
      lotacoes: lotacoesSorted,
      cargos: cargosFiltered,
    };
  }, [allData, selectedFilters.lotacao, selectedFilters.cargo]);

  const topLotacao = useMemo(() => {
    if (filteredData.length === 0) return 'N/A';
    
    const counts = filteredData.reduce((acc, curr) => {
      const lotacao = curr.UND_LOTACAO_DOCENTE;
      if (lotacao) acc[lotacao] = (acc[lotacao] || 0) + 1;
      return acc;
    }, {});

    if (Object.keys(counts).length === 0) return 'N/A';

    const topName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    
    return `${topName} — ${counts[topName]}`;
  }, [filteredData]);

  const questionChartData = useMemo(() => {
    const getQuestionKeys = () => {
      if (selectedFilters.pergunta !== 'todas') {
        return [selectedFilters.pergunta];
      }
      if (selectedFilters.dimensao !== 'todas') {
        return dimensionMappingDocente ? (dimensionMappingDocente[selectedFilters.dimensao] || []) : [];
      }
      return questionMappingDocente ? Object.keys(questionMappingDocente) : [];
    };

    const questionKeys = getQuestionKeys();
    const labels = questionKeys;
    const dataPoints = questionKeys.map(key => {
      const scores = filteredData
        .map(item => ratingToScore[item[key]])
        .filter(score => score !== null && score !== undefined);
      
      if (scores.length === 0) return null;

      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      return average;
    });
    return {
      labels: labels,
      datasets: [{
          label: 'Média de Respostas',
          data: dataPoints,
          backgroundColor: 'rgba(255, 142, 41, 0.8)',
          borderColor: 'rgba(255, 142, 41, 1)',
          borderWidth: 1,
      }],
    };
  }, [filteredData, selectedFilters.pergunta, selectedFilters.dimensao]);

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
      <QuestionChart 
        chartData={questionChartData}
        title="Média de Respostas por Pergunta"
        questionMap={questionMappingDocente}
      />
    </div>
  );
}