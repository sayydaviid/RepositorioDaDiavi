'use client';
import { useState, useMemo, useEffect } from 'react';
import styles from '../../../../styles/dados.module.css';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

// 1. Receba 'dimensionMap' como prop
export default function DiscenteFilters({ filters, selectedFilters, onFilterChange, questionMap, dimensionMap }) {
  const [isOpen, setIsOpen] = useState(false);
  const { campus, unidades, cursos } = filters;

  // ========= IBGE (municípios do Pará) =========
  const [ibgeDict, setIbgeDict] = useState(null); // { [normalizado]: 'Nome Oficial' }

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

  // ========= Helpers de exibição =========
  const reNaoInformado = /^(nao|não)\s*informado$/i;

  function normalizeNoAccents(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Corrige o rótulo apenas para municípios do PA com base no IBGE.
  function beautifyLabel(raw) {
    const v = raw == null ? '' : String(raw).trim();
    if (reNaoInformado.test(v)) return 'Não Informado';
    if (ibgeDict) {
      const norm = normalizeNoAccents(v);
      if (ibgeDict[norm]) return ibgeDict[norm];
    }
    return v;
  }

  // Prepara lista com opções:
  // - dropNaoInformado=true => REMOVE "Não Informado"
  // - dropNaoInformado=false => mantém e move para o final
  function prepList(arr = [], { dropNaoInformado = false } = {}) {
    const list = (arr || []).map(v => (v == null ? '' : String(v).trim()));

    const body = list
      .filter(v => (dropNaoInformado ? !reNaoInformado.test(v) : true))
      .sort((a, b) => beautifyLabel(a).localeCompare(beautifyLabel(b), 'pt-BR'));

    if (dropNaoInformado) return body;

    const tail = list.find(v => reNaoInformado.test(v));
    return tail ? [...body, tail] : body;
  }

  // Listas tratadas
  const campusList   = useMemo(() => prepList(campus,   { dropNaoInformado: false }), [campus, ibgeDict]);
  const unidadesList = useMemo(() => prepList(unidades, { dropNaoInformado: true  }), [unidades, ibgeDict]);
  const cursosList   = useMemo(() => prepList(cursos,   { dropNaoInformado: true  }), [cursos, ibgeDict]);

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
        {/* Campus (mantém "Não Informado" no fim) */}
        <select
          name="campus"
          value={selectedFilters.campus}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Campi</option>
          {campusList.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>{beautifyLabel(c)}</option>
          ))}
        </select>

        {/* Unidade (SEM "Não Informado") */}
        <select
          name="unidade"
          value={selectedFilters.unidade}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todas as Unidades</option>
          {unidadesList.map((u, i) => (
            <option key={`${u}-${i}`} value={u}>{beautifyLabel(u)}</option>
          ))}
        </select>

        {/* Curso (SEM "Não Informado") */}
        <select
          name="curso"
          value={selectedFilters.curso}
          onChange={onFilterChange}
          className={styles.filterSelect}
        >
          <option value="todos">Todos os Cursos</option>
          {cursosList.map((c, i) => (
            <option key={`${c}-${i}`} value={c}>{beautifyLabel(c)}</option>
          ))}
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

        {/* 4. Perguntas (agora usa a lista filtrada 'availableQuestions') */}
        <select
          name="pergunta"
          value={selectedFilters.pergunta}
          onChange={onFilterChange}
          className={`${styles.filterSelect} ${styles.filterSelectWide}`}
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
      </div>
    </div>
  );
}