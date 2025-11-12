'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import EadFilters from '../avalia/components/EadFilters';
import ActivityChart from '../avalia/components/ActivityChart';
import styles from '../../../styles/dados.module.css';
import { questionMapEad } from '../../avaliacao/lib/questionMappingEad';
import StatCard from '../avalia/components/StatCard';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import BoxplotChart from '../avalia/components/BoxplotChart';

// ---------------- Utils ----------------
function truncateText(text, maxLength = 20) {
  if (typeof text !== 'string' || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
const CONCEITOS = ['Excelente', 'Bom', 'Regular', 'Insuficiente'];
const NUM_TO_CONCEITO_2023 = { 1: 'Insuficiente', 2: 'Regular', 3: 'Bom', 4: 'Excelente' };

function sanitizeList(list = []) {
  const hasLetters = (s) => /[A-Za-zÀ-ÿ]/.test(String(s || ''));

  const isBad = (s) => {
    const v = String(s || '').trim();
    if (!v) return true;
    if (v === 'todos') return true;
    if (/^qual\b/i.test(v)) return true;   // "Qual é o seu Curso?" etc.
    // placeholders/ruídos
    if (v === '-- / 0' || v === '--/0' || v === '--' || v === '-' || v === '—' || v === '0') return true;
    if (/^[\s–—\-_/]*0?\s*$/.test(v)) return true; // só traços/barras/zeros
    if (/^--/.test(v) || /\/\s*0$/.test(v)) return true; // começa com "--" ou termina com "/ 0"

    // ✅ mantenha itens com letras OU com 2–4 dígitos (ex.: anos 2025, 2023)
    if (!hasLetters(v) && !/^\d{2,4}$/.test(v)) return true;

    return false;
  };

  return (Array.isArray(list) ? list : [])
    .map(v => (typeof v === 'string' ? v.trim() : v))
    .filter(v => !isBad(v));
}


function uniqueSorted(arr = []) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}

function getQHeadersFromRows2023(rows) {
  if (!rows || !rows.length) return [];
  const any = rows.find(r => r && typeof r === 'object') || {};
  const nums = Object.keys(any)
    .map(k => {
      const m = /^(\d+)\)/.exec(k);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter(Boolean);
  const max = nums.length ? Math.max(...nums) : 45;
  return Array.from({ length: max }, (_, i) => `${i + 1})`);
}

/* ================== helpers de identificação p/ contagem ================== */
function getIdKeyForYear(year, sampleRow) {
  if (year === '2025') {
    if (sampleRow && 'Nome de usuário' in sampleRow) return 'Nome de usuário';
  }
  // 2023 ou fallback: usa timestamp se existir
  if (sampleRow && 'Carimbo de data/hora' in sampleRow) return 'Carimbo de data/hora';
  return null;
}

function countUniqueRespondentsByYear(year, rows) {
  if (!rows || !rows.length) return 0;
  const key = getIdKeyForYear(year, rows[0]);
  if (!key) return rows.length;
  const set = new Set();
  for (const r of rows) {
    const v = r?.[key];
    if (v != null && v !== '') set.add(String(v));
  }
  return set.size || rows.length;
}

/* ============ helpers para boxplot e estatísticas ============ */
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

// NOVO: Função para calcular estatísticas descritivas
function calculateDescriptiveStats(label, values) {
  const v = (values || []).filter(n => Number.isFinite(n));
  const count = v.length;

  if (count === 0) {
    return { item: label, count: 0, mean: 0, stdDev: 0, min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }

  const mean = v.reduce((a, b) => a + b, 0) / count;
  const stdDev = Math.sqrt(v.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / count);
  const sorted = [...v].sort((a, b) => a - b);

  return {
    item: label,
    count,
    mean: round2(mean),
    stdDev: round2(stdDev),
    min: round2(sorted[0]),
    q1: round2(percentile(sorted, 0.25)),
    median: round2(percentile(sorted, 0.5)),
    q3: round2(percentile(sorted, 0.75)),
    max: round2(sorted[count - 1]),
  };
}

function buildApexBoxplotFromValues(label, values, forceNumericX = false) {
  const v = (values || []).filter(n => Number.isFinite(n));
  if (!v.length) {
    return {
      boxplot_data: [{ x: forceNumericX ? Number(label) : label, y: [0, 0, 0, 0, 0] }],
      outliers_data: []
    };
  }
  const s = [...v].sort((a, b) => a - b);
  const q1_raw = percentile(s, 0.25);
  const med_raw = percentile(s, 0.5);
  const q3_raw = percentile(s, 0.75);
  const iqr_raw = q3_raw - q1_raw;
  const lowerFence = q1_raw - 1.5 * iqr_raw;
  const upperFence = q3_raw + 1.5 * iqr_raw;
  const inliers = s.filter(x => x >= lowerFence && x <= upperFence);
  let whiskerMin = inliers.length ? Math.min(...inliers) : s[0];
  let whiskerMax = inliers.length ? Math.max(...inliers) : s[s.length - 1];

  const EPS = 0.06;
  let q1 = q1_raw;
  let med = med_raw;
  let q3 = q3_raw;

  if (q3 - q1 < EPS) {
    q1 = Math.max(1.0, med_raw - EPS / 2);
    q3 = Math.min(4.0, med_raw + EPS / 2);
    whiskerMin = Math.min(whiskerMin, q1);
    whiskerMax = Math.max(whiskerMax, q3);
  }

  whiskerMin = Math.max(1.0, Math.min(whiskerMin, 4.0));
  whiskerMax = Math.max(1.0, Math.min(whiskerMax, 4.0));
  q1 = Math.max(1.0, Math.min(q1, 4.0));
  med = Math.max(1.0, Math.min(med, 4.0));
  q3 = Math.max(1.0, Math.min(q3, 4.0));

  const outliers = s.filter(x => x < whiskerMin || x > whiskerMax);
  const xLabel = forceNumericX ? Number(label) : label;

  return {
    boxplot_data: [{ x: xLabel, y: [whiskerMin, q1, med, q3, whiskerMax] }],
    outliers_data: outliers.map(val => ({ x: xLabel, y: val }))
  };
}

/* ========= helper para quebrar labels longas ========= */
function wrapWords(label, maxLen = 18) {
  if (!label) return [''];
  const words = String(label).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (tryLine.length > maxLen) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = tryLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}
const wrapForApex = (label) => wrapWords(label).join('\n');

/* ---------- Formatação para os gráficos ---------- */
function formatProporcoesChartData(apiData) {
  if (!apiData || !apiData.length) return { labels: [], datasets: [] };
  const labels = [...new Set(apiData.map(item => item.dimensao))];
  const colorMap = { Excelente: '#1D556F', Bom: '#288FB4', Regular: '#F0B775', Insuficiente: '#FA360A' };
  const datasets = CONCEITOS.map(conceito => ({
    label: conceito,
    data: labels.map(label => {
      const item = apiData.find(d => d.dimensao === label && d.conceito === conceito);
      return item ? item.valor : 0;
    }),
    backgroundColor: colorMap[conceito]
  }));
  return { labels, datasets };
}

function formatProporcoesItensChartData(apiData) {
  if (!apiData || !apiData.length) return { labels: [], datasets: [] };
  const labels = [...new Set(apiData.map(item => item.item))].sort((a, b) => parseInt(a) - parseInt(b));
  const colorMap = { Excelente: '#1D556F', Bom: '#288FB4', Regular: '#F0B775', Insuficiente: '#FA360A' };
  const datasets = CONCEITOS.map(conceito => ({
    label: conceito,
    data: labels.map(label => {
      const item = apiData.find(d => d.item === label && d.conceito === conceito);
      return item ? item.valor : 0;
    }),
    backgroundColor: colorMap[conceito]
  }));
  return { labels, datasets };
}

const round2 = (n) => (Number.isFinite(n) ? Number(n.toFixed(2)) : n);

/* ---------- Reagregadores ---------- */
function aggregateFromRows2025(rows, qHeadersFull) {
  const headers = Array.isArray(qHeadersFull) && qHeadersFull.length ? qHeadersFull : [];

  const toScoreKey = (ans) => {
    if (!ans) return null;
    const a = String(ans).trim();
    if (a.startsWith('Excelente')) return 'Excelente';
    if (a.startsWith('Bom')) return 'Bom';
    if (a.startsWith('Regular')) return 'Regular';
    if (a.startsWith('Insuficiente')) return 'Insuficiente';
    if (/^n(ã|a)o se aplica/i.test(a)) return null;
    return null;
  };
  const toScoreVal = (ans) => {
    if (!ans) return null;
    const a = String(ans).trim();
    if (a.startsWith('Excelente')) return 4;
    if (a.startsWith('Bom')) return 3;
    if (a.startsWith('Regular')) return 2;
    if (a.startsWith('Insuficiente')) return 1;
    if (/^n(ã|a)o se aplica/i.test(a)) return null;
    return null;
  };

  const dims = {
    'Autoavaliação Discente': headers.slice(0, 13),
    'Avaliação da Ação Docente': headers.slice(13, 35),
    'Instalações Físicas e Recursos de TI': headers.slice(35, 45)
  };

  const dimensoes = [];
  Object.entries(dims).forEach(([dim, hs]) => {
    const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
    let total = 0;
    rows.forEach(r => {
      hs.forEach(h => {
        const c = toScoreKey(r[h]);
        if (c) { counts[c]++; total++; }
      });
    });
    CONCEITOS.forEach(c => dimensoes.push({
      dimensao: dim, conceito: c, valor: total ? (counts[c] / total) * 100 : 0
    }));
  });

  const mediasPorDim = [];
  const boxplotDimRaw = [];
  Object.entries(dims).forEach(([dim, hs]) => {
    let sum = 0, count = 0;
    const perRespondent = [];
    rows.forEach(r => {
      const vals = hs.map(h => toScoreVal(r[h])).filter(v => v != null);
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        perRespondent.push(avg);
        sum += vals.reduce((a, b) => a + b, 0);
        count += vals.length;
      }
    });
    mediasPorDim.push({ dimensao: dim, media: count ? sum / count : 0 });
    boxplotDimRaw.push({ dimensao: dim, values: perRespondent });
  });

  const mediasForHeaders = (hs, offset) => hs.map((h, idx) => {
    const vals = rows.map(r => toScoreVal(r[h])).filter(v => v != null);
    const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { item: String(offset + idx + 1), media };
  });

  const boxplotForHeaders = (hs, offset) => hs.map((h, idx) => {
    const values = rows.map(r => toScoreVal(r[h])).filter(v => v != null);
    return { item: String(offset + idx + 1), values };
  });

  const mediasItensAuto = mediasForHeaders(dims['Autoavaliação Discente'], 0);
  const boxplotItensAutoRaw = boxplotForHeaders(dims['Autoavaliação Discente'], 0);

  const mediasItensAtitude = mediasForHeaders(headers.slice(13, 19), 13);
  const boxplotItensAtitudeRaw = boxplotForHeaders(headers.slice(13, 19), 13);

  const mediasItensGestao = mediasForHeaders(headers.slice(19, 30), 19);
  const boxplotItensGestaoRaw = boxplotForHeaders(headers.slice(19, 30), 19);

  const mediasItensProcesso = mediasForHeaders(headers.slice(30, 35), 30);
  const boxplotItensProcessoRaw = boxplotForHeaders(headers.slice(30, 35), 30);

  const mediasItensInfra = mediasForHeaders(headers.slice(35, 45), 35);
  const boxplotItensInfraRaw = boxplotForHeaders(headers.slice(35, 45), 35);

  const makeItens = (hs, offset = 0) => hs.flatMap((h, idx) => {
    const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
    let total = 0;
    rows.forEach(r => {
      const c = toScoreKey(r[h]);
      if (c) { counts[c]++; total++; }
    });
    const item = String(offset + idx + 1);
    return CONCEITOS.map(c => ({
      item, conceito: c, valor: total ? (counts[c] / total) * 100 : 0
    }));
  });

  // Geração das tabelas de estatísticas
  const boxplotDimStats = boxplotDimRaw.map(d => calculateDescriptiveStats(d.dimensao, d.values));
  const boxplotAutoStats = boxplotItensAutoRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotAtitudeStats = boxplotItensAtitudeRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotGestaoStats = boxplotItensGestaoRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotProcessoStats = boxplotItensProcessoRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotInfraStats = boxplotItensInfraRaw.map(d => calculateDescriptiveStats(d.item, d.values));

  return {
    dimensoes,
    mediasPorDim,
    boxplotDimRaw,
    boxplotDimStats,

    autoavaliacaoItens: makeItens(dims['Autoavaliação Discente'], 0),
    mediasItensAuto,
    boxplotItensAutoRaw,
    boxplotAutoStats,

    acaoDocenteAtitude: makeItens(headers.slice(13, 19), 13),
    mediasItensAtitude,
    boxplotItensAtitudeRaw,
    boxplotAtitudeStats,

    acaoDocenteGestao: makeItens(headers.slice(19, 30), 19),
    mediasItensGestao,
    boxplotItensGestaoRaw,
    boxplotGestaoStats,
    
    acaoDocenteProcesso: makeItens(headers.slice(30, 35), 30),
    mediasItensProcesso,
    boxplotItensProcessoRaw,
    boxplotProcessoStats,

    infraestruturaItens: makeItens(dims['Instalações Físicas e Recursos de TI'], 35),
    mediasItensInfra,
    boxplotItensInfraRaw,
    boxplotInfraStats,
  };
}

function aggregateFromRows2023(rows, qHeaders) {
  const toKey = (n) => NUM_TO_CONCEITO_2023[n] ?? null;
  const toVal = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v === 5) return null;
    return v;
  };

  const endAuto = Math.min(13, qHeaders.length);
  const endAcao = Math.min(35, qHeaders.length);
  const endInfra = Math.min(43, qHeaders.length);

  const dims = {
    'Autoavaliação Discente': qHeaders.slice(0, endAuto),
    'Avaliação da Ação Docente': qHeaders.slice(13, endAcao),
    'Instalações Físicas e Recursos de TI': qHeaders.slice(35, endInfra)
  };

  const dimensoes = [];
  Object.entries(dims).forEach(([dim, hs]) => {
    const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
    let total = 0;
    rows.forEach(r => {
      hs.forEach(h => {
        const c = toKey(Number(r[h]));
        if (c) { counts[c]++; total++; }
      });
    });
    CONCEITOS.forEach(c => dimensoes.push({
      dimensao: dim, conceito: c, valor: total ? (counts[c] / total) * 100 : 0
    }));
  });

  const mediasPorDim = [];
  const boxplotDimRaw = [];
  Object.entries(dims).forEach(([dim, hs]) => {
    let sum = 0, count = 0;
    const perRespondent = [];
    rows.forEach(r => {
      const vals = hs.map(h => toVal(r[h])).filter(v => v != null);
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        perRespondent.push(avg);
        sum += vals.reduce((a, b) => a + b, 0);
        count += vals.length;
      }
    });
    mediasPorDim.push({ dimensao: dim, media: count ? sum / count : 0 });
    boxplotDimRaw.push({ dimensao: dim, values: perRespondent });
  });
  
  const mediasForHeaders = (hs) => hs.map((h) => {
    const vals = rows.map(r => toVal(r[h])).filter(v => v != null);
    const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { item: h.replace(')', ''), media };
  });

  const boxplotForHeaders = (hs) => hs.map((h) => {
    const values = rows.map(r => toVal(r[h])).filter(v => v != null);
    return { item: h.replace(')', ''), values };
  });
  
  const mediasItensAuto = mediasForHeaders(dims['Autoavaliação Discente']);
  const boxplotItensAutoRaw = boxplotForHeaders(dims['Autoavaliação Discente']);

  const mediasItensAtitude = mediasForHeaders(qHeaders.slice(13, Math.min(19, qHeaders.length)));
  const boxplotItensAtitudeRaw = boxplotForHeaders(qHeaders.slice(13, Math.min(19, qHeaders.length)));
  
  const mediasItensGestao = mediasForHeaders(qHeaders.slice(19, Math.min(30, qHeaders.length)));
  const boxplotItensGestaoRaw = boxplotForHeaders(qHeaders.slice(19, Math.min(30, qHeaders.length)));

  const mediasItensProcesso = mediasForHeaders(qHeaders.slice(30, Math.min(35, qHeaders.length)));
  const boxplotItensProcessoRaw = boxplotForHeaders(qHeaders.slice(30, Math.min(35, qHeaders.length)));

  const mediasItensInfra = mediasForHeaders(qHeaders.slice(35, Math.min(43, qHeaders.length)));
  const boxplotItensInfraRaw = boxplotForHeaders(qHeaders.slice(35, Math.min(43, qHeaders.length)));

  const makeItens = (hs) => hs.flatMap(h => {
    const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
    let total = 0;
    rows.forEach(r => {
      const c = toKey(Number(r[h]));
      if (c) { counts[c]++; total++; }
    });
    const item = h.replace(')', '');
    return CONCEITOS.map(c => ({
      item, conceito: c, valor: total ? (counts[c] / total) * 100 : 0
    }));
  });

  const boxplotDimStats = boxplotDimRaw.map(d => calculateDescriptiveStats(d.dimensao, d.values));
  const boxplotAutoStats = boxplotItensAutoRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotAtitudeStats = boxplotItensAtitudeRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotGestaoStats = boxplotItensGestaoRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotProcessoStats = boxplotItensProcessoRaw.map(d => calculateDescriptiveStats(d.item, d.values));
  const boxplotInfraStats = boxplotItensInfraRaw.map(d => calculateDescriptiveStats(d.item, d.values));

  return {
    dimensoes,
    mediasPorDim,
    boxplotDimRaw,
    boxplotDimStats,

    autoavaliacaoItens: makeItens(dims['Autoavaliação Discente']),
    mediasItensAuto,
    boxplotItensAutoRaw,
    boxplotAutoStats,

    acaoDocenteAtitude: makeItens(qHeaders.slice(13, Math.min(19, qHeaders.length))),
    mediasItensAtitude,
    boxplotItensAtitudeRaw,
    boxplotAtitudeStats,

    acaoDocenteGestao: makeItens(qHeaders.slice(19, Math.min(30, qHeaders.length))),
    mediasItensGestao,
    boxplotItensGestaoRaw,
    boxplotGestaoStats,
    
    acaoDocenteProcesso: makeItens(qHeaders.slice(30, Math.min(35, qHeaders.length))),
    mediasItensProcesso,
    boxplotItensProcessoRaw,
    boxplotProcessoStats,

    infraestruturaItens: makeItens(dims['Instalações Físicas e Recursos de TI']),
    mediasItensInfra,
    boxplotItensInfraRaw,
    boxplotInfraStats,
  };
}

