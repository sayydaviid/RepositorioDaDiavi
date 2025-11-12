// src/app/avaliacao/avalia/presencial/relatorio/page.js

import { Suspense } from 'react';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';
import styles from '../../../../../styles/dados.module.css';
import RelatorioPresencialClient from './relatorio-presencial-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const uniqSorted = (arr = []) => [...new Set((arr || []).filter(Boolean))].sort();

async function getFiltersByYear() {
  const baseDir = path.join(process.cwd(), 'src', 'app', 'banco');
  const filtersByYear = {};
  const anos = new Set();

  // Tenta carregar CSVs conhecidos
  const candidates = [
    'AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2025-2.csv',
    'AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2023-4 .csv'
  ];

  for (const file of candidates) {
    try {
      const p = path.join(baseDir, file);
      if (!fs.existsSync(p)) continue;
      const csv = fs.readFileSync(p, 'utf8');
      const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
      const data = parsed.data || [];
      if (!data.length) continue;
      const anoMatch = (file.match(/(\d{4})/) || [])[0] || file;
      const cursos = uniqSorted(data.map(r => r['Qual é o seu Curso?'] || r['Curso'] || r['curso']));
      const polos = uniqSorted(data.map(r => r['Qual o seu Polo de Vinculação?'] || r['Polo'] || r['polo']));
      filtersByYear[anoMatch] = { hasPolos: polos.length > 0, polos, cursos };
      anos.add(anoMatch);
    } catch (e) {
      console.warn('Falha ao ler', file, e?.message);
    }
  }

  const anosDisponiveis = [...anos].sort((a, b) => Number(b) - Number(a));
  return { filtersByYear, anosDisponiveis };
}

async function RelatorioLoader({ searchParamsResolved }) {
  const { filtersByYear, anosDisponiveis } = await getFiltersByYear();

  if (!anosDisponiveis.length) {
    return <p className={styles.errorMessage}>Nenhum ano disponível — verifique os CSVs em <code>src/app/banco</code>.</p>;
  }

  const initialSelected = {
    ano: searchParamsResolved?.ano || '',
    curso: searchParamsResolved?.curso || '',
    polo: searchParamsResolved?.polo || '',
  };

  return (
    <RelatorioPresencialClient
      filtersByYear={filtersByYear}
      anosDisponiveis={anosDisponiveis}
      initialSelected={initialSelected}
    />
  );
}

export default async function Page({ searchParams }) {
  const sp = typeof searchParams?.then === 'function' ? await searchParams : searchParams || {};

  return (
    <div className={styles.mainContent}>
      <h1 className={styles.title}>Gerar Relatório — AVALIA Presencial</h1>
      <Suspense fallback={<p className={styles.loadingMessage}>Carregando interface do relatório...</p>}>
        <RelatorioLoader searchParamsResolved={sp} />
      </Suspense>
    </div>
  );
}
