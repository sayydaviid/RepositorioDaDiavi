'use client';

import { useState } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export default function DiscenteFilters({ filters, selectedFilters, onFilterChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const { campus, cursos } = filters;

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
        {/* Filtro de Campus */}
        <select
          name="campus"
          value={selectedFilters.campus}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Campi</option>
          {campus?.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>{c}</option>
          ))}
        </select>

        {/* Filtro de Curso */}
        <select
          name="curso"
          value={selectedFilters.curso}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Cursos</option>
          {cursos?.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  );
}