/* ---------- Cards best/worst ---------- */
function computeBestWorstGroup(year, yearObj) {
  const rows = yearObj?.rows || [];
  if (!rows.length) return { labelType: year === '2025' ? 'Polo' : 'Curso', best: '—', worst: '—', respondentsByGroup: {} };

  if (year === '2025') {
    const headers = yearObj.qHeadersFull || [];
    const groupKey = 'Qual o seu Polo de Vinculação?';
    const idKey = getIdKeyForYear(year, rows[0]);

    const toScore = (ans) => {
      if (!ans) return null;
      const a = String(ans).trim();
      if (a.startsWith('Excelente')) return 4;
      if (a.startsWith('Bom')) return 3;
      if (a.startsWith('Regular')) return 2;
      if (a.startsWith('Insuficiente')) return 1;
      return null;
    };
    const sums = new Map();
    const respondentSets = new Map();

    rows.forEach(r => {
      const g = r[groupKey];
      if (!g) return;

      if (!respondentSets.has(g)) respondentSets.set(g, new Set());
      if (idKey && r[idKey]) respondentSets.get(g).add(r[idKey]);

      headers.forEach(h => {
        const v = toScore(r[h]);
        if (v == null) return;
        const curr = sums.get(g) || { sum: 0, count: 0 };
        curr.sum += v;
        curr.count += 1;
        sums.set(g, curr);
      });
    });

    let best = '—', worst = '—', bestAvg = -Infinity, worstAvg = Infinity;
    for (const [g, { sum, count }] of sums) {
      if (!count) continue;
      const avg = sum / count;
      if (avg > bestAvg) { bestAvg = avg; best = g; }
      if (avg < worstAvg) { worstAvg = avg; worst = g; }
    }
    
    const respondentsByGroup = {};
    for (const [g, set] of respondentSets) {
      respondentsByGroup[g] = set.size;
    }

    return { labelType: 'Polo', best, worst, respondentsByGroup };
  } else {
    // === 2023: usa chave de curso dinâmica ===
    const courseKey = rows[0]?.['Qual é o seu Curso?'] !== undefined ? 'Qual é o seu Curso?' : 'curso';
    const headers = getQHeadersFromRows2023(rows);
    const usedHeaders = headers.slice(0, Math.min(43, headers.length));
    const toScore = (n) => Number.isFinite(Number(n)) && Number(n) !== 5 ? Number(n) : null;
    const sums = new Map();
    rows.forEach(r => {
      const g = r[courseKey];
      if (!g || (typeof g === 'string' && /^qual\b/i.test(g))) return;
      usedHeaders.forEach(h => {
        const v = toScore(r[h]);
        if (v == null) return;
        const curr = sums.get(g) || { sum: 0, count: 0 };
        curr.sum += v;
        curr.count += 1;
        sums.set(g, curr);
      });
    });
    let best = '—', worst = '—', bestAvg = -Infinity, worstAvg = Infinity;
    for (const [g, { sum, count }] of sums) {
      if (!count) continue;
      const avg = sum / count;
      if (avg > bestAvg) { bestAvg = avg; best = g; }
      if (avg < worstAvg) { worstAvg = avg; worst = g; }
    }
    return { labelType: 'Curso', best, worst, respondentsByGroup: {} }; // 2023 não tem grupo de polo
  }
}

