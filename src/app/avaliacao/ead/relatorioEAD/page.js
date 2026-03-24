// src/app/avaliacao/ead/relatorioEAD/page.js

import { Suspense } from 'react';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';
import styles from '../../../../styles/dados.module.css';
import RelatorioEadClient from './relatorio-eadead-client';

// — Next: evitar cache e garantir runtime Node
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// util
const uniqSorted = (arr = []) =>
  [...new Set((arr || []).filter(Boolean))].sort();

const hasLetters = (s) => /[A-Za-zÀ-ÿ]/.test(String(s || ''));
const isBadDisc = (s) => {
  const v = String(s || '').trim();
  if (!v) return true;
  if (v === '-- / 0' || v === '--/0' || v === '--' || v === '-' || v === '—' || v === '0') return true;
  if (/^[\s–—\-_/]*0?\s*$/.test(v)) return true;
  if (/^--/.test(v) || /\/\s*0$/.test(v)) return true;
  if (!hasLetters(v)) return true;
  return false;
};

// Carrega e prepara filtros por ano a partir dos CSVs
async function getFiltersByYear() {
  const baseDir = path.join(process.cwd(), 'src', 'app', 'banco');
  const filtersByYear = {};
  const reportDataByYear = {};
  const anos = new Set();

  // 2025
  try {
    const file2025 = path.join(
      baseDir,
      'AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2025-2.csv'
    );
    const csvData = fs.readFileSync(file2025, 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const data2025 = parsed.data || [];

    const polos = uniqSorted(
      data2025.map((r) => r['Qual o seu Polo de Vinculação?'])
    );
    const cursos = uniqSorted(
      data2025.map((r) => r['Qual é o seu Curso?'])
    );

    const qHeadersFull = (parsed.meta?.fields || [])
      .filter((h) => /^\d+\)/.test(String(h || '')) && !String(h || '').includes('['));

    filtersByYear['2025'] = {
      hasPolos: polos.length > 0,
      polos,
      cursos,
    };

    reportDataByYear['2025'] = {
      rows: data2025,
      qHeadersFull,
    };

    anos.add('2025');
  } catch (e) {
    console.warn('Aviso ao carregar dados de 2025:', e?.message);
  }

  // 2023
  try {
    const file2023 = path.join(
      baseDir,
      'AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2023-4 .csv'
    );
    const csv2023 = fs.readFileSync(file2023, 'utf8');
    const parsed2023 = Papa.parse(csv2023, { header: false, skipEmptyLines: true });
    const rows = parsed2023.data || [];

    if (rows.length) {
      const isScore = (v) => ['1', '2', '3', '4', '5', 1, 2, 3, 4, 5].includes(v);
      const sampleRow = rows.find((r) => r.some((v) => isScore(v))) || rows[1] || rows[0];

      let startIdx = 0;
      for (let i = 0; i < sampleRow.length; i++) {
        if (isScore(sampleRow[i])) {
          startIdx = i;
          break;
        }
      }

      const idxCurso = 1;
      const disciplinaCols = [];
      for (let i = 2; i < startIdx; i++) disciplinaCols.push(i);

      const cursoSet = new Set();
      const disciplinasSet = new Set();

      const numQuestions = sampleRow.length - startIdx;
      const qHeaders = Array.from({ length: numQuestions }, (_, i) => `${i + 1})`);

      const rowsNorm2023 = rows
        .filter((r) => r && r.length)
        .map((r) => {
          const cursoVal = (r[idxCurso] || '').toString().trim();
          if (cursoVal && !/^qual\b/i.test(cursoVal)) cursoSet.add(cursoVal);

          let discVal = '';
          for (const c of disciplinaCols) {
            if (r[c] && String(r[c]).trim()) {
              discVal = String(r[c]).trim();
              break;
            }
          }
          if (discVal && !isBadDisc(discVal)) disciplinasSet.add(discVal);

          const obj = { curso: cursoVal, disciplina: discVal };
          qHeaders.forEach((h, i) => {
            const raw = r[startIdx + i];
            const n = Number(raw);
            obj[h] = Number.isFinite(n) ? n : null;
          });
          return obj;
        });

      const cursos = uniqSorted([...cursoSet].filter((c) => c && !/^qual\b/i.test(c)));
      const disciplinas = uniqSorted([...disciplinasSet].filter((d) => d && !isBadDisc(d)));

      filtersByYear['2023'] = {
        hasPolos: false,
        polos: [],
        cursos,
      };

      reportDataByYear['2023'] = {
        rows: rowsNorm2023,
        qHeadersFull: qHeaders,
        disciplinas,
      };

      anos.add('2023');
    }
  } catch (e) {
    console.warn('Aviso ao carregar dados de 2023:', e?.message);
  }

  const anosDisponiveis = [...anos].sort((a, b) => Number(b) - Number(a));
  return { filtersByYear, reportDataByYear, anosDisponiveis };
}

// Componente assíncrono que lê os CSVs e injeta os searchParams iniciais
async function RelatorioLoader({ searchParamsResolved }) {
  const { filtersByYear, reportDataByYear, anosDisponiveis } = await getFiltersByYear();

  if (!anosDisponiveis.length) {
    return (
      <p className={styles.errorMessage}>
        Não foi possível carregar os filtros. Verifique os arquivos CSV em{' '}
        <code>src/app/banco</code>.
      </p>
    );
  }

  const initialSelected = {
    ano: searchParamsResolved?.ano || '',
    curso: searchParamsResolved?.curso || '',
    polo: searchParamsResolved?.polo || '',
  };

  return (
    <RelatorioEadClient
      filtersByYear={filtersByYear}
      reportDataByYear={reportDataByYear}
      anosDisponiveis={anosDisponiveis}
      initialSelected={initialSelected}
    />
  );
}

// Página
export default async function Page({ searchParams }) {
  const sp =
    typeof searchParams?.then === 'function'
      ? await searchParams
      : (searchParams || {});

  return (
    <div className={styles.mainContent}>
      <h1 className={styles.title}>Gerar Relatório — AVALIA EAD</h1>

      <Suspense
        fallback={
          <p className={styles.loadingMessage}>
            Carregando interface do relatório...
          </p>
        }
      >
        <RelatorioLoader searchParamsResolved={sp} />
      </Suspense>
    </div>
  );
}