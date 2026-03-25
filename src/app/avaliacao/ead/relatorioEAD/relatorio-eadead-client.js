// src/app/avaliacao/ead/relatorioEAD/relatorio-eadead-client.js
'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { useRouter, useSearchParams } from 'next/navigation';
import EadFilters from '../../avalia/components/EadFilters';
import ReportViewer from '../../../../components/ReportViewer';
import { REPORT_CONTEXTS } from '../../../../components/reportContexts';
import styles from '../../../../styles/dados.module.css';

const CONCEITOS = ['Excelente', 'Bom', 'Regular', 'Insuficiente'];
const CONCEITO_COLORS = {
  Excelente: [29, 85, 111],
  Bom: [40, 143, 180],
  Regular: [240, 183, 117],
  Insuficiente: [250, 54, 10],
};

const round2 = (n) => (Number.isFinite(n) ? Number(n.toFixed(2)) : 0);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const meanOf = (arr = []) => {
  const v = arr.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

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

function calculateDescriptiveStats(label, values) {
  const v = (values || []).filter(Number.isFinite);
  if (!v.length) {
    return { item: label, mean: 0, min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }

  const sorted = [...v].sort((a, b) => a - b);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;

  return {
    item: label,
    mean: round2(mean),
    min: round2(sorted[0]),
    q1: round2(percentile(sorted, 0.25)),
    median: round2(percentile(sorted, 0.5)),
    q3: round2(percentile(sorted, 0.75)),
    max: round2(sorted[sorted.length - 1]),
  };
}

function buildApexBoxplotFromValues(label, values, forceNumericX = false) {
  const v = (values || []).filter((n) => Number.isFinite(n));
  if (!v.length) {
    return {
      boxplot_data: [{ x: forceNumericX ? Number(label) : label, y: [0, 0, 0, 0, 0] }],
      outliers_data: [],
    };
  }

  const s = [...v].sort((a, b) => a - b);
  const q1Raw = percentile(s, 0.25);
  const medRaw = percentile(s, 0.5);
  const q3Raw = percentile(s, 0.75);
  const iqrRaw = q3Raw - q1Raw;
  const lowerFence = q1Raw - 1.5 * iqrRaw;
  const upperFence = q3Raw + 1.5 * iqrRaw;
  const inliers = s.filter((x) => x >= lowerFence && x <= upperFence);

  let whiskerMin = inliers.length ? Math.min(...inliers) : s[0];
  let whiskerMax = inliers.length ? Math.max(...inliers) : s[s.length - 1];

  const EPS = 0.06;
  let q1 = q1Raw;
  let med = medRaw;
  let q3 = q3Raw;

  if (q3 - q1 < EPS) {
    q1 = Math.max(1.0, medRaw - EPS / 2);
    q3 = Math.min(4.0, medRaw + EPS / 2);
    whiskerMin = Math.min(whiskerMin, q1);
    whiskerMax = Math.max(whiskerMax, q3);
  }

  whiskerMin = Math.max(1.0, Math.min(whiskerMin, 4.0));
  whiskerMax = Math.max(1.0, Math.min(whiskerMax, 4.0));
  q1 = Math.max(1.0, Math.min(q1, 4.0));
  med = Math.max(1.0, Math.min(med, 4.0));
  q3 = Math.max(1.0, Math.min(q3, 4.0));

  const outliers = s.filter((x) => x < whiskerMin || x > whiskerMax);
  const xLabel = forceNumericX ? Number(label) : label;

  return {
    boxplot_data: [{ x: xLabel, y: [whiskerMin, q1, med, q3, whiskerMax] }],
    outliers_data: outliers.map((val) => ({ x: xLabel, y: val })),
  };
}

function getQHeadersFromRows2023(rows) {
  if (!rows || !rows.length) return [];
  const any = rows.find((r) => r && typeof r === 'object') || {};
  const nums = Object.keys(any)
    .map((k) => {
      const m = /^(\d+)\)/.exec(k);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter(Boolean);
  if (!nums.length) return [];
  const max = Math.max(...nums);
  return Array.from({ length: max }, (_, i) => `${i + 1})`);
}

function getDisciplinaFromRow(row = {}) {
  const keys = Object.keys(row).filter((k) => k.startsWith('Selecione para qual disciplina'));
  if (keys.length) {
    const values = keys
      .map((k) => row?.[k])
      .filter(Boolean)
      .map((v) => String(v).trim())
      .filter(Boolean);
    return values.sort((a, b) => a.localeCompare(b, 'pt-BR')).join(' | ');
  }
  return row?.disciplina ? String(row.disciplina).trim() : '';
}

function getGroupKeyForEad(row = {}, year = '2025', idx = 0) {
  const turmaOuDocente =
    row['Turma/Docente'] ??
    row['Turma'] ??
    row['Docente'] ??
    row['Professor'] ??
    row['Nome do docente'] ??
    row['Nome do Professor'] ??
    row['Nome da turma'] ??
    '';

  const curso =
    row['Qual é o seu Curso?'] ??
    row.curso ??
    '';

  const polo = year === '2025' ? (row['Qual o seu Polo de Vinculação?'] ?? '') : '';
  const disciplina = getDisciplinaFromRow(row);

  const key = [turmaOuDocente, curso, polo, disciplina]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' • ');

  return key || `row_${idx}`;
}

function groupRowsForBoxplot(rows = [], year = '2025') {
  const grouped = new Map();
  rows.forEach((row, idx) => {
    const key = getGroupKeyForEad(row, year, idx);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  return grouped;
}

function aggregateFromRows2025(rows, qHeadersFull) {
  const headers = Array.isArray(qHeadersFull) ? qHeadersFull : [];

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
    'Instalações Físicas e Recursos de TI': headers.slice(35, 45),
  };

  const groupedRows = groupRowsForBoxplot(rows, '2025');

  const dimensoes = [];
  const mediasPorDim = [];
  const boxplotDimRaw = [];
  const boxplotDimStats = [];

  Object.entries(dims).forEach(([dim, hs]) => {
    const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
    let total = 0;

    rows.forEach((r) => {
      hs.forEach((h) => {
        const c = toScoreKey(r[h]);
        if (c) {
          counts[c] += 1;
          total += 1;
        }
      });
    });

    CONCEITOS.forEach((c) => {
      dimensoes.push({
        dimensao: dim,
        conceito: c,
        valor: total ? (counts[c] / total) * 100 : 0,
      });
    });

    let sum = 0;
    let count = 0;

    rows.forEach((r) => {
      const vals = hs.map((h) => toScoreVal(r[h])).filter((v) => v != null);
      if (vals.length) {
        sum += vals.reduce((a, b) => a + b, 0);
        count += vals.length;
      }
    });

    mediasPorDim.push({ dimensao: dim, media: count ? sum / count : 0 });

    const perGroup = Array.from(groupedRows.values())
      .map((group) => {
        const vals = group.flatMap((r) => hs.map((h) => toScoreVal(r[h])).filter((v) => v != null));
        return meanOf(vals);
      })
      .filter((v) => v != null);

    boxplotDimRaw.push({ dimensao: dim, values: perGroup });
    boxplotDimStats.push(calculateDescriptiveStats(dim, perGroup));
  });

  const mediasForHeaders = (hs, offset) =>
    hs.map((h, idx) => {
      const vals = rows.map((r) => toScoreVal(r[h])).filter((v) => v != null);
      const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { item: String(offset + idx + 1), media };
    });

  const boxplotForHeaders = (hs, offset) =>
    hs.map((h, idx) => {
      const values = Array.from(groupedRows.values())
        .map((group) => {
          const vals = group.map((r) => toScoreVal(r[h])).filter((v) => v != null);
          return meanOf(vals);
        })
        .filter((v) => v != null);
      return { item: String(offset + idx + 1), values };
    });

  const makeItens = (hs, offset = 0) =>
    hs.flatMap((h, idx) => {
      const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
      let total = 0;
      rows.forEach((r) => {
        const c = toScoreKey(r[h]);
        if (c) {
          counts[c] += 1;
          total += 1;
        }
      });
      const item = String(offset + idx + 1);
      return CONCEITOS.map((c) => ({
        item,
        conceito: c,
        valor: total ? (counts[c] / total) * 100 : 0,
      }));
    });

  const autoHs = dims['Autoavaliação Discente'];
  const atiHs = headers.slice(13, 19);
  const gesHs = headers.slice(19, 30);
  const proHs = headers.slice(30, 35);
  const infHs = headers.slice(35, 45);

  const boxplotItensAutoRaw = boxplotForHeaders(autoHs, 0);
  const boxplotItensAtitudeRaw = boxplotForHeaders(atiHs, 13);
  const boxplotItensGestaoRaw = boxplotForHeaders(gesHs, 19);
  const boxplotItensProcessoRaw = boxplotForHeaders(proHs, 30);
  const boxplotItensInfraRaw = boxplotForHeaders(infHs, 35);

  return {
    dimensoes,
    mediasPorDim,
    boxplotDimRaw,
    boxplotDimStats,

    autoavaliacaoItens: makeItens(autoHs, 0),
    mediasItensAuto: mediasForHeaders(autoHs, 0),
    boxplotItensAutoRaw,
    boxplotAutoStats: boxplotItensAutoRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    acaoDocenteAtitude: makeItens(atiHs, 13),
    mediasItensAtitude: mediasForHeaders(atiHs, 13),
    boxplotItensAtitudeRaw,
    boxplotAtitudeStats: boxplotItensAtitudeRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    acaoDocenteGestao: makeItens(gesHs, 19),
    mediasItensGestao: mediasForHeaders(gesHs, 19),
    boxplotItensGestaoRaw,
    boxplotGestaoStats: boxplotItensGestaoRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    acaoDocenteProcesso: makeItens(proHs, 30),
    mediasItensProcesso: mediasForHeaders(proHs, 30),
    boxplotItensProcessoRaw,
    boxplotProcessoStats: boxplotItensProcessoRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    infraestruturaItens: makeItens(infHs, 35),
    mediasItensInfra: mediasForHeaders(infHs, 35),
    boxplotItensInfraRaw,
    boxplotInfraStats: boxplotItensInfraRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),
  };
}

function aggregateFromRows2023(rows, qHeadersInput) {
  const qHeaders = (qHeadersInput && qHeadersInput.length) ? qHeadersInput : getQHeadersFromRows2023(rows);

  const toScoreKey = (n) => {
    const val = Number(n);
    if (!Number.isFinite(val) || val === 5) return null;
    if (val === 4) return 'Excelente';
    if (val === 3) return 'Bom';
    if (val === 2) return 'Regular';
    if (val === 1) return 'Insuficiente';
    return null;
  };

  const toScoreVal = (n) => {
    const val = Number(n);
    if (!Number.isFinite(val) || val === 5) return null;
    return val;
  };

  const endAuto = Math.min(13, qHeaders.length);
  const endAcao = Math.min(35, qHeaders.length);
  const endInfra = Math.min(Math.min(45, qHeaders.length), 43);

  const dims = {
    'Autoavaliação Discente': qHeaders.slice(0, endAuto),
    'Avaliação da Ação Docente': qHeaders.slice(13, endAcao),
    'Instalações Físicas e Recursos de TI': qHeaders.slice(35, endInfra),
  };

  const groupedRows = groupRowsForBoxplot(rows, '2023');

  const dimensoes = [];
  const mediasPorDim = [];
  const boxplotDimRaw = [];
  const boxplotDimStats = [];

  Object.entries(dims).forEach(([dim, hs]) => {
    const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
    let total = 0;

    rows.forEach((r) => {
      hs.forEach((h) => {
        const c = toScoreKey(r[h]);
        if (c) {
          counts[c] += 1;
          total += 1;
        }
      });
    });

    CONCEITOS.forEach((c) => {
      dimensoes.push({
        dimensao: dim,
        conceito: c,
        valor: total ? (counts[c] / total) * 100 : 0,
      });
    });

    let sum = 0;
    let count = 0;

    rows.forEach((r) => {
      const vals = hs.map((h) => toScoreVal(r[h])).filter((v) => v != null);
      if (vals.length) {
        sum += vals.reduce((a, b) => a + b, 0);
        count += vals.length;
      }
    });

    mediasPorDim.push({ dimensao: dim, media: count ? sum / count : 0 });

    const perGroup = Array.from(groupedRows.values())
      .map((group) => {
        const vals = group.flatMap((r) => hs.map((h) => toScoreVal(r[h])).filter((v) => v != null));
        return meanOf(vals);
      })
      .filter((v) => v != null);

    boxplotDimRaw.push({ dimensao: dim, values: perGroup });
    boxplotDimStats.push(calculateDescriptiveStats(dim, perGroup));
  });

  const mediasForHeaders = (hs) =>
    hs.map((h) => {
      const vals = rows.map((r) => toScoreVal(r[h])).filter((v) => v != null);
      const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { item: h.replace(')', ''), media };
    });

  const boxplotForHeaders = (hs) =>
    hs.map((h) => {
      const values = Array.from(groupedRows.values())
        .map((group) => {
          const vals = group.map((r) => toScoreVal(r[h])).filter((v) => v != null);
          return meanOf(vals);
        })
        .filter((v) => v != null);
      return { item: h.replace(')', ''), values };
    });

  const makeItens = (hs) =>
    hs.flatMap((h) => {
      const counts = { Excelente: 0, Bom: 0, Regular: 0, Insuficiente: 0 };
      let total = 0;
      rows.forEach((r) => {
        const c = toScoreKey(r[h]);
        if (c) {
          counts[c] += 1;
          total += 1;
        }
      });
      const item = h.replace(')', '');
      return CONCEITOS.map((c) => ({
        item,
        conceito: c,
        valor: total ? (counts[c] / total) * 100 : 0,
      }));
    });

  const autoHs = dims['Autoavaliação Discente'];
  const atiHs = qHeaders.slice(13, Math.min(19, qHeaders.length));
  const gesHs = qHeaders.slice(19, Math.min(30, qHeaders.length));
  const proHs = qHeaders.slice(30, Math.min(35, qHeaders.length));
  const infHs = dims['Instalações Físicas e Recursos de TI'];

  const boxplotItensAutoRaw = boxplotForHeaders(autoHs);
  const boxplotItensAtitudeRaw = boxplotForHeaders(atiHs);
  const boxplotItensGestaoRaw = boxplotForHeaders(gesHs);
  const boxplotItensProcessoRaw = boxplotForHeaders(proHs);
  const boxplotItensInfraRaw = boxplotForHeaders(infHs);

  return {
    dimensoes,
    mediasPorDim,
    boxplotDimRaw,
    boxplotDimStats,

    autoavaliacaoItens: makeItens(autoHs),
    mediasItensAuto: mediasForHeaders(autoHs),
    boxplotItensAutoRaw,
    boxplotAutoStats: boxplotItensAutoRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    acaoDocenteAtitude: makeItens(atiHs),
    mediasItensAtitude: mediasForHeaders(atiHs),
    boxplotItensAtitudeRaw,
    boxplotAtitudeStats: boxplotItensAtitudeRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    acaoDocenteGestao: makeItens(gesHs),
    mediasItensGestao: mediasForHeaders(gesHs),
    boxplotItensGestaoRaw,
    boxplotGestaoStats: boxplotItensGestaoRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    acaoDocenteProcesso: makeItens(proHs),
    mediasItensProcesso: mediasForHeaders(proHs),
    boxplotItensProcessoRaw,
    boxplotProcessoStats: boxplotItensProcessoRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),

    infraestruturaItens: makeItens(infHs),
    mediasItensInfra: mediasForHeaders(infHs),
    boxplotItensInfraRaw,
    boxplotInfraStats: boxplotItensInfraRaw.map((d) => calculateDescriptiveStats(d.item, d.values)),
  };
}

function sortLabelValues(values, isItem = false) {
  const arr = [...new Set(values.filter(Boolean))];
  if (isItem) {
    arr.sort((a, b) => Number(a) - Number(b));
  } else {
    arr.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  }
  return arr;
}

function ensurePageSpace(doc, y, needed = 120, top = 56, bottom = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - bottom) {
    doc.addPage();
    return top;
  }
  return y;
}