/* ===== Helpers: dependência de filtros (curso -> disciplinas; polo -> disciplinas em 2025) ===== */
function buildFilterOptionsDependent(initialDataByYear, filtersOptions, selectedFilters) {
  const year = selectedFilters.ano;
  const yearObj = initialDataByYear?.[year] || {};
  const rows = yearObj.rows || [];

  const anos = sanitizeList(filtersOptions.anos);
  const dimensoes = sanitizeList(filtersOptions.dimensoes);
  const courseKey2025 = 'Qual é o seu Curso?';
  const poloKey2025 = 'Qual o seu Polo de Vinculação?';
  const courseKey2023 = rows[0]?.['Qual é o seu Curso?'] !== undefined ? 'Qual é o seu Curso?' : 'curso';
  const disciplinaKeys2023 = Object.keys(rows[0] || {}).filter(k => k.startsWith('Selecione para qual disciplina'));
  const allCursos =
    year === '2025'
      ? uniqueSorted(rows.map(r => r?.[courseKey2025]))
      : uniqueSorted(rows.map(r => r?.[courseKey2023]));
  const allPolos =
    year === '2025'
      ? uniqueSorted(rows.map(r => r?.[poloKey2025]))
      : [];

  let rowsForDisc = rows;
  if (year === '2025') {
    if (selectedFilters.curso !== 'todos') {
      rowsForDisc = rowsForDisc.filter(r => r?.[courseKey2025] === selectedFilters.curso);
    }
    if (selectedFilters.polo !== 'todos') {
      rowsForDisc = rowsForDisc.filter(r => r?.[poloKey2025] === selectedFilters.polo);
    }
  } else {
    if (selectedFilters.curso !== 'todos') {
      rowsForDisc = rowsForDisc.filter(r => r?.[courseKey2023] === selectedFilters.curso);
    }
  }

  let disciplinasValidas = [];
  if (year === '2025') {
    const discCols = Object.keys(rows[0] || {}).filter(k => k.startsWith('Selecione para qual disciplina'));
    disciplinasValidas = uniqueSorted(
      rowsForDisc.flatMap(r => discCols.map(k => r?.[k]).filter(Boolean))
    );
  } else {
    if (disciplinaKeys2023.length) {
      disciplinasValidas = uniqueSorted(
        rowsForDisc.flatMap(r => disciplinaKeys2023.map(k => r?.[k]).filter(Boolean))
      );
    } else {
      disciplinasValidas = uniqueSorted(rowsForDisc.map(r => r?.disciplina));
    }
  }

  return {
    anos,
    dimensoes,
    polos: year === '2025' ? sanitizeList(allPolos) : [],
    cursos: sanitizeList(allCursos),
    disciplinas: sanitizeList(disciplinasValidas)
  };
}

