'use client';

import { useState } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export default function AvaliacaoInLocoFilters({
  filters,
  selectedFilters,
  onFilterChange,
  showRanking = false,
  onToggleRanking = () => {},
  loadingCampus = false,
  loadingCurso = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { anos, undAcad, campi, cursos, modalidades } = filters;
  const hasYearSelected = Boolean(selectedFilters?.ano);
  const hasUndAcadSelected = Boolean(selectedFilters?.undAcad);
  const hasModalidadeSelected = Boolean(selectedFilters?.modalidade);

  const undAcadOptions = Array.isArray(undAcad) ? undAcad : [];
  const campusOptions = Array.isArray(campi) ? campi : [];
  const cursoOptions = Array.isArray(cursos) ? cursos : [];
  const modalidadeOptions = Array.isArray(modalidades) ? modalidades : [];

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
          <option value="todos">Todos os anos</option>
          {anos?.map((a, i) => (
            <option key={`ano-${a}-${i}`} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          disabled={!hasYearSelected}
          name="undAcad"
          value={selectedFilters.undAcad ?? ''}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="" disabled>
            {hasYearSelected
              ? 'Selecione a unidade acadêmica'
              : 'Selecione o ano primeiro'}
          </option>
          <option value="todos">Todas as Unidades</option>
          {undAcadOptions.map((u, i) => (
            <option key={`undAcad-${u}-${i}`} value={u}>
              {u}
            </option>
          ))}
        </select>

        <select
          disabled={!hasYearSelected || !hasUndAcadSelected}
          name="modalidade"
          value={selectedFilters.modalidade ?? ''}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="" disabled>
            {!hasYearSelected
              ? 'Selecione o ano primeiro'
              : !hasUndAcadSelected
                ? 'Selecione a unidade acadêmica primeiro'
                : 'Selecione a modalidade'}
          </option>
          <option value="todos">Todas as Modalidades</option>
          {modalidadeOptions.map((m, i) => (
            <option key={`modalidade-${m}-${i}`} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          disabled={!hasYearSelected || !hasUndAcadSelected || !hasModalidadeSelected || loadingCampus}
          name="campus"
          value={selectedFilters.campus ?? ''}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="" disabled>
            {!hasYearSelected
              ? 'Selecione o ano primeiro'
              : !hasUndAcadSelected
                ? 'Selecione a unidade acadêmica primeiro'
                : !hasModalidadeSelected
                  ? 'Selecione a modalidade primeiro'
                  : loadingCampus
                    ? 'Carregando campi...'
                    : 'Selecione o campus'}
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

        {showRanking && (
          <label className="inloco-ranking-toggle">
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
