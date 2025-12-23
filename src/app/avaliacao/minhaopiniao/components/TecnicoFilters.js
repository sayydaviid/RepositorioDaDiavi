'use client';

import { useState, useMemo } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export default function TecnicoFilters({
  title = 'Filtros',
  filters,
  selectedFilters,
  onFilterChange,
  questionMap,
  dimensionMap,

  // Comparação (opcional; só o card A usa)
  showCompareToggle = false,
  compareEnabled = false,
  onCompareChange = () => {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { lotacoes, exercicios, cargos } = filters;

  const availableQuestions = useMemo(() => {
    const selectedDim = selectedFilters.dimensao;
    if (selectedDim && selectedDim !== 'todas' && dimensionMap && dimensionMap[selectedDim]) {
      const questionKeysInDim = dimensionMap[selectedDim];
      const filtered = {};
      questionKeysInDim.forEach((key) => {
        if (questionMap?.[key]) filtered[key] = questionMap[key];
      });
      return filtered;
    }
    return questionMap;
  }, [selectedFilters.dimensao, questionMap, dimensionMap]);

  // Consistência Dimensão -> Pergunta (igual Discente/Docente)
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'dimensao') {
      const nextDim = value;
      const currentQuestion = selectedFilters.pergunta;

      if (
        currentQuestion &&
        currentQuestion !== 'todas' &&
        nextDim !== 'todas' &&
        dimensionMap?.[nextDim] &&
        !dimensionMap[nextDim].includes(currentQuestion)
      ) {
        onFilterChange({ target: { name: 'dimensao', value: nextDim } });
        onFilterChange({ target: { name: 'pergunta', value: 'todas' } });
        return;
      }
    }

    onFilterChange(e);
  };

  return (
    <div className={styles.filtersWrapper}>
      <button
        type="button"
        className={styles.filterToggleButton}
        onClick={() => setIsOpen((v) => !v)}
      >
        <Filter size={20} />
        <span>{title}</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className={`${styles.filtersContent} ${isOpen ? styles.open : ''}`}>
        <select
          name="lotacao"
          value={selectedFilters.lotacao}
          onChange={handleChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todas as Lotações</option>
          {lotacoes?.map((l, i) => (
            <option key={`lot-${l}-${i}`} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          name="exercicio"
          value={selectedFilters.exercicio}
          onChange={handleChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todas as Unidades de Exercício</option>
          {exercicios?.map((ex, i) => (
            <option key={`ex-${ex}-${i}`} value={ex}>
              {ex}
            </option>
          ))}
        </select>

        <select
          name="cargo"
          value={selectedFilters.cargo}
          onChange={handleChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Cargos</option>
          {cargos?.map((c, i) => (
            <option key={`cargo-${c}-${i}`} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          name="dimensao"
          value={selectedFilters.dimensao}
          onChange={handleChange}
          className={`${styles.filterSelect} ${styles.filterSelectWide}`}
        >
          <option value="todas">Todas as Dimensões</option>
          {dimensionMap && Object.keys(dimensionMap).map((dim, i) => (
            <option key={`dim-${dim}-${i}`} value={dim}>
              {dim}
            </option>
          ))}
        </select>

        {/* Linha final: Pergunta + Comparação (lado a lado) */}
        <div className={styles.questionCompareRow}>
          <select
            name="pergunta"
            value={selectedFilters.pergunta}
            onChange={handleChange}
            className={styles.filterSelect}
          >
            <option value="todas">Analisar as Perguntas</option>
            {availableQuestions &&
              Object.keys(availableQuestions).map((key) => {
                const fullText = `${key}: ${availableQuestions[key]}`;
                return (
                  <option key={key} value={key} title={fullText}>
                    {fullText}
                  </option>
                );
              })}
          </select>

          {showCompareToggle && (
            <label className={styles.compareInlineLabel}>
              <input
                className={styles.compareCheckbox}
                type="checkbox"
                checked={compareEnabled}
                onChange={(e) => onCompareChange(e.target.checked)}
              />
              Comparação
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