export default function EadDashboardClient({
  initialData,
  filtersOptions,
  initialDataByYear,
  defaultYear = '2025'
}) {
  const [activeTab, setActiveTab] = useState('dimensoes');
  const [selectedFilters, setSelectedFilters] = useState({
    ano: defaultYear,
    dimensao: 'todos',
    polo: 'todos',
    curso: 'todos',
    disciplina: 'todos'
  });

  const searchParams = useSearchParams();
  const embedForPdf = searchParams.get('embedForPdf') === '1';
  const getDataForYear = (year) =>
    (initialDataByYear && initialDataByYear[year]) ? initialDataByYear[year] : initialData;
  const [dashboardData, setDashboardData] = useState(getDataForYear(selectedFilters.ano));

  useEffect(() => {
    const year = selectedFilters.ano;
    const yearData = getDataForYear(year);
    setDashboardData(yearData);
    const foYear = initialDataByYear?.[year]?.filtersOptionsYear || {};
    const polos = year === '2023' ? [] : sanitizeList(foYear.polos || filtersOptions.polos);
    const cursos = sanitizeList(foYear.cursos || filtersOptions.cursos);
    const disciplinas = sanitizeList(foYear.disciplinas || filtersOptions.disciplinas);
    setSelectedFilters(prev => ({
      ...prev,
      polo: (year === '2023' || !polos.includes(prev.polo)) ? 'todos' : prev.polo,
      curso: (!cursos.includes(prev.curso)) ? 'todos' : prev.curso,
      disciplina: (!disciplinas.includes(prev.disciplina)) ? 'todos' : prev.disciplina
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilters.ano]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setSelectedFilters(prev => ({ ...prev, [name]: value }));
  };

  const filtersForUi = useMemo(() => {
    const f = buildFilterOptionsDependent(initialDataByYear, filtersOptions, selectedFilters);
    if (selectedFilters.disciplina !== 'todos' && !f.disciplinas.includes(selectedFilters.disciplina)) {
      setSelectedFilters(prev => ({ ...prev, disciplina: 'todos' }));
    }
    if (selectedFilters.polo !== 'todos' && !f.polos.includes(selectedFilters.polo)) {
      setSelectedFilters(prev => ({ ...prev, polo: 'todos' }));
    }
    if (selectedFilters.curso !== 'todos' && !f.cursos.includes(selectedFilters.curso)) {
      setSelectedFilters(prev => ({ ...prev, curso: 'todos' }));
    }
    return f;
  }, [initialDataByYear, filtersOptions, selectedFilters]);

  const recalculated = useMemo(() => {
    const year = selectedFilters.ano;
    const yearObj = initialDataByYear?.[year];
    const rows = yearObj?.rows;

    const emptyState = {
      filteredRows: [],
      totalRespondentes: 0
    };

    if (!rows || !rows.length) return emptyState;

    const cursoSel = selectedFilters.curso;
    const poloSel = selectedFilters.polo;
    const discSel = selectedFilters.disciplina;
    let filtered = rows;

    if (year === '2025') {
      if (cursoSel !== 'todos') filtered = filtered.filter(r => r['Qual é o seu Curso?'] === cursoSel);
      if (poloSel !== 'todos') filtered = filtered.filter(r => r['Qual o seu Polo de Vinculação?'] === poloSel);
      if (discSel !== 'todos') {
        filtered = filtered.filter(r => {
          const keys = Object.keys(r).filter(k => k.startsWith('Selecione para qual disciplina'));
          return keys.some(k => r[k] === discSel);
        });
      }
      const qHeadersFull = yearObj?.qHeadersFull || [];
      const agg = aggregateFromRows2025(filtered, qHeadersFull);
      return {
        ...agg,
        filteredRows: filtered,
        totalRespondentes: countUniqueRespondentsByYear(year, filtered)
      };
    } else { // 2023
      const courseKey = rows[0]?.['Qual é o seu Curso?'] !== undefined ? 'Qual é o seu Curso?' : 'curso';
      const disciplinaKeys = Object.keys(rows[0] || {}).filter(k => k.startsWith('Selecione para qual disciplina'));

      if (cursoSel !== 'todos') filtered = filtered.filter(r => r[courseKey] === cursoSel);
      if (discSel !== 'todos') {
        if (disciplinaKeys.length) {
          filtered = filtered.filter(r => disciplinaKeys.some(k => r[k] === discSel));
        } else {
          filtered = filtered.filter(r => r.disciplina === discSel);
        }
      }
      const qHeaders = getQHeadersFromRows2023(filtered);
      const agg = aggregateFromRows2023(filtered, qHeaders);
      return {
        ...agg,
        filteredRows: filtered,
        totalRespondentes: countUniqueRespondentsByYear(year, filtered)
      };
    }
  }, [initialDataByYear, selectedFilters]);

  const chartData = useMemo(() => {
    const mediasLabels = (recalculated.mediasPorDim || []).map(d => d.dimensao);
    const mediasValues = (recalculated.mediasPorDim || []).map(d => round2(d.media));
    const boxRaw = recalculated.boxplotDimRaw || [];
    const all = boxRaw.map(item =>
      buildApexBoxplotFromValues(wrapForApex(item.dimensao), item.values)
    );
    const boxplot_data = all.flatMap(o => o.boxplot_data);
    const outliers_data = all.flatMap(o => o.outliers_data);

    const processBoxplotRaw = (rawItems = []) => {
      const sorted = [...rawItems].sort((a,b) => Number(a.item) - Number(b.item));
      const allBoxes = sorted.map(it => buildApexBoxplotFromValues(it.item, it.values, true));
      return {
        boxplot_data: allBoxes.flatMap(o => o.boxplot_data),
        outliers_data: allBoxes.flatMap(o => o.outliers_data)
      };
    };
    
    const mapMedias = (arr = []) => ({
      labels: arr.map(i => i.item).sort((a,b) => Number(a) - Number(b)),
      datasets: [{ label: 'Média', data: arr.map(i => round2(i.media)), backgroundColor: 'rgba(40, 143, 180, 0.7)' }]
    });

    return {
      dimensoes: formatProporcoesChartData(recalculated.dimensoes || []),
      mediasDimensoes: {
        labels: mediasLabels.map(lbl => wrapWords(lbl)),
        datasets: [{ label: 'Média', data: mediasValues, backgroundColor: 'rgba(40, 143, 180, 0.7)' }]
      },
      boxplotDimApex: { boxplot_data, outliers_data },
      autoavaliacao: formatProporcoesItensChartData(recalculated.autoavaliacaoItens || []),
      mediasItensAuto: mapMedias(recalculated.mediasItensAuto),
      boxplotAutoApex: processBoxplotRaw(recalculated.boxplotItensAutoRaw),
      acaoDocenteAtitude: formatProporcoesItensChartData(recalculated.acaoDocenteAtitude || []),
      mediasItensAtitude: mapMedias(recalculated.mediasItensAtitude),
      boxplotAtitudeApex: processBoxplotRaw(recalculated.boxplotItensAtitudeRaw),
      acaoDocenteGestao: formatProporcoesItensChartData(recalculated.acaoDocenteGestao || []),
      mediasItensGestao: mapMedias(recalculated.mediasItensGestao),
      boxplotGestaoApex: processBoxplotRaw(recalculated.boxplotItensGestaoRaw),
      acaoDocenteProcesso: formatProporcoesItensChartData(recalculated.acaoDocenteProcesso || []),
      mediasItensProcesso: mapMedias(recalculated.mediasItensProcesso),
      boxplotProcessoApex: processBoxplotRaw(recalculated.boxplotItensProcessoRaw),
      infraestruturaItens: formatProporcoesItensChartData(recalculated.infraestruturaItens || []),
      mediasItensInfra: mapMedias(recalculated.mediasItensInfra),
      boxplotInfraApex: processBoxplotRaw(recalculated.boxplotItensInfraRaw),
    };
  }, [recalculated]);

  const bestWorst = useMemo(() => {
    const year = selectedFilters.ano;
    const yearObj = initialDataByYear?.[year];
    return computeBestWorstGroup(year, yearObj);
  }, [initialDataByYear, selectedFilters.ano]);

  const tabs = [
    { key: 'dimensoes', label: 'Dimensões Gerais' },
    { key: 'autoavaliacao', label: 'Autoavaliação Discente' },
    { key: 'atitude', label: 'Atitude Profissional' },
    { key: 'gestao', label: 'Gestão Didática' },
    { key: 'processo', label: 'Processo Avaliativo' },
    { key: 'infraestrutura', label: 'Instalações Físicas e Recursos de TI' }
  ];

  const dimensoesOptions = {
    layout: { padding: { top: 25 } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.dataset?.label || ''}: ${Number(c.parsed?.y || 0).toFixed(2)}` } },
      datalabels: { display: 'auto', formatter: (v) => (v > 0 ? v.toFixed(2) : ''), font: { size: 9 }, anchor: 'end', align: 'top', offset: 4, color: '#333' }
    },
    scales: { y: { max: 100 } }
  };

  const mediasOptions = {
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 4, ticks: { font: { size: 10 }, callback: (v) => Number(v).toFixed(2) } },
      x: { ticks: { font: { size: 10 }, autoSkip: false, maxRotation: 0, minRotation: 0 } }
    }
  };

  const proporcoesItensOptions = {
    layout: { padding: { top: 25 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (ti) => questionMapEad[ti?.[0]?.label] || `Item ${ti?.[0]?.label}`,
          label: (c) => `${c.dataset?.label || ''}: ${Number(c.parsed?.y || 0).toFixed(2)}`
        }
      },
      datalabels: { display: 'auto', formatter: v => (v > 0 ? v.toFixed(2) : ''), font: { size: 8 }, anchor: 'end', align: 'top', offset: 4, color: '#333' }
    },
    scales: { y: { max: 100 } }
  };

  const mediasItensOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (ti) => questionMapEad[ti?.[0]?.label] || `Item ${ti?.[0]?.label}`,
          label: (c) => `Média: ${Number(c.parsed?.y || 0).toFixed(2)}`
        }
      }
    },
    scales: { y: { min: 0, max: 4, ticks: { callback: (v) => Number(v).toFixed(2) } } }
  };

  const gridDimensoes = { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gridAutoRows: 'minmax(360px, auto)', gap: '16px', alignItems: 'stretch' };
  const leftBig = { gridColumn: '1 / 2', gridRow: '1 / span 2', height: 780 };
  const rightTop = { gridColumn: '2 / 3', gridRow: '1', height: 360 };
  const rightBottom = { gridColumn: '2 / 3', gridRow: '2', height: 420 };

  // NOVO: Layout de 3 linhas para abas com boxplot
  const gridThreeRows = { display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '360px 380px 360px', gap: '12px' };
  const row1 = { gridColumn: '1 / -1', gridRow: '1', height: 360 };
  const row2 = { gridColumn: '1 / -1', gridRow: '2', height: 380 };
  const row3 = { gridColumn: '1 / -1', gridRow: '3', height: 360 };

  // ========= Tabela compacta que aparece SÓ no PDF (embedForPdf) =========
  const StatsTableInline = ({ id, title, rows, labelHeader = 'Item' }) => {
    if (!rows || !rows.length || !embedForPdf) return null;
    const th = {
      border: '1px solid #ddd',
      padding: '4px 6px',
      background: '#f8f8f8',
      textAlign: 'center',
      fontWeight: 600,
      fontSize: 11,
      whiteSpace: 'nowrap',
    };
    const td = {
      border: '1px solid #eee',
      padding: '3px 6px',
      textAlign: 'left',
      fontSize: 11,
      whiteSpace: 'nowrap',
    };
    const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

    return (
      <div id={id} style={{ marginTop: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ maxHeight: 120, overflow: 'auto', border: '1px solid #eee' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>{labelHeader}</th>
                <th style={th}>n</th>
                <th style={th}>média</th>
                <th style={th}>Q1</th>
                <th style={th}>mediana</th>
                <th style={th}>Q3</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.item}</td>
                  <td style={tdNum}>{r.count}</td>
                  <td style={tdNum}>{Number(r.mean ?? 0).toFixed(2)}</td>
                  <td style={tdNum}>{Number(r.q1 ?? 0).toFixed(2)}</td>
                  <td style={tdNum}>{Number(r.median ?? 0).toFixed(2)}</td>
                  <td style={tdNum}>{Number(r.q3 ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  // ================== FIM da tabela inline ==================

  return (
    <>
      <div className={styles.statsGrid}>
        <StatCard title="Total de Respondentes" value={recalculated?.totalRespondentes ?? '...'} icon={<Users />} />
        <StatCard title={`${bestWorst.labelType} mais bem avaliado`} value={truncateText(bestWorst.best) ?? '—'} icon={<TrendingUp />} />
        <StatCard title={`${bestWorst.labelType} menos bem avaliado`} value={truncateText(bestWorst.worst) ?? '—'} icon={<TrendingDown />} />
      </div>

      <div style={{ marginTop: '1rem', marginBottom: '0.75rem' }}>
        <EadFilters filters={filtersForUi} selectedFilters={selectedFilters} onFilterChange={handleFilterChange} />
      </div>

      <div>
        <div className={styles.tabsContainer}>
          {tabs.map(tab => (
            <button key={tab.key} className={activeTab === tab.key ? styles.activeTab : styles.tab} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.chartDisplayArea}>
          {(embedForPdf || activeTab === 'dimensoes') && (
            <div style={gridDimensoes}>
              <div id="chart-dimensoes" className={styles.chartContainer} style={leftBig}>
                <ActivityChart chartData={chartData.dimensoes} title={`Proporções de Respostas por Dimensão (${selectedFilters.ano})`} customOptions={dimensoesOptions} />
              </div>
              <div id="chart-medias-dimensoes" className={styles.chartContainer} style={rightTop}>
                <ActivityChart chartData={chartData.mediasDimensoes} title={`Médias por Dimensão (${selectedFilters.ano})`} customOptions={mediasOptions} />
              </div>
              <div
                id="chart-boxplot-dimensoes"
                className={styles.chartContainer}
                style={{ ...rightBottom, display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: '1 1 auto', minHeight: 270 }}>
                  <BoxplotChart apiData={chartData.boxplotDimApex} title={`Boxplot das Médias por Dimensão (${selectedFilters.ano})`} />
                </div>
                {/* tabela só no PDF */}
                <StatsTableInline
                  id="table-stats-dimensoes"
                  title="Estatísticas — Dimensões"
                  rows={recalculated.boxplotDimStats}
                  labelHeader="Dimensão"
                />
              </div>
            </div>
          )}

          {(embedForPdf || activeTab === 'autoavaliacao') && (
            <div style={gridThreeRows}>
              <div id="chart-proporcoes-autoav" className={styles.chartContainer} style={row1}>
                <ActivityChart chartData={chartData.autoavaliacao} title={`Proporções de Respostas por Item - Autoavaliação Discente (${selectedFilters.ano})`} customOptions={proporcoesItensOptions} />
              </div>
              <div
                id="chart-boxplot-autoav"
                className={styles.chartContainer}
                style={{ ...row2, display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: '1 1 auto', minHeight: 250 }}>
                  <BoxplotChart apiData={chartData.boxplotAutoApex} title="Boxplot das Médias por Item (Autoavaliação)" />
                </div>
                <StatsTableInline
                  id="table-stats-autoav"
                  title="Estatísticas — Autoavaliação"
                  rows={recalculated.boxplotAutoStats}
                />
              </div>
              <div id="chart-medias-itens-autoav" className={styles.chartContainer} style={row3}>
                <ActivityChart chartData={chartData.mediasItensAuto} title={`Médias dos Itens relacionados à Autoavaliação Discente (${selectedFilters.ano})`} customOptions={mediasItensOptions} />
              </div>
            </div>
          )}

          {(embedForPdf || activeTab === 'atitude') && (
            <div style={gridThreeRows}>
              <div id="chart-proporcoes-atitude" className={styles.chartContainer} style={row1}>
                <ActivityChart chartData={chartData.acaoDocenteAtitude} title={`Proporções de Respostas por Item - Atitude Profissional (${selectedFilters.ano})`} customOptions={proporcoesItensOptions} />
              </div>
              <div
                id="chart-boxplot-atitude"
                className={styles.chartContainer}
                style={{ ...row2, display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: '1 1 auto', minHeight: 250 }}>
                  <BoxplotChart apiData={chartData.boxplotAtitudeApex} title="Boxplot das Médias por Item (Atitude Profissional)" />
                </div>
                <StatsTableInline
                  id="table-stats-atitude"
                  title="Estatísticas — Atitude Profissional"
                  rows={recalculated.boxplotAtitudeStats}
                />
              </div>
              <div id="chart-medias-atitude" className={styles.chartContainer} style={row3}>
                <ActivityChart chartData={chartData.mediasItensAtitude} title={`Médias dos Itens relacionados à Atitude Profissional (Discente)`} customOptions={mediasItensOptions} />
              </div>
            </div>
          )}

          {(embedForPdf || activeTab === 'gestao') && (
            <div style={gridThreeRows}>
              <div id="chart-proporcoes-gestao" className={styles.chartContainer} style={row1}>
                <ActivityChart chartData={chartData.acaoDocenteGestao} title={`Proporções de Respostas por Item - Gestão Didática (${selectedFilters.ano})`} customOptions={proporcoesItensOptions} />
              </div>
              <div
                id="chart-boxplot-gestao"
                className={styles.chartContainer}
                style={{ ...row2, display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: '1 1 auto', minHeight: 250 }}>
                  <BoxplotChart apiData={chartData.boxplotGestaoApex} title="Boxplot das Médias por Item (Gestão Didática)" />
                </div>
                <StatsTableInline
                  id="table-stats-gestao"
                  title="Estatísticas — Gestão Didática"
                  rows={recalculated.boxplotGestaoStats}
                />
              </div>
              <div id="chart-medias-gestao" className={styles.chartContainer} style={row3}>
                <ActivityChart chartData={chartData.mediasItensGestao} title={`Médias dos Itens relacionados à Gestão Didática (Discente)`} customOptions={mediasItensOptions} />
              </div>
            </div>
          )}

          {(embedForPdf || activeTab === 'processo') && (
            <div style={gridThreeRows}>
              <div id="chart-proporcoes-processo" className={styles.chartContainer} style={row1}>
                <ActivityChart chartData={chartData.acaoDocenteProcesso} title={`Proporções de Respostas por Item - Processo Avaliativo (${selectedFilters.ano})`} customOptions={proporcoesItensOptions} />
              </div>
              <div
                id="chart-boxplot-processo"
                className={styles.chartContainer}
                style={{ ...row2, display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: '1 1 auto', minHeight: 250 }}>
                  <BoxplotChart apiData={chartData.boxplotProcessoApex} title="Boxplot das Médias por Item (Processo Avaliativo)" />
                </div>
                <StatsTableInline
                  id="table-stats-processo"
                  title="Estatísticas — Processo Avaliativo"
                  rows={recalculated.boxplotProcessoStats}
                />
              </div>
              <div id="chart-medias-processo" className={styles.chartContainer} style={row3}>
                <ActivityChart chartData={chartData.mediasItensProcesso} title={`Médias dos Itens relacionados ao Processo Avaliativo (Discente)`} customOptions={mediasItensOptions} />
              </div>
            </div>
          )}

          {(embedForPdf || activeTab === 'infraestrutura') && (
            <div style={gridThreeRows}>
              <div id="chart-proporcoes-infra" className={styles.chartContainer} style={row1}>
                <ActivityChart chartData={chartData.infraestruturaItens} title={`Proporções de Respostas por Item - Instalações Físicas e Recursos de TI (${selectedFilters.ano})`} customOptions={proporcoesItensOptions} />
              </div>
              <div
                id="chart-boxplot-infra"
                className={styles.chartContainer}
                style={{ ...row2, display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: '1 1 auto', minHeight: 250 }}>
                  <BoxplotChart apiData={chartData.boxplotInfraApex} title="Boxplot das Médias por Item (Instalações e TI)" />
                </div>
                <StatsTableInline
                  id="table-stats-infra"
                  title="Estatísticas — Instalações e TI"
                  rows={recalculated.boxplotInfraStats}
                />
              </div>
              <div id="chart-medias-infra" className={styles.chartContainer} style={row3}>
                <ActivityChart chartData={chartData.mediasItensInfra} title={`Médias dos Itens relacionados às Instalações Físicas e Recursos de TI (Discente)`} customOptions={mediasItensOptions} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sem tabelas invisíveis: agora elas já ficam logo abaixo dos boxplots,
          mas só aparecem quando embedForPdf=1 (no PDF). */}
    </>
  );
}
