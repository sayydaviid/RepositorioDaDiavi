'use client';

import { useState } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export default function DiscenteFilters({ filters, selectedFilters, onFilterChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const { campus, cursos, anos } = filters;

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
          name="campus"
          value={selectedFilters.campus}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Campi</option>
          {campus?.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          name="curso"
          value={selectedFilters.curso}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Cursos</option>
          {cursos?.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>
              {c}
            </option>
          ))}
        </select>

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
            <option key={`${a}-${i}`} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}