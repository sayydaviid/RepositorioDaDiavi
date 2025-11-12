'use client';
import { useState } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export default function EadFilters({
  filters,
  selectedFilters,
  onFilterChange,
  visibleFields,
  // novos props (com defaults seguros)
  poloPlaceholder = 'Selecione o polo desejado',
  disablePlaceholderOption = true,      // impede placeholder de ser clicável
  showAllPolosOption = true,            // mostra "Todos os Polos"
  allPolosLabel = 'Todos os Polos',
}) {
  const [isOpen, setIsOpen] = useState(false);

  // helper: controla visibilidade sem quebrar comportamento atual
  const show = (key) => {
    if (!Array.isArray(visibleFields) || visibleFields.length === 0) return true; // default: mostra tudo
    return visibleFields.includes(key);
  };

  // Novo: esconde Polo quando ano = 2023 ou quando não há polos disponíveis
  const is2023 = selectedFilters?.ano === '2023';
  const hasPolos = Array.isArray(filters?.polos) && filters.polos.length > 0;
  const shouldShowPolo = !is2023 && hasPolos;

  // fallback seguros para map()
  const polos = hasPolos ? filters.polos : [];
  const cursos = Array.isArray(filters?.cursos) ? filters.cursos : [];
  const disciplinas = Array.isArray(filters?.disciplinas) ? filters.disciplinas : [];
  const dimensoes = Array.isArray(filters?.dimensoes) ? filters.dimensoes : [];
  const anos = Array.isArray(filters?.anos) ? filters.anos : [];

  // valores controlados (vazio significa "placeholder visível")
  const poloValue = selectedFilters?.polo || '';
  const cursoValue = selectedFilters?.curso || '';
  const disciplinaValue = selectedFilters?.disciplina || '';
  const dimensaoValue = selectedFilters?.dimensao || '';
  const anoValue = selectedFilters?.ano || (anos[0] ?? '');

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
        {/* Filtro de Polo (escondido em 2023 e quando não há polos) */}
        {show('polo') && shouldShowPolo && (
          <select
            name="polo"
            value={poloValue}
            onChange={onFilterChange}
            className={styles.filterSelect}
            aria-label="Polo"
          >
            {/* Placeholder não-clicável: value="" + disabled + hidden */}
            {disablePlaceholderOption && (
              <option value="" disabled hidden>
                {poloPlaceholder}
              </option>
            )}
            {/* "Todos os Polos" opcional */}
            {showAllPolosOption && (
              <option value={allPolosLabel}>{allPolosLabel}</option>
            )}
            {polos.map((polo) => (
              <option key={polo} value={polo}>
                {polo}
              </option>
            ))}
          </select>
        )}

        {/* Filtro de Curso (em 2025 some na UI porque visibleFields não inclui 'curso';
            aqui apenas respeitamos visibleFields, sem lógica de ano) */}
        {show('curso') && (
          <select
            name="curso"
            value={cursoValue}
            onChange={onFilterChange}
            className={styles.filterSelect}
            aria-label="Curso"
          >
            {/* Placeholder oculto quando nada selecionado */}
            <option value="" disabled hidden>
              Selecione o curso
            </option>
            {cursos.map((curso) => (
              <option key={curso} value={curso}>
                {curso}
              </option>
            ))}
          </select>
        )}

        {/* Filtro de Disciplina */}
        {show('disciplina') && (
          <select
            name="disciplina"
            value={disciplinaValue}
            onChange={onFilterChange}
            className={`${styles.filterSelect} ${styles.filterSelectWide}`}
            aria-label="Disciplina"
          >
            <option value="todos">Todas as Disciplinas</option>
            {disciplinas.map((disciplina) => (
              <option key={disciplina} value={disciplina}>
                {disciplina}
              </option>
            ))}
          </select>
        )}

        {/* Filtro de Dimensão */}
        {show('dimensao') && (
          <select
            name="dimensao"
            value={dimensaoValue}
            onChange={onFilterChange}
            className={`${styles.filterSelect} ${styles.filterSelectWide}`}
            aria-label="Dimensão"
          >
            <option value="todos">Todas as Dimensões</option>
            {dimensoes.map((dimensao) => (
              <option key={dimensao} value={dimensao}>
                {dimensao}
              </option>
            ))}
          </select>
        )}

        {/* Filtro de Ano */}
        {show('ano') && (
          <select
            name="ano"
            value={anoValue}
            onChange={onFilterChange}
            className={styles.filterSelect}
            aria-label="Ano"
          >
            {anos.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
