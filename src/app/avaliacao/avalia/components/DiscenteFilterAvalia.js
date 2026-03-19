'use client';

import { useState } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export default function DiscenteFilters({
  filters,
  selectedFilters,
  onFilterChange,
  showRanking = false,
  onToggleRanking = () => {},
  showDimensionFilter = true,
  showRankingToggle = true,
  loadingCampus = false,
  loadingCurso = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { campus, cursos, anos, dimensoes } = filters;
  const hasYearSelected = Boolean(selectedFilters?.ano);
  const campusOptions = Array.isArray(campus) ? campus : [];
  const cursoOptions = Array.isArray(cursos) ? cursos : [];

  return (
    <div className={styles.filtersWrapper}>
      <button
        type="button"
        className={styles.filterToggleButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Filter size={20} />
        <span>Filtros</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className={`${styles.filtersContent} ${isOpen ? styles.open : ''}`}>
        <select
          name="ano"
          value={selectedFilters.ano}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="" disabled hidden>
            Escolha um ano
          </option>
          {anos?.map((a, i) => (
            <option key={`ano-${a}-${i}`} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          disabled={!hasYearSelected || loadingCampus}
          name="campus"
          value={selectedFilters.campus ?? ''}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="" disabled>
            {hasYearSelected
              ? loadingCampus
                ? 'Carregando campi...'
                : 'Selecione o campus'
              : 'Selecione o ano primeiro'}
          </option>
          {!loadingCampus ? <option value="todos">Todos os Campi</option> : null}
          {campusOptions.map((c, i) => (
            <option key={`campus-${c}-${i}`} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          disabled={!hasYearSelected || !selectedFilters?.campus || loadingCurso}
          name="curso"
          value={selectedFilters.curso ?? ''}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="" disabled>
            {!hasYearSelected
              ? 'Selecione o ano primeiro'
              : !selectedFilters?.campus
                ? 'Selecione o campus primeiro'
                : loadingCurso
                  ? 'Carregando cursos...'
                  : 'Selecione o curso'}
          </option>
          {!loadingCurso && selectedFilters?.campus ? (
            <option value="todos">Todos os Cursos</option>
          ) : null}
          {cursoOptions.map((c, i) => (
            <option key={`curso-${c}-${i}`} value={c}>
              {c}
            </option>
          ))}
        </select>

        {showDimensionFilter && (
          <select
            name="dimensao"
            value={selectedFilters.dimensao ?? ''}
            onChange={onFilterChange}
            className={styles.filterSelect}
          >
            <option value="">Todas as Dimensões</option>
            {(dimensoes ?? []).map((d) => (
              <option key={`dim-${d.value}`} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        )}

        {showRankingToggle && (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              padding: '0.35rem 0.2rem',
            }}
          >
            <input
              type="checkbox"
              checked={showRanking}
              onChange={onToggleRanking}
            />
            Exibir ranking
          </label>
        )}
      </div>
    </div>
  );
}