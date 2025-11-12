'use client';
import { useState, useMemo } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Componente que renderiza um painel de filtros sanfonado (accordion) com caixas de seleção padrão.
 */
// 1. Receba 'dimensionMap' como prop
export default function DocenteFilters({ filters, selectedFilters, onFilterChange, questionMap, dimensionMap }) {
  const [isOpen, setIsOpen] = useState(false);
  const { lotacoes, cargos } = filters;

  // 2. Filtra as perguntas disponíveis com base na dimensão selecionada
  const availableQuestions = useMemo(() => {
    const selectedDim = selectedFilters.dimensao;
    if (selectedDim && selectedDim !== 'todas' && dimensionMap && dimensionMap[selectedDim]) {
      const questionKeysInDim = dimensionMap[selectedDim];
      const filtered = {};
      questionKeysInDim.forEach(key => {
        if (questionMap[key]) {
          filtered[key] = questionMap[key];
        }
      });
      return filtered;
    }
    return questionMap; // Se 'todas', retorna todas as perguntas
  }, [selectedFilters.dimensao, questionMap, dimensionMap]);


  return (
    <div className={styles.filtersWrapper}>
      <button 
        className={styles.filterToggleButton} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <Filter size={20} />
        <span>Filtros</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className={`${styles.filtersContent} ${isOpen ? styles.open : ''}`}>
        
        <select 
          name="lotacao"
          value={selectedFilters.lotacao}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todas as Lotações</option>
          {lotacoes && lotacoes.map((l, index) => <option key={`${l}-${index}`} value={l}>{l}</option>)}
        </select>

        <select 
          name="cargo"
          value={selectedFilters.cargo}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Cargos</option>
          {cargos && cargos.map((c, index) => <option key={`${c}-${index}`} value={c}>{c}</option>)}
        </select>
        
        {/* 3. Adicione o novo seletor de Dimensão */}
        <select
          name="dimensao"
          value={selectedFilters.dimensao}
          onChange={onFilterChange}
          className={`${styles.filterSelect} ${styles.filterSelectWide}`}
        >
          <option value="todas">Todas as Dimensões</option>
          {dimensionMap && Object.keys(dimensionMap).map((dim, i) => (
            <option key={`${dim}-${i}`} value={dim}>{dim}</option>
          ))}
        </select>

        {/* 4. Filtro de Perguntas (agora usa a lista filtrada 'availableQuestions') */}
        <select 
          name="pergunta" 
          value={selectedFilters.pergunta} 
          onChange={onFilterChange}
          className={`${styles.filterSelect} ${styles.filterSelectWide}`}
        >
          <option value="todas">Analisar as Perguntas</option>
          {availableQuestions && Object.keys(availableQuestions).map(key => {
            const fullText = `${key}: ${availableQuestions[key]}`;
            return (
              <option 
                key={key} 
                value={key}
                title={fullText}
              >
                {fullText}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}