'use client';
import { useState, useMemo, useEffect } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

export default function DiscenteFilters({
  title = 'Filtros',
  filters,
  selectedFilters,
  onFilterChange,
  questionMap,
  dimensionMap,

  // Comparação (opcional; só o card A usa)
  showCompareToggle = false,
  compareEnabled = false,
  onCompareChange = () => {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { campus, unidades, cursos } = filters;

  const [ibgeDict, setIbgeDict] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/15/municipios')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('IBGE fetch failed'))))
      .then(list => {
        if (!alive) return;
        const dict = {};
        for (const item of list) {
          const nome = String(item?.nome || '').trim();
          const norm = normalizeNoAccents(nome);
          if (norm) dict[norm] = nome;
        }
        setIbgeDict(dict);
      })
      .catch(() => setIbgeDict(null));
    return () => { alive = false; };
  }, []);

  const reNaoInformado = /^(nao|não)\s*informado$/i;

  function normalizeNoAccents(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function beautifyLabel(raw) {
    const v = raw == null ? '' : String(raw).trim();
    if (reNaoInformado.test(v)) return 'Não Informado';
    if (ibgeDict) {
      const norm = normalizeNoAccents(v);
      if (ibgeDict[norm]) return ibgeDict[norm];
    }
    return v;
  }

  function prepList(arr = [], { dropNaoInformado = false } = {}) {
    const list = (arr || []).map(v => (v == null ? '' : String(v).trim()));

    const body = list
      .filter(v => (dropNaoInformado ? !reNaoInformado.test(v) : true))
      .sort((a, b) => beautifyLabel(a).localeCompare(beautifyLabel(b), 'pt-BR'));

    if (dropNaoInformado) return body;

    const tail = list.find(v => reNaoInformado.test(v));
    return tail ? [...body, tail] : body;
  }

  const campusList = useMemo(() => prepList(campus, { dropNaoInformado: false }), [campus, ibgeDict]);
  const unidadesList = useMemo(() => prepList(unidades, { dropNaoInformado: true }), [unidades, ibgeDict]);
  const cursosList = useMemo(() => prepList(cursos, { dropNaoInformado: true }), [cursos, ibgeDict]);

  const availableQuestions = useMemo(() => {
    const selectedDim = selectedFilters.dimensao;
    if (selectedDim && selectedDim !== 'todas' && dimensionMap && dimensionMap[selectedDim]) {
      const questionKeysInDim = dimensionMap[selectedDim];
      const filtered = {};
      questionKeysInDim.forEach(key => {
        if (questionMap[key]) filtered[key] = questionMap[key];
      });
      return filtered;
    }
    return questionMap;
  }, [selectedFilters.dimensao, questionMap, dimensionMap]);

  // Garante consistência Dimensão -> Pergunta
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'dimensao') {
      const nextDim = value;
      const currentQuestion = selectedFilters.pergunta;

      if (currentQuestion && currentQuestion !== 'todas') {
        if (
          nextDim !== 'todas' &&
          dimensionMap &&
          dimensionMap[nextDim] &&
          !dimensionMap[nextDim].includes(currentQuestion)
        ) {
          onFilterChange({ target: { name: 'dimensao', value: nextDim } });
          onFilterChange({ target: { name: 'pergunta', value: 'todas' } });
          return;
        }
      }
    }

    onFilterChange(e);
  };

  return (
    <div className={styles.filtersWrapper}>
      <button
        type="button"
        className={styles.filterToggleButton}
        onClick={() => setIsOpen(v => !v)}
      >
        <Filter size={20} />
        <span>{title}</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className={`${styles.filtersContent} ${isOpen ? styles.open : ''}`}>
        <select
          name="campus"
          value={selectedFilters.campus}
          onChange={handleChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Campi</option>
          {campusList.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>
              {beautifyLabel(c)}
            </option>
          ))}
        </select>

        <select
          name="unidade"
          value={selectedFilters.unidade}
          onChange={handleChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todas as Unidades</option>
          {unidadesList.map((u, i) => (
            <option key={`${u}-${i}`} value={u}>
              {beautifyLabel(u)}
            </option>
          ))}
        </select>

        <select
          name="curso"
          value={selectedFilters.curso}
          onChange={handleChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Cursos</option>
          {cursosList.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>
              {beautifyLabel(c)}
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
            <option key={`${dim}-${i}`} value={dim}>
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
            {availableQuestions && Object.keys(availableQuestions).map((key) => {
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