function addFigureCaption(doc, y, pageWidth, caption, figRef) {
  if (!caption) return y;
  const text = `Figura ${figRef.current} — ${caption}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, pageWidth - 80);
  doc.text(lines, pageWidth / 2, y, { align: 'center' });
  figRef.current += 1;
  return y + doc.getTextDimensions(lines).h + 8;
}

function drawLegend(doc, y, pageWidth) {
  const items = [
    { label: 'Excelente', color: CONCEITO_COLORS.Excelente },
    { label: 'Bom', color: CONCEITO_COLORS.Bom },
    { label: 'Regular', color: CONCEITO_COLORS.Regular },
    { label: 'Insuficiente', color: CONCEITO_COLORS.Insuficiente },
  ];

  const box = 9;
  const gap = 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const rowWidth = items.reduce((acc, item, i) => {
    const txt = doc.getTextWidth(item.label);
    return acc + (i ? gap : 0) + box + 4 + txt;
  }, 0);

  let x = (pageWidth - rowWidth) / 2;
  items.forEach((item, i) => {
    if (i) x += gap;
    doc.setFillColor(...item.color);
    doc.rect(x, y - box + 2, box, box, 'F');
    x += box + 4;
    doc.setTextColor(0, 0, 0);
    doc.text(item.label, x, y);
    x += doc.getTextWidth(item.label);
  });

  return y + 10;
}

function drawGroupedProportionChart(doc, y, pageWidth, title, data, labelField = 'item') {
  if (!Array.isArray(data) || !data.length) return y;

  y = ensurePageSpace(doc, y, 300);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(title, pageWidth - 100);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += Math.max(20, titleLines.length * 12 + 6);

  y = drawLegend(doc, y, pageWidth);
  y += 8;

  const labels = sortLabelValues(data.map((d) => d?.[labelField]), labelField === 'item');
  if (!labels.length) return y;

  const chartX = 42;
  const chartWidth = pageWidth - 84;
  const chartHeight = 150;
  const bottomY = y + chartHeight;

  doc.setDrawColor(175, 175, 175);
  doc.setLineWidth(1);
  doc.line(chartX, bottomY, chartX + chartWidth, bottomY);
  doc.line(chartX, bottomY - chartHeight, chartX, bottomY);

  const ticks = [0, 25, 50, 75, 100];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  ticks.forEach((t) => {
    const yTick = bottomY - (t / 100) * chartHeight;
    doc.line(chartX - 3, yTick, chartX, yTick);
    doc.text(`${t}%`, chartX - 6, yTick + 3, { align: 'right' });
  });

  const groupW = chartWidth / labels.length;
  const barW = Math.min(14, (groupW * 0.8) / 4);
  let maxLabelLines = 1;

  labels.forEach((label, idx) => {
    const centerX = chartX + idx * groupW + groupW / 2;
    const startX = centerX - (barW * 4) / 2;

    CONCEITOS.forEach((c, cIdx) => {
      const found = data.find((row) => String(row?.[labelField]) === String(label) && row?.conceito === c);
      const val = Number(found?.valor || 0);
      const h = (Math.max(0, Math.min(100, val)) / 100) * chartHeight;
      const x = startX + cIdx * barW;
      const yBar = bottomY - h;

      doc.setFillColor(...CONCEITO_COLORS[c]);
      doc.rect(x, yBar, barW - 1, h, 'F');

      const valueText = `${val.toFixed(1).replace('.', ',')}%`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(35, 35, 35);
      const yText = Math.max(yBar - 2, bottomY - chartHeight + 8);
      doc.text(valueText, x + (barW - 1) / 2, yText, { align: 'center' });
    });

    const labelText = String(label);
    const split = doc.splitTextToSize(labelText, groupW - 6);
    maxLabelLines = Math.max(maxLabelLines, split.length);
    doc.setTextColor(50, 50, 50);
    doc.text(split, centerX, bottomY + 11, { align: 'center' });
  });

  return bottomY + maxLabelLines * 10 + 28;
}

function drawMeanChart(doc, y, pageWidth, title, rows, labelField = 'item') {
  if (!Array.isArray(rows) || !rows.length) return y;

  y = ensurePageSpace(doc, y, 280);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(title, pageWidth - 100);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += Math.max(20, titleLines.length * 12 + 6);

  const sorted = [...rows].sort((a, b) => {
    if (labelField === 'item') return Number(a?.item) - Number(b?.item);
    return String(a?.[labelField]).localeCompare(String(b?.[labelField]), 'pt-BR');
  });

  const chartX = 42;
  const chartWidth = pageWidth - 84;
  const chartHeight = 150;
  const bottomY = y + chartHeight;

  doc.setDrawColor(175, 175, 175);
  doc.setLineWidth(1);
  doc.line(chartX, bottomY, chartX + chartWidth, bottomY);
  doc.line(chartX, bottomY - chartHeight, chartX, bottomY);

  const ticks = [1, 2, 3, 4];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  ticks.forEach((t) => {
    const yTick = bottomY - ((t - 1) / 3) * chartHeight;
    doc.line(chartX - 3, yTick, chartX, yTick);
    doc.text(String(t), chartX - 6, yTick + 3, { align: 'right' });
  });

  const groupW = chartWidth / sorted.length;
  const barW = Math.min(20, groupW * 0.6);
  let maxLabelLines = 1;

  sorted.forEach((row, idx) => {
    const value = Number(row?.media || 0);
    const xCenter = chartX + idx * groupW + groupW / 2;
    const x = xCenter - barW / 2;
    const h = (Math.max(1, Math.min(4, value)) - 1) / 3 * chartHeight;
    const yBar = bottomY - h;

    doc.setFillColor(40, 143, 180);
    doc.rect(x, yBar, barW, h, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(value.toFixed(2).replace('.', ','), xCenter, yBar - 4, { align: 'center' });

    const label = labelField === 'item' ? String(row?.item || '') : String(row?.[labelField] || '');
    const split = doc.splitTextToSize(label, groupW - 6);
    maxLabelLines = Math.max(maxLabelLines, split.length);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(split, xCenter, bottomY + 11, { align: 'center' });
  });

  return bottomY + maxLabelLines * 10 + 28;
}

function drawBoxplotChart(doc, y, pageWidth, title, statsRows, labelField = 'item') {
  if (!Array.isArray(statsRows) || !statsRows.length) return y;

  y = ensurePageSpace(doc, y, 300);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(title, pageWidth - 100);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += Math.max(20, titleLines.length * 12 + 6);

  const sorted = [...statsRows].sort((a, b) => {
    const av = labelField === 'item' ? Number(a?.item) : String(a?.item || '');
    const bv = labelField === 'item' ? Number(b?.item) : String(b?.item || '');
    if (labelField === 'item') return av - bv;
    return String(av).localeCompare(String(bv), 'pt-BR');
  });

  const chartX = 42;
  const chartWidth = pageWidth - 84;
  const chartHeight = 150;
  const bottomY = y + chartHeight;

  doc.setDrawColor(175, 175, 175);
  doc.setLineWidth(1);
  doc.line(chartX, bottomY, chartX + chartWidth, bottomY);
  doc.line(chartX, bottomY - chartHeight, chartX, bottomY);

  const mapY = (v) => bottomY - ((Math.max(1, Math.min(4, Number(v || 1))) - 1) / 3) * chartHeight;

  const ticks = [1, 2, 3, 4];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  ticks.forEach((t) => {
    const yTick = mapY(t);
    doc.line(chartX - 3, yTick, chartX, yTick);
    doc.text(String(t), chartX - 6, yTick + 3, { align: 'right' });
  });

  const groupW = chartWidth / sorted.length;
  const boxW = Math.min(18, groupW * 0.55);
  let maxLabelLines = 1;

  sorted.forEach((row, idx) => {
    const xCenter = chartX + idx * groupW + groupW / 2;

    const yMin = mapY(row.min);
    const yQ1 = mapY(row.q1);
    const yMed = mapY(row.median);
    const yQ3 = mapY(row.q3);
    const yMax = mapY(row.max);

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(1);
    doc.line(xCenter, yMin, xCenter, yMax);

    doc.setDrawColor(40, 143, 180);
    doc.setFillColor(160, 214, 232);
    doc.rect(xCenter - boxW / 2, yQ3, boxW, Math.max(1, yQ1 - yQ3), 'FD');

    doc.setDrawColor(20, 20, 20);
    doc.line(xCenter - boxW / 2, yMed, xCenter + boxW / 2, yMed);

    doc.line(xCenter - boxW / 4, yMin, xCenter + boxW / 4, yMin);
    doc.line(xCenter - boxW / 4, yMax, xCenter + boxW / 4, yMax);

    const label = String(row?.item || '');
    const split = doc.splitTextToSize(label, groupW - 6);
    maxLabelLines = Math.max(maxLabelLines, split.length);
    doc.setTextColor(50, 50, 50);
    doc.text(split, xCenter, bottomY + 11, { align: 'center' });
  });

  return bottomY + maxLabelLines * 10 + 28;
}

function addStatsTable(doc, autoTable, y, pageWidth, title, rows) {
  if (!Array.isArray(rows) || !rows.length) return y;

  y = ensurePageSpace(doc, y, 170);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(title, pageWidth - 100);
  doc.text(lines, pageWidth / 2, y, { align: 'center' });
  y += Math.max(16, lines.length * 11 + 4);

  const sortedRows = [...rows].sort((a, b) => {
    const an = Number(a?.item);
    const bn = Number(b?.item);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(a?.item ?? '').localeCompare(String(b?.item ?? ''), 'pt-BR');
  });

  const headers = ['Estatística', ...sortedRows.map((r) => String(r.item ?? ''))];

  const metricRows = [
    {
      label: 'Min',
      values: sortedRows.map((r) => Number(r.min ?? 0).toFixed(2).replace('.', ',')),
    },
    {
      label: 'Q1',
      values: sortedRows.map((r) => Number(r.q1 ?? 0).toFixed(2).replace('.', ',')),
    },
    {
      label: 'Mediana',
      values: sortedRows.map((r) => Number(r.median ?? 0).toFixed(2).replace('.', ',')),
    },
    {
      label: 'Média',
      values: sortedRows.map((r) => Number(r.mean ?? 0).toFixed(2).replace('.', ',')),
    },
    {
      label: 'Q3',
      values: sortedRows.map((r) => Number(r.q3 ?? 0).toFixed(2).replace('.', ',')),
    },
    {
      label: 'Max',
      values: sortedRows.map((r) => Number(r.max ?? 0).toFixed(2).replace('.', ',')),
    },
  ];

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: metricRows.map((row) => [row.label, ...row.values]),
    theme: 'striped',
    headStyles: { fillColor: [40, 143, 180] },
    margin: { left: 40, right: 40 },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', cellWidth: 'wrap' },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
    },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
  });

  return (doc.lastAutoTable?.finalY || y) + 18;
}

function buildBoxplotApexFromRaw(rawRows = [], labelField = 'item') {
  const sorted = [...rawRows].sort((a, b) => {
    if (labelField === 'item') return Number(a?.item) - Number(b?.item);
    return String(a?.dimensao || '').localeCompare(String(b?.dimensao || ''), 'pt-BR');
  });

  const forceNumericX = labelField === 'item';
  const all = sorted.map((it) => {
    const xLabel = labelField === 'item' ? it.item : it.dimensao;
    return buildApexBoxplotFromValues(xLabel, it.values || [], forceNumericX);
  });

  return {
    boxplot_data: all.flatMap((o) => o.boxplot_data),
    outliers_data: all.flatMap((o) => o.outliers_data),
  };
}

export default function RelatorioEadClient({
  filtersByYear,
  reportDataByYear,
  anosDisponiveis,
  initialSelected,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const ALL_POLOS_LABEL = 'Todos os Polos';
  const POLO_PLACEHOLDER = 'Selecione o polo desejado';

  const preferredAno =
    (initialSelected?.ano && String(initialSelected.ano)) ||
    (Array.isArray(anosDisponiveis) && anosDisponiveis.includes('2025')
      ? '2025'
      : anosDisponiveis?.[0] || '');

  const [selected, setSelected] = useState({
    ano: preferredAno,
    curso: initialSelected?.curso || '',
    polo: initialSelected?.polo || '',
  });

  const yearDef = selected.ano
    ? filtersByYear[selected.ano] || { hasPolos: false, polos: [], cursos: [] }
    : { hasPolos: false, polos: [], cursos: [] };

  const isAllPolos =
    !!yearDef.hasPolos &&
    (selected.polo === ALL_POLOS_LABEL || selected.polo === '__ALL__' || selected.polo === 'todos');

  useEffect(() => {
    if (!selected.ano) return;
    const def = filtersByYear[selected.ano] || { cursos: [], hasPolos: false };
    if (def.hasPolos && def.cursos?.length === 1) {
      const only = def.cursos[0] || '';
      if (only && selected.curso !== only) {
        const next = { ...selected, curso: only };
        setSelected(next);
        const sp = new URLSearchParams(searchParams.toString());
        sp.set('ano', next.ano);
        sp.set('curso', only);
        router.replace(sp.toString() ? `?${sp.toString()}` : '?');
      }
    }
  }, [selected, filtersByYear, searchParams, router]);

  const visibleFields = useMemo(() => {
    if (!selected.ano) return ['ano'];
    if (yearDef.hasPolos) return ['ano', 'polo'];
    return ['ano', 'curso'];
  }, [selected.ano, yearDef.hasPolos]);

  const filters = useMemo(() => {
    const polosLimpos = (yearDef.polos || []).filter((p) => p && p !== ALL_POLOS_LABEL);
    return {
      anos: anosDisponiveis,
      cursos: selected.ano ? yearDef.cursos || [] : [],
      polos: selected.ano && yearDef.hasPolos ? [...polosLimpos] : [],
      disciplinas: [],
      dimensoes: [],
    };
  }, [anosDisponiveis, selected.ano, yearDef]);

  const syncURL = (next) => {
    const sp = new URLSearchParams(searchParams.toString());
    next.ano ? sp.set('ano', next.ano) : sp.delete('ano');
    if (next.curso) sp.set('curso', next.curso);
    else sp.delete('curso');

    if (next.ano && filtersByYear[next.ano]?.hasPolos && next.polo && next.polo !== ALL_POLOS_LABEL) {
      sp.set('polo', next.polo);
    } else {
      sp.delete('polo');
    }

    router.replace(sp.toString() ? `?${sp.toString()}` : '?');
  };

  const [blocking, setBlocking] = useState(false);
  const [forceBlocking, setForceBlocking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Preparando…');

  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const prevUrlRef = useRef('');
  const contentRef = useRef(null);
  const chartsIframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  const pendingBuildRef = useRef(false);
  const latestCanGenerateRef = useRef(false);
  const latestIframeReadyRef = useRef(false);
  const latestSelSigRef = useRef('');
  const buildingRef = useRef(false);
  const currentBuildSigRef = useRef('');
  const lastBuiltSigRef = useRef('');

  useEffect(() => {
    const shouldBlockForAllPolos = yearDef.hasPolos && isAllPolos && !pdfUrl;
    const shouldBlock = forceBlocking || shouldBlockForAllPolos;

    setBlocking(shouldBlock);

    if (shouldBlock) {
      if (!forceBlocking) {
        setProgress((p) => (p > 0 ? p : 3));
        setProgressText(isAllPolos ? 'Preparando geração para todos os polos…' : 'Gerando PDF…');
      }
      try {
        document.activeElement?.blur?.();
      } catch {}
      try {
        if (contentRef.current) {
          contentRef.current.setAttribute('inert', '');
          contentRef.current.style.pointerEvents = 'none';
        }
      } catch {}
    } else {
      try {
        if (contentRef.current) {
          contentRef.current.removeAttribute('inert');
          contentRef.current.style.pointerEvents = '';
        }
      } catch {}
      if (!isAllPolos) {
        setProgress(0);
        setProgressText('Preparando…');
      }
    }
  }, [forceBlocking, isAllPolos, yearDef.hasPolos, pdfUrl]);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    if (blocking) html.style.overflow = 'hidden';
    else html.style.overflow = prev || '';
    return () => {
      html.style.overflow = prev || '';
    };
  }, [blocking]);

  useEffect(() => {
    const handler = (e) => {
      if (!blocking) return;
      const keys = ['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (keys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [blocking]);

  const progressTimerRef = useRef(null);
  useEffect(() => {
    const hasResult = !!pdfUrl;
    const isBlockedGenerating = blocking && !hasResult;
    if (!isBlockedGenerating) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }

    const cap = isAllPolos ? 95 : 88;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= cap) return p;
        if (p < 20) return p + 2.0;
        if (p < 50) return p + 1.4;
        if (p < 70) return p + 0.9;
        return p + 0.5;
      });
    }, 450);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [blocking, isAllPolos, pdfUrl]);

  const handleFilterChange = (e) => {
    const key = e?.target?.name;
    let value = e?.target?.value ?? '';
    if (key === 'polo' && (value === POLO_PLACEHOLDER || value === '')) value = '';

    const selectingAllPolosNow =
      key === 'polo' && (value === ALL_POLOS_LABEL || value === '__ALL__' || value === 'todos');

    const next = { ...selected, [key]: value };

    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = '';
    }
    setPdfUrl('');
    setPdfError('');
    setIsGeneratingPreview(false);

    if (key === 'polo') {
      if (selectingAllPolosNow) {
        setForceBlocking(false);
        setProgress((p) => (p < 8 ? 8 : p));
        setProgressText('Preparando geração para todos os polos…');
      } else {
        setForceBlocking(true);
        setProgress(8);
        setProgressText('Gerando PDF…');
      }
    }

    if (key === 'curso') {
      const def = filtersByYear[selected.ano] || { hasPolos: false };
      if (!def.hasPolos && value) {
        setForceBlocking(true);
        setProgress((p) => (p < 8 ? 8 : p));
        setProgressText('Gerando PDF…');
      } else if (!value) {
        setForceBlocking(false);
        setProgress(0);
        setProgressText('Preparando…');
      }
    }

    if (key === 'ano') {
      next.curso = '';
      next.polo = '';
      setForceBlocking(false);
      setProgress(0);
      setProgressText('Preparando…');
    }

    if (key === 'curso' && !selected.ano) next.curso = '';
    if (key === 'polo' && !(selected.ano && yearDef.hasPolos)) next.polo = '';

    setSelected(next);
    syncURL(next);
  };

  const canGenerate = !!selected.ano && (yearDef.hasPolos ? !!selected.polo : !!selected.curso);

  const iframeSrc = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('ano', selected.ano || '');
    if (selected.curso) sp.set('curso', selected.curso);
    if (yearDef.hasPolos && selected.polo && !isAllPolos) sp.set('polo', selected.polo);
    sp.set('embedForPdf', '1');
    return `/avaliacao/ead?${sp.toString()}`;
  }, [selected.ano, selected.curso, selected.polo, yearDef.hasPolos, isAllPolos]);

  useEffect(() => {
    setIframeReady(false);
  }, [iframeSrc]);

  const fetchAsDataUrl = async (url) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  };

  const drawImageContain = async (doc, dataUrl, boxX, boxY, boxW, boxH, fmt = 'PNG') => {
    if (!dataUrl) return { finalH: 0, yPos: boxY };
    const loadImg = (src) =>
      new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve({ w: im.naturalWidth || im.width, h: im.naturalHeight || im.height });
        im.onerror = reject;
        im.src = src;
      });

    const { w, h } = await loadImg(dataUrl);
    if (!w || !h) return { finalH: 0, yPos: boxY };

    const scale = Math.min(boxW / w, boxH / h);
    const drawW = w * scale;
    const drawH = h * scale;

    const x = boxX + (boxW - drawW) / 2;
    const y = boxY;

    doc.addImage(dataUrl, fmt, x, y, drawW, drawH, undefined, 'FAST');
    return { finalH: drawH, yPos: y };
  };

  const mergeWithExternalPdf = async (basePdfBytes, externalPdfPath) => {
    const { PDFDocument } = await import('pdf-lib');
    const basePdf = await PDFDocument.load(basePdfBytes);
    try {
      const extBytes = await (await fetch(externalPdfPath)).arrayBuffer();
      const extPdf = await PDFDocument.load(extBytes);
      const copied = await basePdf.copyPages(extPdf, extPdf.getPageIndices());
      copied.forEach((p) => basePdf.addPage(p));
    } catch {}
    const merged = await basePdf.save();
    return new Blob([merged], { type: 'application/pdf' });
  };

  const selSig = useMemo(() => {
    return `${selected.ano || ''}::${selected.curso || ''}::${yearDef.hasPolos && isAllPolos ? 'todos' : 'single'}`;
  }, [selected.ano, selected.curso, yearDef.hasPolos, isAllPolos]);

  useEffect(() => {
    latestSelSigRef.current = selSig;
    if (currentBuildSigRef.current !== selSig) {
      pendingBuildRef.current = false;
    }
  }, [selSig]);

  const computeAggregation = useCallback((ano, curso, poloName) => {
    const yearData = reportDataByYear?.[ano] || {};
    const rows = Array.isArray(yearData.rows) ? [...yearData.rows] : [];

    if (!rows.length) return { filteredRows: [] };

    let filtered = rows;

    if (ano === '2025') {
      if (curso) filtered = filtered.filter((r) => r['Qual é o seu Curso?'] === curso);
      if (poloName) filtered = filtered.filter((r) => r['Qual o seu Polo de Vinculação?'] === poloName);
      const qHeadersFull = yearData.qHeadersFull || [];
      return { ...aggregateFromRows2025(filtered, qHeadersFull), filteredRows: filtered };
    }

    const cursoKey = rows[0]?.['Qual é o seu Curso?'] !== undefined ? 'Qual é o seu Curso?' : 'curso';
    if (curso) filtered = filtered.filter((r) => String(r?.[cursoKey] || '') === String(curso));

    const qHeaders = (yearData.qHeadersFull && yearData.qHeadersFull.length)
      ? yearData.qHeadersFull
      : getQHeadersFromRows2023(filtered);

    return { ...aggregateFromRows2023(filtered, qHeaders), filteredRows: filtered };
  }, [reportDataByYear]);

  const getIframeDoc = () => {
    const ifr = chartsIframeRef.current;
    return ifr?.contentWindow?.document || ifr?.contentDocument || null;
  };

  const nudgeIframeLayout = () => {
    const ifr = chartsIframeRef.current;
    if (!ifr) return;
    try {
      const win = ifr.contentWindow;
      if (!win) return;
      void ifr.offsetHeight;
      win.dispatchEvent(new win.Event('resize'));
      if (win.scrollTo) win.scrollTo(0, 1);
    } catch {}
  };

  const ensureInView = async (el) => {
    try {
      el?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    } catch {}
    nudgeIframeLayout();
    await sleep(70);
    nudgeIframeLayout();
    await sleep(70);
  };

  const findChartEl = (doc, id) => {
    if (!doc) return null;
    const el = doc.querySelector(`#${id}`);
    if (!el) return null;
    const c = el.querySelector('canvas');
    const s = el.querySelector('svg');
    if (c && c.width > 0 && c.height > 0) return el;
    if (s) {
      const bb = s.getBBox ? s.getBBox() : null;
      if (!bb || (bb.width > 0 && bb.height > 0)) return el;
    }
    const rect = el.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) return el;
    return null;
  };

  const waitForChart = async (id, timeoutMs = 15000) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const el = findChartEl(getIframeDoc(), id);
      if (el) return el;
      nudgeIframeLayout();
      await sleep(110);
    }
    return null;
  };

  const elementToPngDataUrl = async (el) => {
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const clone = el.cloneNode(true);
    clone.style.background = '#ffffff';
    const serializer = new XMLSerializer();
    const xhtml = serializer.serializeToString(clone);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<foreignObject width="100%" height="100%">${xhtml}</foreignObject>` +
      '</svg>';
    const svg64 = typeof window.btoa === 'function' ? window.btoa(unescape(encodeURIComponent(svg))) : '';
    const dataUrl = `data:image/svg+xml;base64,${svg64}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = dataUrl;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || w;
    c.height = img.naturalHeight || h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  };

  const getDataUrlFromChartContainer = async (containerId) => {
    const el = await waitForChart(containerId, 15000);
    if (!el) return null;

    const tryOnce = async () => {
      await ensureInView(el);

      const canvas = el.querySelector('canvas');
      if (canvas) {
        try {
          const data = canvas.toDataURL('image/png');
          if (data && data.length > 1000) return data;
        } catch {}
      }

      const svg = el.querySelector('svg');
      if (svg) {
        try {
          const cloned = svg.cloneNode(true);
          cloned.setAttribute('style', 'background:#ffffff');
          const serializer = new XMLSerializer();
          const svgStr = serializer.serializeToString(cloned);
          const svg64 = typeof window.btoa === 'function' ? window.btoa(unescape(encodeURIComponent(svgStr))) : '';
          const image64 = `data:image/svg+xml;base64,${svg64}`;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = image64;
          });
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 1600;
          c.height = img.naturalHeight || 900;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0);
          const data = c.toDataURL('image/png');
          if (data && data.length > 1000) return data;
        } catch {}
      }

      try {
        const data = await elementToPngDataUrl(el);
        if (data && data.length > 1000) return data;
      } catch {}

      return null;
    };

    for (let i = 0; i < 4; i++) {
      const data = await tryOnce();
      if (data) return data;
      nudgeIframeLayout();
      await sleep(120 + i * 80);
    }

    return null;
  };

  const waitForBoxplotGraphics = async (containerId, timeoutMs = 30000) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const doc = getIframeDoc();
      const container = doc?.querySelector?.(`#${containerId}`);
      const plotRoot = container?.querySelector?.('div:first-child');
      const hasApex = !!(
        plotRoot?.querySelector?.('.apexcharts-canvas') ||
        plotRoot?.querySelector?.('.apexcharts-svg') ||
        plotRoot?.querySelector?.('svg') ||
        plotRoot?.querySelector?.('canvas')
      );
      const r = plotRoot?.getBoundingClientRect?.();
      if (hasApex && r && r.width > 0 && r.height > 0) return plotRoot;
      nudgeIframeLayout();
      await sleep(130);
    }
    return null;
  };

  const getHighQualityBoxplotDataUrl = async (containerId) => {
    const plotRoot = await waitForBoxplotGraphics(containerId, 32000);
    if (!plotRoot) return null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await ensureInView(plotRoot);
        const rect = plotRoot.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));

        const data = await toPng(plotRoot, {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: '#ffffff',
          width,
          height,
          filter: (node) => {
            try {
              const cls = node?.classList;
              if (!cls) return true;
              if (cls.contains('apexcharts-title-text')) return false;
              if (cls.contains('apexcharts-subtitle-text')) return false;
              if (cls.contains('apexcharts-toolbar')) return false;
              return true;
            } catch {
              return true;
            }
          },
          style: {
            margin: '0',
            transform: 'none',
            transformOrigin: 'top left',
          },
        });

        if (data && data.length > 1500) return data;
      } catch {}

      nudgeIframeLayout();
      await sleep(140 + attempt * 100);
    }

    return null;
  };

  const loadDashboardFor = async ({ ano, curso, poloName }) => {
    const ifr = chartsIframeRef.current;
    if (!ifr) return;

    const sp = new URLSearchParams();
    sp.set('ano', ano || '');
    if (curso) sp.set('curso', curso);
    if (yearDef.hasPolos && poloName) sp.set('polo', String(poloName));
    sp.set('embedForPdf', '1');
    const target = `/avaliacao/ead?${sp.toString()}`;

    try {
      const current = ifr.getAttribute('src') || '';
      if (current === target) {
        await sleep(120);
        nudgeIframeLayout();
        return;
      }
    } catch {}

    await new Promise((resolve) => {
      const onLoad = async () => {
        ifr.removeEventListener('load', onLoad);
        await sleep(220);
        nudgeIframeLayout();
        resolve();
      };
      ifr.addEventListener('load', onLoad);
      setIframeReady(false);
      ifr.src = target;
    });

    await sleep(160);
  };

  async function buildPdf(requestSig = latestSelSigRef.current) {
    if (buildingRef.current) {
      if (requestSig !== currentBuildSigRef.current) {
        pendingBuildRef.current = true;
      }
      return;
    }

    if (requestSig === lastBuiltSigRef.current && pdfUrl) {
      return;
    }

    const isStale = () => requestSig !== latestSelSigRef.current;

    buildingRef.current = true;
    currentBuildSigRef.current = requestSig;
    setIsGeneratingPreview(true);
    setPdfError('');

    if (!latestCanGenerateRef.current || !latestIframeReadyRef.current || isStale()) {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = '';
      }
      setPdfUrl('');
      setIsGeneratingPreview(false);
      buildingRef.current = false;
      return;
    }

    if (isAllPolos || forceBlocking) {
      setProgress((p) => (p > 12 ? p : 12));
      setProgressText(isAllPolos ? 'Preparando geração para todos os polos…' : 'Gerando PDF…');
    }

    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const figRef = { current: 1 };

      try {
        const capaDataUrl = await fetchAsDataUrl('/capa_avalia.png');
        await drawImageContain(doc, capaDataUrl, 36, 48, pageWidth - 72, pageHeight - 96, 'PNG');
      } catch {}

      doc.addPage();
      let y = margin;
      doc.setFont('Arial', 'bold');
      doc.setFontSize(15);
      doc.text(`APRESENTAÇÃO DO RELATÓRIO AVALIA ${selected.ano}`, pageWidth / 2, y, { align: 'center' });
      y += 22;

      doc.setFont('Arial', 'normal');
      doc.setFontSize(12);
      const periodoLetivo = selected.ano === '2023'
        ? '2023-4'
        : selected.ano === '2025'
          ? '2025-2'
          : `${selected.ano}`;

      const paragraphs = [
        'A Autoavaliação dos Cursos de Graduação a Distância da UFPA (AVALIA EAD) é coordenada pela CPA em parceria com a DIAVI/PROPLAN.',
        'O AVALIA-EAD visa captar a percepção discente sobre o curso, apoiando melhorias nas condições de ensino e aprendizagem.',
        'O formulário contempla 3 dimensões: Autoavaliação, Ação Docente (Atitude, Gestão e Processo Avaliativo) e Infra/Recursos de TI.',
        `Resultados referentes ao Período Letivo ${periodoLetivo}, com escala de 1 (Insuficiente) a 4 (Excelente) e opção “Não se Aplica”.`,
        'Representações gráficas: barras (percentuais e médias), boxplots e estatísticas descritivas.',
      ];

      paragraphs.forEach((p, idx) => {
        const lines = doc.splitTextToSize(p, pageWidth - 2 * margin);
        doc.text(lines, margin, y);
        y += lines.length * 18;
        if (y > pageHeight - margin - 120 && idx < paragraphs.length - 1) {
          doc.addPage();
          y = margin;
        }
      });

      try {
        const boxplotInfo = await fetchAsDataUrl('/boxplot.jpeg');
        const boxMaxW = pageWidth - 2 * margin;
        const boxMaxH = 240;
        const spaceLeft = pageHeight - y - margin;
        if (spaceLeft < boxMaxH + 12) {
          doc.addPage();
          y = margin;
        }
        const { finalH, yPos } = await drawImageContain(doc, boxplotInfo, margin, y, boxMaxW, boxMaxH, 'JPEG');
        const yAfter = yPos + finalH + 12;
        addFigureCaption(doc, yAfter, pageWidth, 'Exemplo de Boxplot', figRef);
      } catch {}

      const polosToRender = yearDef.hasPolos
        ? (isAllPolos
          ? (yearDef.polos || []).filter((p) => p && p !== ALL_POLOS_LABEL && p !== '__ALL__' && String(p).toLowerCase() !== 'todos')
          : [selected.polo])
        : [null];

      const addBoxplotFigure = async (sy, boxTitle, boxContainerId) => {
        if (!boxContainerId) return sy;

        sy = ensurePageSpace(doc, sy, 320);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const titleLines = doc.splitTextToSize(boxTitle, pageWidth - 100);
        doc.text(titleLines, pageWidth / 2, sy, { align: 'center' });
        sy += Math.max(18, titleLines.length * 12 + 6);

        try {
          const image = await getHighQualityBoxplotDataUrl(boxContainerId);

          if (!image) return sy;

          const imageWidth = pageWidth - 80;
          const imageMaxHeight = 280;
          const { finalH, yPos } = await drawImageContain(doc, image, 40, sy, imageWidth, imageMaxHeight, 'PNG');
          return yPos + finalH + 22;
        } catch (err) {
          console.error(`Erro ao capturar ${boxTitle}:`, err);
          return sy;
        }
      };

      const addSection = async (sectionTitle, agg, cfg) => {
        const FIGURE_GAP = 18;
        doc.addPage();
        let sy = 56;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(sectionTitle, pageWidth / 2, sy, { align: 'center' });
        sy += 20;

        sy = drawGroupedProportionChart(doc, sy, pageWidth, cfg.propTitle, agg[cfg.propKey], cfg.labelField);
        sy = addFigureCaption(doc, sy, pageWidth, cfg.propCaption, figRef);
        sy += FIGURE_GAP;

        sy = await addBoxplotFigure(sy, cfg.boxTitle, cfg.boxContainerId);
        sy = addFigureCaption(doc, sy, pageWidth, cfg.boxCaption, figRef);
        sy += FIGURE_GAP;

        sy = addStatsTable(doc, autoTable, sy, pageWidth, cfg.tableTitle, agg[cfg.statsKey]);
        sy += FIGURE_GAP;

        sy = drawMeanChart(doc, sy, pageWidth, cfg.meanTitle, agg[cfg.meanKey], cfg.labelField);
        sy = addFigureCaption(doc, sy, pageWidth, cfg.meanCaption, figRef);
        sy += FIGURE_GAP;
      };

      for (let idx = 0; idx < polosToRender.length; idx++) {
        if (isStale()) break;

        const poloName = polosToRender[idx];
        setProgressText(
          isAllPolos
            ? `Preparando dados do polo ${idx + 1}/${polosToRender.length}…`
            : 'Preparando dados do polo selecionado…'
        );

        const agg = computeAggregation(selected.ano, selected.curso, poloName);

        await loadDashboardFor({ ano: selected.ano, curso: selected.curso, poloName });
        await Promise.all([
          waitForBoxplotGraphics('chart-boxplot-dimensoes', 32000),
          waitForBoxplotGraphics('chart-boxplot-autoav', 32000),
          waitForBoxplotGraphics('chart-boxplot-atitude', 32000),
          waitForBoxplotGraphics('chart-boxplot-gestao', 32000),
          waitForBoxplotGraphics('chart-boxplot-processo', 32000),
          waitForBoxplotGraphics('chart-boxplot-infra', 32000),
        ]);

        doc.addPage();
        const titulo1 = `RELATÓRIO AVALIA ${selected.ano}`;
        const campus = poloName || 'Campus/Polo';
        const titulo2 = `${selected.curso || 'Curso'} - ${campus}`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        const t1 = doc.splitTextToSize(titulo1, pageWidth - 80);
        doc.text(t1, pageWidth / 2, pageHeight / 2 - 18, { align: 'center' });

        doc.setFontSize(15);
        const t2 = doc.splitTextToSize(titulo2, pageWidth - 80);
        doc.text(t2, pageWidth / 2, pageHeight / 2 + 18, { align: 'center' });

        if (!agg.filteredRows?.length) {
          doc.addPage();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text('Sem dados para esta seleção', pageWidth / 2, 90, { align: 'center' });
          continue;
        }

        await addSection('Dimensões Gerais', agg, {
          propKey: 'dimensoes',
          meanKey: 'mediasPorDim',
          statsKey: 'boxplotDimStats',
          labelField: 'dimensao',
          boxContainerId: 'chart-boxplot-dimensoes',
          propTitle: `Proporções de Respostas por Dimensão (${selected.ano})`,
          boxTitle: `Boxplot das Médias por Dimensão (${selected.ano})`,
          meanTitle: `Médias por Dimensão (${selected.ano})`,
          propCaption: `Proporções por Dimensão (${selected.ano})`,
          boxCaption: `Boxplot das Médias por Dimensão (${selected.ano})`,
          meanCaption: `Médias por Dimensão (${selected.ano})`,
          tableTitle: 'Estatísticas — Dimensões',
        });

        await addSection('Autoavaliação Discente', agg, {
          propKey: 'autoavaliacaoItens',
          meanKey: 'mediasItensAuto',
          statsKey: 'boxplotAutoStats',
          labelField: 'item',
          boxContainerId: 'chart-boxplot-autoav',
          propTitle: `Proporções de Respostas por Item (${selected.ano})`,
          boxTitle: `Boxplot das Médias por Item (${selected.ano})`,
          meanTitle: `Médias dos Itens (${selected.ano})`,
          propCaption: `Proporções por Item — Autoavaliação (${selected.ano})`,
          boxCaption: `Boxplot por Item — Autoavaliação (${selected.ano})`,
          meanCaption: `Médias dos Itens — Autoavaliação (${selected.ano})`,
          tableTitle: 'Estatísticas — Autoavaliação',
        });

        await addSection('Atitude Profissional', agg, {
          propKey: 'acaoDocenteAtitude',
          meanKey: 'mediasItensAtitude',
          statsKey: 'boxplotAtitudeStats',
          labelField: 'item',
          boxContainerId: 'chart-boxplot-atitude',
          propTitle: `Proporções de Respostas por Item (${selected.ano})`,
          boxTitle: `Boxplot das Médias por Item (${selected.ano})`,
          meanTitle: `Médias dos Itens (${selected.ano})`,
          propCaption: `Proporções por Item — Atitude (${selected.ano})`,
          boxCaption: `Boxplot por Item — Atitude (${selected.ano})`,
          meanCaption: `Médias dos Itens — Atitude (${selected.ano})`,
          tableTitle: 'Estatísticas — Atitude Profissional',
        });

        await addSection('Gestão Didática', agg, {
          propKey: 'acaoDocenteGestao',
          meanKey: 'mediasItensGestao',
          statsKey: 'boxplotGestaoStats',
          labelField: 'item',
          boxContainerId: 'chart-boxplot-gestao',
          propTitle: `Proporções de Respostas por Item (${selected.ano})`,
          boxTitle: `Boxplot das Médias por Item (${selected.ano})`,
          meanTitle: `Médias dos Itens (${selected.ano})`,
          propCaption: `Proporções por Item — Gestão (${selected.ano})`,
          boxCaption: `Boxplot por Item — Gestão (${selected.ano})`,
          meanCaption: `Médias dos Itens — Gestão (${selected.ano})`,
          tableTitle: 'Estatísticas — Gestão Didática',
        });

        await addSection('Processo Avaliativo', agg, {
          propKey: 'acaoDocenteProcesso',
          meanKey: 'mediasItensProcesso',
          statsKey: 'boxplotProcessoStats',
          labelField: 'item',
          boxContainerId: 'chart-boxplot-processo',
          propTitle: `Proporções de Respostas por Item (${selected.ano})`,
          boxTitle: `Boxplot das Médias por Item (${selected.ano})`,
          meanTitle: `Médias dos Itens (${selected.ano})`,
          propCaption: `Proporções por Item — Processo (${selected.ano})`,
          boxCaption: `Boxplot por Item — Processo (${selected.ano})`,
          meanCaption: `Médias dos Itens — Processo (${selected.ano})`,
          tableTitle: 'Estatísticas — Processo Avaliativo',
        });

        await addSection('Instalações Físicas e Recursos de TI', agg, {
          propKey: 'infraestruturaItens',
          meanKey: 'mediasItensInfra',
          statsKey: 'boxplotInfraStats',
          labelField: 'item',
          boxContainerId: 'chart-boxplot-infra',
          propTitle: `Proporções de Respostas por Item (${selected.ano})`,
          boxTitle: `Boxplot das Médias por Item (${selected.ano})`,
          meanTitle: `Médias dos Itens (${selected.ano})`,
          propCaption: `Proporções por Item — Infraestrutura (${selected.ano})`,
          boxCaption: `Boxplot por Item — Infraestrutura (${selected.ano})`,
          meanCaption: `Médias dos Itens — Infraestrutura (${selected.ano})`,
          tableTitle: 'Estatísticas — Infraestrutura',
        });

        if (isAllPolos && yearDef.hasPolos) {
          const totalPolos = polosToRender.length || 1;
          const pct = Math.min(95, Math.round(((idx + 1) / totalPolos) * 100));
          setProgressText(`Gerando páginas ${idx + 1}/${totalPolos}…`);
          setProgress(pct);
        }
      }

      if (isAllPolos && yearDef.hasPolos) {
        setProgressText('Anexando questionário…');
        setProgress((p) => Math.max(p, 96));
      }

      const baseBlob = doc.output('blob');
      const baseBytes = await baseBlob.arrayBuffer();
      let questionarioPdfPath = '/questionario_disc.pdf';
      if (selected.ano === '2025') questionarioPdfPath = '/questionario_disc_2025.pdf';
      else if (selected.ano === '2023') questionarioPdfPath = '/questionario_disc_2025.pdf';
      const finalBlob = await mergeWithExternalPdf(baseBytes, questionarioPdfPath);

      const url = URL.createObjectURL(finalBlob);
      if (!isStale()) {
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = url;
        setPdfUrl(url);
        lastBuiltSigRef.current = requestSig;

        setProgressText('Concluído!');
        setProgress(100);
      } else {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (isStale()) return;
      console.error('Erro ao gerar PDF:', err);
      setPdfError('Não foi possível gerar o PDF. Verifique os filtros ou recarregue a página.');
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = '';
      }
      setPdfUrl('');
    } finally {
      buildingRef.current = false;
      currentBuildSigRef.current = '';
      setIsGeneratingPreview(false);
      setForceBlocking(false);
      setBlocking(false);

      if (pendingBuildRef.current) {
        pendingBuildRef.current = false;
        setTimeout(() => {
          if (latestCanGenerateRef.current) {
            buildPdf(latestSelSigRef.current);
          }
        }, 0);
      }
    }
  }

  useEffect(() => {
    latestCanGenerateRef.current = canGenerate;
    latestIframeReadyRef.current = iframeReady;

    if (!canGenerate) {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = '';
      }
      setPdfUrl('');
      setIsGeneratingPreview(false);
      return;
    }

    function maybeBuild() {
      if (!(canGenerate && iframeReady)) return;
      if (buildingRef.current) return;
      if (lastBuiltSigRef.current === selSig && pdfUrl) return;

      const t = setTimeout(() => buildPdf(selSig), 400);
      return () => clearTimeout(t);
    }

    const cleanup = maybeBuild();

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [canGenerate, iframeReady, selSig, yearDef.hasPolos, isAllPolos, selected.ano, selected.curso]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = '';
      }
    };
  }, []);

  const downloadName = `relatorio-avalia-${selected.ano}-${selected.curso || 'curso'}${
    yearDef.hasPolos
      ? isAllPolos
        ? '-todos-os-polos'
        : selected.polo
          ? `-${selected.polo.replace(/\s+/g, '-').toLowerCase()}`
          : ''
      : ''
  }.pdf`;

  const clampPct = (v) => Math.floor(Math.max(0, Math.min(100, v)));

  const MissingMsg = () => {
    if (!selected.ano) return <>Selecione <strong>Ano</strong> para começar.</>;
    if (yearDef.hasPolos) return <>Selecione <strong>Polo</strong> para gerar o PDF.</>;
    return <>Selecione <strong>Curso</strong> para gerar o PDF.</>;
  };

  return (
    <div>
      <div ref={contentRef}>
        <div className={styles.filtersContainer}>
          <EadFilters
            filters={filters}
            selectedFilters={selected}
            onFilterChange={handleFilterChange}
            visibleFields={visibleFields}
            poloPlaceholder={POLO_PLACEHOLDER}
            disablePlaceholderOption
            showAllPolosOption
            allPolosLabel={ALL_POLOS_LABEL}
          />
        </div>

        <ReportViewer
          canGenerate={canGenerate}
          pdfUrl={pdfUrl}
          pdfError={pdfError}
          downloadName={downloadName}
          blocking={blocking}
          progress={progress}
          progressText={progressText}
          isAllContexts={isAllPolos}
          missingMessage={<MissingMsg />}
          clampPct={clampPct}
          contextConfig={REPORT_CONTEXTS.ead}
          isGeneratingPreview={isGeneratingPreview}
        />

        <iframe
          ref={chartsIframeRef}
          src={iframeSrc}
          title="Fonte dos boxplots para o PDF"
          style={{
            position: 'absolute',
            left: -99999,
            top: -99999,
            width: 2400,
            height: 4200,
            opacity: 0,
            pointerEvents: 'none',
          }}
          onLoad={() => setIframeReady(true)}
        />
      </div>
    </div>
  );
}
