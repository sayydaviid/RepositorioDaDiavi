'use client';

import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { toPng } from 'html-to-image';
import { useRouter, useSearchParams } from 'next/navigation';
import DiscenteFilters from '../../components/DiscenteFilterAvalia';
import BoxplotChart from '../../components/BoxplotChart';
import ReportViewer from '../../../../../components/ReportViewer';
import { REPORT_CONTEXTS } from '../../../../../components/reportContexts';
import styles from '../../../../../styles/dados.module.css';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { getCoverImageForYear } from './capa/capa';
import boxplotImage from '../../../files/boxplot.jpeg';
import {
  INTRO_FOOTER_TEXT,
  INTRO_PARAGRAPHS_TEMPLATE,
  INTRO_TITLE_TEMPLATE,
} from './capa/texto';

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function safeNum(val) {
  if (val === undefined || val === null || val === 'NA' || val === '') return NaN;
  if (Array.isArray(val)) val = val[0];
  if (typeof val === 'number') return val;
  const strVal = String(val).replace(',', '.').trim();
  const num = Number(strVal);
  return Number.isNaN(num) ? NaN : num;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFilterValue(value, fallback = 'todos') {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  if (!s) return fallback;
  const lower = s.toLowerCase();
  if (
    ['all', 'todos', 'todas', 'todo', 'qualquer', 'none', 'null', 'undefined'].includes(
      lower
    )
  ) {
    return 'todos';
  }
  return s;
}

function coerceRows(apiData) {
  if (Array.isArray(apiData)) return apiData;
  if (!apiData || typeof apiData !== 'object') return [];

  const candidates = [
    'data',
    'tabela',
    'tabela2',
    'tabela_items',
    'rows',
    'result',
    'descritivas',
    'estatisticas',
  ];

  for (const k of candidates) {
    if (Array.isArray(apiData?.[k])) return apiData[k];
  }

  return [];
}

function formatPdfCell(v) {
  if (v === null || v === undefined) return '';
  const num = Number(v);
  if (Number.isFinite(num) && typeof v !== 'boolean') {
    return num.toFixed(2).replace('.', ',');
  }
  return String(v);
}

function hasAnyBoxplotPayload(data) {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data !== 'object') return false;

  if (Array.isArray(data.boxplot_data) && data.boxplot_data.length > 0) return true;
  if (Array.isArray(data.series) && data.series.length > 0) return true;
  if (Array.isArray(data.data) && data.data.length > 0) return true;
  if (Array.isArray(data.rows) && data.rows.length > 0) return true;
  if (Array.isArray(data.tabela2) && data.tabela2.length > 0) return true;
  if (Array.isArray(data.tabela) && data.tabela.length > 0) return true;
  if (Array.isArray(data.tabela_items) && data.tabela_items.length > 0) return true;

  return Object.keys(data).length > 0;
}

function ensurePageSpace(doc, y, needed = 120, top = 60, bottomMargin = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - bottomMargin) {
    doc.addPage();
    return top;
  }
  return y;
}

function formatItemCodeLabel(val) {
  const s = String(val ?? '').trim();

  const dottedMatch = s.match(/^(\d+)\.(\d)(\d+)(.*)$/);
  if (dottedMatch) {
    const [, part1, part2, part3, rest] = dottedMatch;
    const finalCode = `${part1}.${part2}.${part3}`;
    return rest && rest.trim() ? `${finalCode}${rest}` : finalCode;
  }

  if (/^\d{3,}$/.test(s)) {
    const part1 = s[0];
    const part2 = s[1];
    const part3 = s.slice(2);
    return `${part1}.${part2}.${part3}`;
  }

  return s;
}

function compareItemCodes(a, b) {
  const parseCode = (value) =>
    String(value ?? '')
      .trim()
      .split('.')
      .map((x) => Number.parseInt(x, 10))
      .filter((n) => Number.isFinite(n));

  const A = parseCode(a);
  const B = parseCode(b);
  const len = Math.max(A.length, B.length);

  for (let i = 0; i < len; i++) {
    const av = A[i] ?? -1;
    const bv = B[i] ?? -1;
    if (av !== bv) return av - bv;
  }

  return String(a ?? '').localeCompare(String(b ?? ''));
}

function normalizeFigureTitle(title) {
  const raw = String(title ?? '');
  return raw
    .replace(/[\u0012−–—]/g, '-')
    .replace(/(Figura\s+\d+)\s*-\s*/i, '$1 - ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getRowLabel(row, labelField) {
  if (!row) return '';

  if (labelField === 'item') return formatItemCodeLabel(row?.item);
  if (labelField === 'subdimensao') return String(row?.subdimensao ?? '');
  if (labelField === 'dimensao') return String(row?.dimensao ?? '');
  if (labelField === 'atividade') return String(row?.atividade ?? '');

  return String(row?.[labelField] ?? '');
}

function sortRowsForChart(data, labelField) {
  const rows = Array.isArray(data) ? [...data] : [];

  if (labelField === 'item') {
    rows.sort((a, b) =>
      compareItemCodes(formatItemCodeLabel(a?.item), formatItemCodeLabel(b?.item))
    );
    return rows;
  }

  if (labelField === 'subdimensao') {
    rows.sort((a, b) =>
      String(a?.subdimensao ?? '').localeCompare(String(b?.subdimensao ?? ''), 'pt-BR')
    );
    return rows;
  }

  return rows;
}

function drawSimpleBarChart(
  doc,
  y,
  pageWidth,
  title,
  data,
  {
    valueField = 'media',
    labelField = 'dimensao',
    fixedMax = null,
    showPercentAxis = false,
  } = {}
) {
  if (!Array.isArray(data) || data.length === 0) return y;

  const normalizedTitle = normalizeFigureTitle(title);

  const rows = sortRowsForChart(data, labelField);
  const numericValues = rows
    .map((d) => safeNum(d?.[valueField]))
    .filter((v) => Number.isFinite(v));

  if (!numericValues.length) return y;

  y = ensurePageSpace(doc, y, 280);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(normalizedTitle, pageWidth - 100);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += Math.max(35, titleLines.length * 12 + 12);

  const chartX = showPercentAxis ? 75 : 40;
  const chartWidth = showPercentAxis ? pageWidth - 115 : pageWidth - 80;
  const maxBarHeight = 160;
  const chartBottomY = y + maxBarHeight;
  const numItems = rows.length;
  const columnWidth = chartWidth / numItems;
  const barWidth = Math.min(columnWidth * 0.6, 50);

  const maxValue = Math.max(...numericValues);
  const scaleMax =
    fixedMax ??
    (valueField === 'percentual'
      ? 100
      : maxValue <= 5
        ? 5
        : maxValue <= 10
          ? 10
          : Math.ceil(maxValue));

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(1);
  doc.line(chartX, chartBottomY, chartX + chartWidth, chartBottomY);

  if (showPercentAxis) {
    doc.setDrawColor(160, 160, 160);
    doc.line(chartX, chartBottomY - maxBarHeight, chartX, chartBottomY);

    const ticks = [0, 25, 50, 75, 100];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    ticks.forEach((tick) => {
      const yTick = chartBottomY - (tick / 100) * maxBarHeight;
      doc.line(chartX - 4, yTick, chartX, yTick);
      doc.text(`${tick}%`, chartX - 8, yTick + 3, { align: 'right' });
    });
  }

  let maxLabelLines = 1;
  doc.setFontSize(8);

  rows.forEach((item, index) => {
    let val = safeNum(item?.[valueField]);
    if (Number.isNaN(val)) val = 0;

    const xCenter = chartX + index * columnWidth + columnWidth / 2;
    const xBar = xCenter - barWidth / 2;
    const barH = (val / scaleMax) * maxBarHeight;
    const yBar = chartBottomY - barH;

    doc.setFillColor(40, 143, 180);
    doc.rect(xBar, yBar, barWidth, barH, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(val.toFixed(2).replace('.', ','), xCenter, yBar - 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    const label = getRowLabel(item, labelField);
    const splitLabel = doc.splitTextToSize(label, columnWidth - 10);

    if (splitLabel.length > maxLabelLines) maxLabelLines = splitLabel.length;
    doc.text(splitLabel, xCenter, chartBottomY + 14, { align: 'center' });
  });

  return chartBottomY + maxLabelLines * 10 + 40;
}

function estimateSimpleBarChartHeight(doc, pageWidth, title, data, { labelField = 'dimensao' } = {}) {
  if (!Array.isArray(data) || data.length === 0) return 0;

  const normalizedTitle = normalizeFigureTitle(title);
  const rows = sortRowsForChart(data, labelField);
  if (!rows.length) return 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(normalizedTitle, pageWidth - 100);
  const titleHeight = Math.max(35, titleLines.length * 12 + 12);

  const chartWidth = pageWidth - 80;
  const numItems = rows.length;
  const columnWidth = chartWidth / numItems;

  let maxLabelLines = 1;
  rows.forEach((item) => {
    const label = getRowLabel(item, labelField);
    const splitLabel = doc.splitTextToSize(label, columnWidth - 10);
    if (splitLabel.length > maxLabelLines) maxLabelLines = splitLabel.length;
  });

  const chartAreaHeight = 160;
  const labelsAndBottom = maxLabelLines * 10 + 40;
  return titleHeight + chartAreaHeight + labelsAndBottom;
}

function drawGroupedProportionChart(doc, y, pageWidth, title, data, dimensionField = 'dimensao') {
  if (!Array.isArray(data) || data.length === 0) return y;

  const normalizedTitle = normalizeFigureTitle(title);

  // Detectar se é uma figura de "por Dimensão" para aplicar formatação especial
  const isDimensaoChart = normalizedTitle.includes('por Dimensão');

  let titleSpacing = 20;

  // Preparar a altura do título com quebra de linhas se necessário
  let titleLines = [normalizedTitle];
  if (isDimensaoChart) {
    doc.setFont('Arial', 'bold');
    doc.setFontSize(12);
    titleLines = doc.splitTextToSize(normalizedTitle, pageWidth - 120);
    titleSpacing = titleLines.length * 14 + 6;
  }

  y = ensurePageSpace(doc, y, 310 + titleSpacing);

  // Renderizar o título
  if (isDimensaoChart) {
    doc.setFont('Arial', 'bold');
    doc.setFontSize(12);
    doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
    y += titleSpacing;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const genericTitleLines = doc.splitTextToSize(normalizedTitle, pageWidth - 100);
    doc.text(genericTitleLines, pageWidth / 2, y, { align: 'center' });
    y += 20;
  }

  const categorias = ['Excelente', 'Bom', 'Regular', 'Insuficiente'];
  const cores = {
    Excelente: [29, 85, 111],
    Bom: [40, 143, 180],
    Regular: [240, 183, 117],
    Insuficiente: [250, 54, 10],
  };

  // Legenda posicionada no canto superior direito (empilhada verticalmente)
  const legendX = pageWidth - 130;
  let legendY = y;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  categorias.forEach((c) => {
    doc.setFillColor(...cores[c]);
    doc.rect(legendX, legendY, 10, 10, 'F');
    doc.setTextColor(50, 50, 50);
    doc.text(c, legendX + 15, legendY + 7);
    legendY += 10;
  });

  y += 35;

  const rawLabels = [...new Set(data.map((d) => d?.[dimensionField]).filter(Boolean))];

  if (dimensionField === 'item') {
    rawLabels.sort((a, b) =>
      compareItemCodes(formatItemCodeLabel(a), formatItemCodeLabel(b))
    );
  } else if (dimensionField === 'subdimensao') {
    rawLabels.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  }

  const chartX = 40;
  const chartWidth = pageWidth - 80;
  const maxBarHeight = 140;
  const chartBottomY = y + maxBarHeight;
  const numGroups = rawLabels.length;
  const groupWidth = chartWidth / numGroups;
  const numBarsPerGroup = categorias.length;
  const maxTotalBarsWidth = groupWidth * 0.8;
  const barWidth = Math.min(maxTotalBarsWidth / numBarsPerGroup, 25);
  const totalBarsWidth = barWidth * numBarsPerGroup;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(1);
  doc.line(chartX, chartBottomY, chartX + chartWidth, chartBottomY);

  let maxLabelLines = 1;

  rawLabels.forEach((labelBase, index) => {
    const groupCenterX = chartX + index * groupWidth + groupWidth / 2;
    const startXGroup = groupCenterX - totalBarsWidth / 2;

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const displayLabel =
      dimensionField === 'item'
        ? formatItemCodeLabel(String(labelBase || ''))
        : String(labelBase || '');

    const splitLabel = doc.splitTextToSize(displayLabel, groupWidth - 10);
    if (splitLabel.length > maxLabelLines) maxLabelLines = splitLabel.length;
    doc.text(splitLabel, groupCenterX, chartBottomY + 14, { align: 'center' });

    categorias.forEach((conc, j) => {
      const item = data.find((d) => d?.[dimensionField] === labelBase && d?.conceito === conc);
      let val = item && item.valor ? safeNum(item.valor) : 0;
      if (Number.isNaN(val)) val = 0;

      if (val > 0) {
        const barH = (val / 100) * maxBarHeight;
        const xBar = startXGroup + j * barWidth;
        const yBar = chartBottomY - barH;

        doc.setFillColor(...cores[conc]);
        doc.rect(xBar, yBar, barWidth, barH, 'F');

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(val.toFixed(2).replace('.', ','), xBar + barWidth / 2, yBar - 4, {
          align: 'center',
        });
      }
    });
  });

  return chartBottomY + maxLabelLines * 10 + 40;
}

function addSectionTableTitle(doc, y, pageWidth, title) {
  y = ensurePageSpace(doc, y, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(String(title ?? ''), pageWidth - 90);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  return y + Math.max(10, titleLines.length * 12);
}

function addPageNumbers(doc) {
  const totalPages = doc.getNumberOfPages();
  if (totalPages <= 1) return;

  for (let page = 2; page <= totalPages; page++) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(String(page - 1), pageWidth / 2, pageHeight - 20, { align: 'center' });
  }

  doc.setTextColor(0, 0, 0);
}

function formatPeriodWithDot(period) {
  return String(period ?? '').trim().replace(/-/g, '.');
}

function fillPeriodTemplate(text, period) {
  return String(text ?? '').replaceAll('{PERIODO}', period);
}

function inferCourseType(curso) {
  const raw = String(curso ?? '').toLowerCase();
  if (raw.includes('licenciatura')) return 'LICENCIATURA';
  if (raw.includes('bacharelado')) return 'BACHARELADO';
  return 'NÃO INFORMADO';
}

function extractCourseName(curso) {
  const original = String(curso ?? '').trim();
  if (!original || original.toLowerCase() === 'todos') return 'TODOS OS CURSOS';

  return original
    .replace(/\bbacharelado\b/gi, '')
    .replace(/\blicenciatura\b/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+$/g, '')
    .trim() || original;
}

async function imageSrcToDataUrl(src) {
  const resolvedSrc =
    typeof src === 'string'
      ? src
      : src?.src || src?.default?.src || src?.default || '';

  if (!resolvedSrc) {
    throw new Error('Fonte da imagem da capa inválida');
  }

  if (resolvedSrc.startsWith('data:')) {
    return resolvedSrc;
  }

  const res = await fetch(resolvedSrc, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Falha ao carregar imagem da capa (${res.status})`);
  }
  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function srcToUint8Array(src) {
  const resolvedSrc =
    typeof src === 'string'
      ? src
      : src?.src || src?.default?.src || src?.default || '';

  if (!resolvedSrc) {
    throw new Error('Fonte de arquivo inválida');
  }

  const res = await fetch(resolvedSrc, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Falha ao carregar arquivo (${res.status})`);
  }

  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

async function appendPdfAttachments(baseBlob, attachmentSources = []) {
  const baseBytes = new Uint8Array(await baseBlob.arrayBuffer());
  const mergedPdf = await PDFDocument.load(baseBytes);

  for (const src of attachmentSources) {
    try {
      const bytes = await srcToUint8Array(src);
      const attachmentPdf = await PDFDocument.load(bytes);
      const pageIndexes = attachmentPdf.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(attachmentPdf, pageIndexes);
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    } catch (err) {
      console.error('Falha ao anexar PDF complementar:', err);
    }
  }

  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes], { type: 'application/pdf' });
}

async function addCoverPage(doc, year) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const coverSrc = getCoverImageForYear(year);

  if (!coverSrc) return;

  try {
    const dataUrl = await imageSrcToDataUrl(coverSrc);
    doc.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
  } catch (err) {
    console.error('Não foi possível renderizar a capa:', err);
  }
}

async function addIntroTextPage(doc, selected) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 60;
  const right = 60;
  const textWidth = pageWidth - left - right;
  const period = formatPeriodWithDot(selected?.ano || 'N/A');
  const introTitle = fillPeriodTemplate(INTRO_TITLE_TEMPLATE, period);
  const introParagraphs = INTRO_PARAGRAPHS_TEMPLATE.map((p) => fillPeriodTemplate(p, period));
  let y = 90;

  doc.setFont('Arial', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(introTitle, textWidth);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += titleLines.length * 16 + 10;

  doc.setFont('Arial', 'normal');
  doc.setFontSize(12);

  for (const paragraph of introParagraphs) {
    const lines = doc.splitTextToSize(String(paragraph ?? ''), textWidth);
    doc.text(lines, left, y);
    y += lines.length * 16 + 14;
  }

  try {
    const boxplotDataUrl = await imageSrcToDataUrl(boxplotImage);
    const imageWidth = textWidth;
    const imageHeight = 170;
    y = ensurePageSpace(doc, y, imageHeight + 60, 60, 40);

    if (y + imageHeight > pageHeight - 70) {
      doc.addPage();
      y = 60;
    }

    doc.addImage(boxplotDataUrl, 'JPEG', left, y, imageWidth, imageHeight);
    y += imageHeight + 18;
  } catch (err) {
    console.error('Não foi possível renderizar a imagem do boxplot na introdução:', err);
  }

  const footerLines = doc.splitTextToSize(INTRO_FOOTER_TEXT, textWidth);
  doc.text(footerLines, left, y);
}

function addReportOpeningPage(doc, selected) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const period = formatPeriodWithDot(selected?.ano || 'N/A');
  const courseName = extractCourseName(selected?.curso);
  const courseType = inferCourseType(selected?.curso);
  const campus = String(selected?.campus || 'todos').toUpperCase();

  const isAllCourses = courseName.toUpperCase() === 'TODOS OS CURSOS';

  const lines = isAllCourses
    ? [`RELATÓRIO AVALIA ${period}`, 'TODOS OS CURSOS']
    : [
        `RELATÓRIO AVALIA ${period}`,
        `${courseName.toUpperCase()} -`,
        `${courseType} - ${campus}`,
      ];

  doc.setFont('Arial', 'bold');
  doc.setFontSize(20);

  const lineHeight = 28;
  const blockHeight = lines.length * lineHeight;
  let y = (pageHeight - blockHeight) / 2;

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, pageWidth - 120);
    doc.text(wrapped, pageWidth / 2, y, { align: 'center' });
    y += wrapped.length * lineHeight;
  }
}

export default function RelatorioPresencialClient({
  filtersOptions,
  initialSelected,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState({
    ano: initialSelected?.ano || '',
    campus: initialSelected?.campus || '',
    curso: initialSelected?.curso || '',
  });

  const [dynamicFilters, setDynamicFilters] = useState({
    anos: filtersOptions?.anos || filtersOptions?.ano || [],
    campus: filtersOptions?.campus || filtersOptions?.campi || [],
    cursos: filtersOptions?.cursos || filtersOptions?.curso || [],
  });

  const [summaryData, setSummaryData] = useState(null);

  const [blocking, setBlocking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Preparando…');

  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const [hiddenBoxplot, setHiddenBoxplot] = useState(null);

  const prevUrlRef = useRef('');
  const contentRef = useRef(null);
  const buildingRef = useRef(false);
  const currentBuildKeyRef = useRef('');
  const pendingBuildKeyRef = useRef('');
  const lastBuiltKeyRef = useRef('');
  const latestBuildRef = useRef(null);
  const selectedRef = useRef(selected);
  const summaryRef = useRef(summaryData);
  const hiddenBoxplotRef = useRef(null);

  const hasSelectedYear = Boolean(selected.ano);
  const hasSelectedCampus = Boolean(selected.campus);
  const hasSelectedCourse = Boolean(selected.curso);
  const canGenerate = hasSelectedYear && hasSelectedCampus && hasSelectedCourse && summaryData !== null;

  const make = (endpoint, filters = {}) => {
    const qs = new URLSearchParams();
    qs.set('endpoint', endpoint);
    qs.set('fresh', '1');

    if (filters?.ano) qs.set('ano', String(filters.ano).trim());

    if (endpoint !== '/filters') {
      qs.set('campus', normalizeFilterValue(filters?.campus, 'todos'));
      qs.set('curso', normalizeFilterValue(filters?.curso, 'todos'));
    } else {
      if (filters?.campus) qs.set('campus', normalizeFilterValue(filters.campus, 'todos'));
      if (filters?.curso) qs.set('curso', normalizeFilterValue(filters.curso, 'todos'));
    }

    return `/api/dashboard-cache?${qs.toString()}`;
  };

  const syncURL = (next) => {
    const sp = new URLSearchParams(searchParams.toString());
    next.ano ? sp.set('ano', next.ano) : sp.delete('ano');

    if (next.campus && next.campus !== 'todos') sp.set('campus', next.campus);
    else sp.delete('campus');

    if (next.curso && next.curso !== 'todos') sp.set('curso', next.curso);
    else sp.delete('curso');

    router.replace(sp.toString() ? `?${sp.toString()}` : '?');
  };

  async function fetchJsonOptional(endpoint, filters = selectedRef.current) {
    try {
      const res = await fetch(make(endpoint, filters), { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function waitForChartRender(ref, timeout = 8000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = ref.current;
      if (
        el &&
        (el.querySelector('svg') ||
          el.querySelector('canvas') ||
          el.querySelector('.apexcharts-canvas') ||
          el.querySelector('.apexcharts-svg'))
      ) {
        await sleep(200);
        return;
      }
      await sleep(120);
    }

    throw new Error('O boxplot não renderizou a tempo para captura.');
  }

  async function captureBoxplotPng({ key, title, apiData }) {
    if (!hasAnyBoxplotPayload(apiData)) return null;

    flushSync(() => {
      setHiddenBoxplot({
        key,
        title,
        apiData,
      });
    });

    await sleep(80);
    await waitForChartRender(hiddenBoxplotRef);

    const dataUrl = await toPng(hiddenBoxplotRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });

    flushSync(() => {
      setHiddenBoxplot(null);
    });

    await sleep(30);

    return dataUrl;
  }

  function extractTableDataFrom(source, primaryKey, secondaryKey, fallbackKey) {
    if (!source) return '—';
    const dataObj = Array.isArray(source) ? source[0] : source;
    let val = dataObj?.[primaryKey] ?? dataObj?.[secondaryKey] ?? dataObj?.[fallbackKey];
    if (Array.isArray(val)) val = val[0];
    if (val === 'NA' || val === 'NaN' || val === null || val === undefined || val === '') {
      return '—';
    }
    return val;
  }

  async function addBoxplotFigure(doc, y, pageWidth, figureTitle, boxplotData) {
    if (!hasAnyBoxplotPayload(boxplotData)) return y;

    const normalizedFigureTitle = normalizeFigureTitle(figureTitle);

    y = ensurePageSpace(doc, y, 320);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(normalizedFigureTitle, pageWidth - 100);
    doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
    y += Math.max(18, titleLines.length * 12 + 6);

    try {
      const image = await captureBoxplotPng({
        key: normalizedFigureTitle,
        title: normalizedFigureTitle.replace(/^Figura \d+\s+[\u0012−-]\s+/, ''),
        apiData: boxplotData,
      });

      if (!image) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(150, 50, 50);
        doc.text(
          'Dados insuficientes para gerar o boxplot nesta seleção.',
          pageWidth / 2,
          y + 20,
          { align: 'center' }
        );
        doc.setTextColor(0, 0, 0);
        return y + 40;
      }

      const imageWidth = pageWidth - 80;
      const imageHeight = 250;
      doc.addImage(image, 'PNG', 40, y, imageWidth, imageHeight);
      y += imageHeight + 22;

      return y;
    } catch (err) {
      console.error(`Erro ao capturar ${normalizedFigureTitle}:`, err);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(150, 50, 50);
      doc.text('Não foi possível capturar este boxplot para o PDF.', pageWidth / 2, y + 20, {
        align: 'center',
      });
      doc.setTextColor(0, 0, 0);
      return y + 40;
    }
  }

  function addDescritivasTable(doc, y, pageWidth, title, descritivas) {
    y = ensurePageSpace(doc, y, 180);
    y = addSectionTableTitle(doc, y, pageWidth, title);

    const rows = coerceRows(descritivas);

    if (rows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(150, 50, 50);
      doc.text(
        'Estatísticas descritivas não disponíveis para esta seleção.',
        pageWidth / 2,
        y + 20,
        { align: 'center' }
      );
      doc.setTextColor(0, 0, 0);
      return y + 40;
    }

    const lowerTitle = title.toLowerCase();

    const isTabela2 =
      title.includes('Tabela 2') ||
      lowerTitle.includes('médias das avaliações das turmas/docentes por dimensão');

    const isTabela3 =
      title.includes('Tabela 3') ||
      lowerTitle.includes('subdimensão da ação docente') ||
      lowerTitle.includes('subdimensões da ação docente');

    const isTabela4 =
      title.includes('Tabela 4') ||
      lowerTitle.includes('item relacionado à autoavaliação discente') ||
      lowerTitle.includes('itens relacionados à autoavaliação discente');

    const isTabela5 =
      title.includes('Tabela 5') ||
      lowerTitle.includes('item relacionado à atitude profissional') ||
      lowerTitle.includes('itens relacionados à atitude profissional');

    const isTabela6 =
      title.includes('Tabela 6') ||
      lowerTitle.includes('item relacionado à gestão didática') ||
      lowerTitle.includes('itens relacionados à gestão didática') ||
      lowerTitle.includes('item relacionado à gestao didatica') ||
      lowerTitle.includes('itens relacionados à gestao didatica');

    const isTabela7 =
      title.includes('Tabela 7') ||
      lowerTitle.includes('item relacionado ao processo avaliativo') ||
      lowerTitle.includes('itens relacionados ao processo avaliativo');

    const isTabela8 =
      title.includes('Tabela 8') ||
      lowerTitle.includes('item relacionado às instalações físicas') ||
      lowerTitle.includes('itens relacionados às instalações físicas') ||
      lowerTitle.includes('item relacionado as instalações físicas') ||
      lowerTitle.includes('itens relacionados as instalações físicas') ||
      lowerTitle.includes('item relacionado às instalacoes fisicas') ||
      lowerTitle.includes('itens relacionados às instalacoes fisicas') ||
      lowerTitle.includes('item relacionado as instalacoes fisicas') ||
      lowerTitle.includes('itens relacionados as instalacoes fisicas');

    if (isTabela4 || isTabela5 || isTabela6 || isTabela7 || isTabela8) {
      const hasOwn = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

      const pick = (obj, candidates) => {
        for (const c of candidates) if (hasOwn(obj, c)) return obj[c];
        return undefined;
      };

      const itemKey =
        Object.keys(rows[0] || {}).find((k) => k.toLowerCase() === 'item') || 'item';

      const byItem = new Map();

      for (const r of rows) {
        const rawItem = pick(r, [itemKey, 'Item', 'ITEM']);
        if (rawItem !== undefined && rawItem !== null && String(rawItem).trim() !== '') {
          const normalizedItem = formatItemCodeLabel(String(rawItem).trim());
          byItem.set(normalizedItem, r);
        }
      }

      const items = Array.from(byItem.keys()).sort(compareItemCodes);

      const stats = [
        { value: 'Min', keys: ['Min', 'min', 'MIN'] },
        { value: 'Q1', keys: ['Q1', 'q1', '1st Qu.', '1st Qu', '1st_qu', '1st_qu.'] },
        { value: 'Mediana', keys: ['Mediana', 'mediana', 'Median', 'median'] },
        { value: 'Média', keys: ['Media', 'media', 'Média', 'média', 'Mean', 'mean'] },
        { value: 'Q3', keys: ['Q3', 'q3', '3rd Qu.', '3rd Qu', '3rd_qu', '3rd_qu.'] },
        { value: 'Max', keys: ['Max', 'max', 'MAX'] },
      ];

      const headers = ['Estatística', ...items];
      const body = stats.map((st) => [
        st.value,
        ...items.map((it) => {
          const row = byItem.get(it);
          const value = row ? pick(row, st.keys) : '';
          return formatPdfCell(value);
        }),
      ]);

      autoTable(doc, {
        startY: y,
        head: [headers],
        body,
        theme: 'striped',
        headStyles: { fillColor: [40, 143, 180] },
        margin: { left: 40, right: 40 },
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', cellWidth: 'wrap' },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: 'bold' },
        },
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: 0,
      });

      return doc.lastAutoTable.finalY + 30;
    }

    let headers = Object.keys(rows[0] || {});

    if (isTabela2) {
      const preferredOrder = [
        'Estatística',
        'Estatistica',
        'Autoavaliação Discente',
        'Ação Docente',
        'Instalações Físicas',
      ];

      const ordered = [];
      for (const h of preferredOrder) {
        if (headers.includes(h)) ordered.push(h);
      }
      for (const h of headers) {
        if (!ordered.includes(h)) ordered.push(h);
      }
      headers = ordered;
    }

    if (isTabela3) {
      const preferredOrder = [
        'Estatística',
        'Estatistica',
        'Atitude Profissional',
        'Gestão Didática',
        'Processo Avaliativo',
      ];

      const ordered = [];
      for (const h of preferredOrder) {
        if (headers.includes(h)) ordered.push(h);
      }
      for (const h of headers) {
        if (!ordered.includes(h)) ordered.push(h);
      }
      headers = ordered;
    }

    const body = rows.map((row) => headers.map((h) => formatPdfCell(row?.[h])));

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      theme: 'striped',
      headStyles: { fillColor: [40, 143, 180] },
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', cellWidth: 'wrap' },
    });

    return doc.lastAutoTable.finalY + 30;
  }

  useEffect(() => {
    const controller = new AbortController();

    const loadInitialFilters = async () => {
      try {
        const res = await fetch(make('/filters'), { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao carregar filtros iniciais');
        const data = await res.json();

        setDynamicFilters((prev) => ({
          ...prev,
          anos: data?.anos || data?.ano || prev.anos,
        }));
      } catch {}
    };

    loadInitialFilters();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selected.ano) {
      setDynamicFilters((prev) => ({
        ...prev,
        campus: [],
        cursos: [],
      }));
      return;
    }

    const controller = new AbortController();

    const loadYearFilters = async () => {
      try {
        const res = await fetch(make('/filters', selected), { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao carregar filtros');
        const data = await res.json();

        setDynamicFilters((prev) => ({
          ...prev,
          campus: data?.campus || data?.campi || [],
          cursos: data?.cursos || data?.curso || [],
        }));
      } catch {}
    };

    loadYearFilters();
    return () => controller.abort();
  }, [selected.ano, selected.campus, selected.curso]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    summaryRef.current = summaryData;
  }, [summaryData]);

  useEffect(() => {
    if (!selected.ano || !selected.campus || !selected.curso) {
      setSummaryData(null);
      return;
    }

    setSummaryData(null);

    const controller = new AbortController();

    const loadSummary = async () => {
      try {
        const res = await fetch(make('/discente/geral/summary', selected), {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Falha ao carregar summary');
        const data = await res.json();
        setSummaryData(data || { empty: true });
      } catch {
        setSummaryData({ empty: true });
      }
    };

    loadSummary();
    return () => controller.abort();
  }, [selected.ano, selected.campus, selected.curso]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setPdfError('');
    setPdfUrl('');
    setIsGeneratingPreview(false);

    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = '';
    }

    let next = { ...selected, [name]: value };

    if (name === 'ano') {
      next = { ano: value, campus: '', curso: '' };
    } else if (name === 'campus') {
      next = { ...selected, campus: value, curso: '' };
    }

    setSelected(next);
    syncURL(next);
  };

  async function buildPdf() {
    const selectedSnapshot = selectedRef.current;
    const buildKey = `${selectedSnapshot?.ano || ''}|${selectedSnapshot?.campus || 'todos'}|${selectedSnapshot?.curso || 'todos'}`;

    if (buildingRef.current) {
      if (buildKey !== currentBuildKeyRef.current) {
        pendingBuildKeyRef.current = buildKey;
      }
      return;
    }

    if (buildKey && buildKey === lastBuiltKeyRef.current && prevUrlRef.current) {
      return;
    }

    buildingRef.current = true;
    currentBuildKeyRef.current = buildKey;

    setBlocking(true);
    setIsGeneratingPreview(true);
    setPdfError('');
    setProgress(5);
    setProgressText('Coletando dados da API...');

    const summarySnapshot = summaryRef.current;
    const canGenerateSnapshot =
      Boolean(selectedSnapshot?.ano) &&
      Boolean(selectedSnapshot?.campus) &&
      Boolean(selectedSnapshot?.curso) &&
      summarySnapshot !== null;

    if (!canGenerateSnapshot) {
      buildingRef.current = false;
      setIsGeneratingPreview(false);
      setBlocking(false);
      return;
    }

    try {
      // ---------------------------------------------------------------------
      // DADOS GERAIS
      // ---------------------------------------------------------------------
      const mediasData = await fetchJsonOptional('/discente/dimensoes/medias', selectedSnapshot);
      setProgress(8);

      const docMediasData = await fetchJsonOptional('/docente/dimensoes/medias', selectedSnapshot);
      setProgress(10);

      const proporcoesData = await fetchJsonOptional('/discente/dimensoes/proporcoes', selectedSnapshot);
      setProgress(12);

      const docProporcoesData = await fetchJsonOptional('/docente/dimensoes/proporcoes', selectedSnapshot);
      setProgress(14);

      // ---------------------------------------------------------------------
      // BLOCO SUBDIMENSÕES DA AÇÃO DOCENTE
      // ---------------------------------------------------------------------
      const acaoDocSubMedDisc = await fetchJsonOptional(
        '/discente/acaodocente/subdimensoes/medias',
        selectedSnapshot
      );
      setProgress(18);

      const autoAcaoDocSubMed = await fetchJsonOptional(
        '/docente/autoavaliacao/subdimensoes/medias',
        selectedSnapshot
      );
      setProgress(21);

      const acaoDocSubPropDisc = await fetchJsonOptional(
        '/discente/acaodocente/subdimensoes/proporcoes',
        selectedSnapshot
      );
      setProgress(24);

      const autoAcaoDocSubProp = await fetchJsonOptional(
        '/docente/autoavaliacao/subdimensoes/proporcoes',
        selectedSnapshot
      );
      setProgress(27);

      let turmaSubdimBoxplot = await fetchJsonOptional(
        '/discente/acaodocente/subdimensoes/boxplot',
        selectedSnapshot
      );
      if (!turmaSubdimBoxplot) {
        turmaSubdimBoxplot = await fetchJsonOptional(
          '/docente/acaodocente/subdimensoes/boxplot',
          selectedSnapshot
        );
      }
      if (!turmaSubdimBoxplot) {
        turmaSubdimBoxplot = await fetchJsonOptional(
          '/docente_base/autoavaliacao/subdimensoes/boxplot',
          selectedSnapshot
        );
      }
      setProgress(30);

      // ---------------------------------------------------------------------
      // BLOCO ITENS AUTOAVALIAÇÃO / AVALIAÇÃO DA TURMA
      // ---------------------------------------------------------------------
      const autoavaliacaoItensMedias = await fetchJsonOptional(
        '/discente/autoavaliacao/itens/medias',
        selectedSnapshot
      );
      setProgress(33);

      const avaliacaoTurmaItensMedias = await fetchJsonOptional(
        '/docente/avaliacaoturma/itens/medias',
        selectedSnapshot
      );
      setProgress(36);

      const autoavaliacaoItensProporcoes = await fetchJsonOptional(
        '/discente/autoavaliacao/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(39);

      const avaliacaoTurmaItensProporcoes = await fetchJsonOptional(
        '/docente/avaliacaoturma/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(42);

      const autoavaliacaoItensBox = await fetchJsonOptional(
        '/discente/autoavaliacao/itens/boxplot',
        selectedSnapshot
      );
      setProgress(45);

      // ---------------------------------------------------------------------
      // BLOCO ATITUDE PROFISSIONAL
      // ---------------------------------------------------------------------
      const atitudeProfissionalItensMedias = await fetchJsonOptional(
        '/discente/atitudeprofissional/itens/medias',
        selectedSnapshot
      );
      setProgress(48);

      const atitudeProfissionalItensMediasDoc = await fetchJsonOptional(
        '/docente/atitudeprofissional/itens/medias',
        selectedSnapshot
      );
      setProgress(51);

      const atitudeProfissionalItensProporcoes = await fetchJsonOptional(
        '/discente/atitudeprofissional/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(54);

      const atitudeProfissionalItensProporcoesDoc = await fetchJsonOptional(
        '/docente/atitudeprofissional/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(57);

      const atitudeProfissionalBoxplot = await fetchJsonOptional(
        '/discente/atitudeprofissional/itens/boxplot',
        selectedSnapshot
      );
      setProgress(60);

      // ---------------------------------------------------------------------
      // BLOCO GESTÃO DIDÁTICA
      // ---------------------------------------------------------------------
      const gestaoDidaticaItensMedias = await fetchJsonOptional(
        '/discente/gestaodidatica/itens/medias',
        selectedSnapshot
      );
      setProgress(63);

      const gestaoDidaticaItensMediasDoc = await fetchJsonOptional(
        '/docente/gestaodidatica/itens/medias',
        selectedSnapshot
      );
      setProgress(66);

      const gestaoDidaticaItensProporcoes = await fetchJsonOptional(
        '/discente/gestaodidatica/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(69);

      const gestaoDidaticaItensProporcoesDoc = await fetchJsonOptional(
        '/docente/gestaodidatica/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(72);

      const gestaoDidaticaBoxplot = await fetchJsonOptional(
        '/discente/gestaodidatica/itens/boxplot',
        selectedSnapshot
      );
      setProgress(75);

      // ---------------------------------------------------------------------
      // BLOCO PROCESSO AVALIATIVO
      // ---------------------------------------------------------------------
      const processoAvaliativoItensMediasDisc = await fetchJsonOptional(
        '/discente/processoavaliativo/itens/medias',
        selectedSnapshot
      );
      setProgress(78);

      const processoAvaliativoItensMediasDoc = await fetchJsonOptional(
        '/docente/processoavaliativo/itens/medias',
        selectedSnapshot
      );
      setProgress(80);

      const processoAvaliativoItensProporcoesDisc = await fetchJsonOptional(
        '/discente/processoavaliativo/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(82);

      const processoAvaliativoItensProporcoesDoc = await fetchJsonOptional(
        '/docente/processoavaliativo/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(84);

      const processoAvaliativoBoxplot = await fetchJsonOptional(
        '/discente/processoavaliativo/itens/boxplot',
        selectedSnapshot
      );
      setProgress(86);

      // ---------------------------------------------------------------------
      // BLOCO INSTALAÇÕES FÍSICAS
      // ---------------------------------------------------------------------
      const instalacoesItensMediasDisc = await fetchJsonOptional(
        '/discente/instalacoes/itens/medias',
        selectedSnapshot
      );
      setProgress(88);

      const instalacoesItensMediasDoc = await fetchJsonOptional(
        '/docente/instalacoes/itens/medias',
        selectedSnapshot
      );
      setProgress(89);

      const instalacoesItensProporcoesDisc = await fetchJsonOptional(
        '/discente/instalacoes/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(90);

      const instalacoesItensProporcoesDoc = await fetchJsonOptional(
        '/docente/instalacoes/itens/proporcoes',
        selectedSnapshot
      );
      setProgress(91);

      const instalacoesBoxplot = await fetchJsonOptional(
        '/discente/instalacoes/itens/boxplot',
        selectedSnapshot
      );
      setProgress(92);

      // ---------------------------------------------------------------------
      // BLOCO ATIVIDADES ACADÊMICAS
      // ---------------------------------------------------------------------
      const atividadesDiscente = await fetchJsonOptional(
        '/discente/atividades/percentual',
        selectedSnapshot
      );
      setProgress(94);

      const atividadesDocente = await fetchJsonOptional(
        '/docente/atividades/percentual',
        selectedSnapshot
      );
      setProgress(95);

      // ---------------------------------------------------------------------
      // BOXPLOT DIMENSÕES E DESCRITIVAS
      // ---------------------------------------------------------------------
      let turmaDimBoxplot = await fetchJsonOptional(
        '/docente/avaliacaoturma/dimensoes/boxplot',
        selectedSnapshot
      );
      if (!turmaDimBoxplot) {
        turmaDimBoxplot = await fetchJsonOptional('/docente/dimensoes/boxplot', selectedSnapshot);
      }
      setProgress(96);

      let turmaDimDescritivas = await fetchJsonOptional(
        '/docente/avaliacaoturma/dimensoes/descritivas',
        selectedSnapshot
      );
      if (!turmaDimDescritivas && turmaDimBoxplot && typeof turmaDimBoxplot === 'object') {
        const hasTabela =
          Array.isArray(turmaDimBoxplot?.tabela2) ||
          Array.isArray(turmaDimBoxplot?.tabela) ||
          Array.isArray(turmaDimBoxplot?.rows);

        if (hasTabela) turmaDimDescritivas = turmaDimBoxplot;
      }
      if (!turmaDimDescritivas) {
        turmaDimDescritivas = await fetchJsonOptional(
          '/docente/avaliacaoturma/dimensoes/estatisticas',
          selectedSnapshot
        );
      }
      if (!turmaDimDescritivas) {
        turmaDimDescritivas = await fetchJsonOptional('/docente/dimensoes/descritivas', selectedSnapshot);
      }
      setProgress(97);

      setProgressText('Montando PDF...');
      setProgress(99);

      // ---------------------------------------------------------------------
      // PDF
      // ---------------------------------------------------------------------
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      await addCoverPage(doc, selectedSnapshot?.ano);
      doc.addPage();
      await addIntroTextPage(doc, selectedSnapshot);
      doc.addPage();
      addReportOpeningPage(doc, selectedSnapshot);
      doc.addPage();

      let y = 60;

      y = addSectionTableTitle(doc, y, pageWidth, 'Tabela 1: Informações Gerais da Avaliação');

      const numDocentes = extractTableDataFrom(summarySnapshot, 'n_docente', 'nDocente', 'n_docente');
      const numDiscentes = extractTableDataFrom(summarySnapshot, 'n_discente', 'nDiscente', 'total_respondentes');
      const numTurmas = extractTableDataFrom(summarySnapshot, 'n_turmas', 'nTurmas', 'n_turmas');

      autoTable(doc, {
        startY: y,
        head: [['Variável', 'Quantitativo']],
        body: [
          ['Número de Docentes', numDocentes],
          ['Número de Discentes', numDiscentes],
          ['Número de Turmas', numTurmas],
        ],
        theme: 'striped',
        headStyles: { fillColor: [40, 143, 180] },
        margin: { left: 40, right: 40 },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' },
      });

      y = doc.lastAutoTable.finalY + 40;

      y = drawSimpleBarChart(
        doc,
        y,
        pageWidth,
        'Figura 1 − Médias por dimensão (Discente)',
        mediasData,
        { valueField: 'media', labelField: 'dimensao' }
      );

      y = drawSimpleBarChart(
        doc,
        y,
        pageWidth,
        'Figura 2 − Médias por dimensão (Docente)',
        docMediasData,
        { valueField: 'media', labelField: 'dimensao' }
      );

      const blocks = [
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 3 − Proporções de respostas dadas por Dimensão (Discente)',
              proporcoesData,
              'dimensao'
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 4 − Proporções de respostas dadas por Dimensão (Docente)',
              docProporcoesData,
              'dimensao'
            ),
        },
        {
          render: (d, yy, pw) =>
            addBoxplotFigure(
              d,
              yy,
              pw,
              'Figura 5 − Distribuição das Médias das Avaliações das Turmas/Docente por Dimensão',
              turmaDimBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            addDescritivasTable(
              d,
              yy,
              pw,
              'Tabela 2: Estatísticas Descritivas das Médias das Avaliações das Turmas/Docentes por Dimensão',
              turmaDimDescritivas
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 6 − Médias por Subdimensão da Avaliação da Ação Docente',
              acaoDocSubMedDisc,
              { valueField: 'media', labelField: 'subdimensao' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 7 − Médias por Subdimensão da Autoavaliação da Ação Docente',
              autoAcaoDocSubMed,
              { valueField: 'media', labelField: 'subdimensao' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 8 − Proporções de respostas dadas por Subdimensão da Avaliação da Ação Docente',
              acaoDocSubPropDisc,
              'subdimensao'
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 9 − Proporções de respostas dadas por Subdimensão da Autoavaliação da Ação Docente',
              autoAcaoDocSubProp,
              'subdimensao'
            ),
        },
        {
          render: (d, yy, pw) =>
            addBoxplotFigure(
              d,
              yy,
              pw,
              'Figura 10 − Distribuição das Médias das Avaliações das Turmas/Docentes por Subdimensão da Ação Docente',
              turmaSubdimBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            addDescritivasTable(
              d,
              yy,
              pw,
              'Tabela 3: Estatísticas descritivas das Médias das Avaliações das Turmas/Docentes por Subdimensão da Ação Docente',
              turmaSubdimBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 11 − Médias dos itens relacionados à Autoavaliação Discente',
              autoavaliacaoItensMedias,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 12 − Médias dos itens relacionados à Avaliação da Turma',
              avaliacaoTurmaItensMedias,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 13 − Proporções de respostas dadas aos itens relacionados à Autoavaliação Discente',
              autoavaliacaoItensProporcoes,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 14 − Proporções de respostas dadas aos itens relacionados à Avaliação da Turma',
              avaliacaoTurmaItensProporcoes,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            addBoxplotFigure(
              d,
              yy,
              pw,
              'Figura 15 − Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado à Autoavaliação Discente',
              autoavaliacaoItensBox
            ),
        },
        {
          render: (d, yy, pw) =>
            addDescritivasTable(
              d,
              yy,
              pw,
              'Tabela 4: Estatísticas descritivas das Médias das Avaliações das Turmas/Docentes por Item relacionado à Autoavaliação Discente',
              autoavaliacaoItensBox
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 16 − Médias dos itens relacionados à Atitude Profissional (Discente)',
              atitudeProfissionalItensMedias,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 17 − Médias dos itens relacionados à Atitude Profissional (Docente)',
              atitudeProfissionalItensMediasDoc,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 18 − Proporções de respostas dadas aos itens relacionados à Atitude Profissional (Discente)',
              atitudeProfissionalItensProporcoes,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 19 − Proporções de respostas dadas aos itens relacionados à Atitude Profissional (Docente)',
              atitudeProfissionalItensProporcoesDoc,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            addBoxplotFigure(
              d,
              yy,
              pw,
              'Figura 20 − Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado à Atitude Profissional',
              atitudeProfissionalBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            addDescritivasTable(
              d,
              yy,
              pw,
              'Tabela 5: Estatísticas descritivas das Médias das Avaliações das Turmas/Docentes por Item relacionado à Atitude Profissional',
              atitudeProfissionalBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 21 − Médias dos itens relacionados à Gestão Didática (Discente)',
              gestaoDidaticaItensMedias,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 22 − Médias dos itens relacionados à Gestão Didática (Docente)',
              gestaoDidaticaItensMediasDoc,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 23 − Proporções de respostas dadas aos itens relacionados à Gestão Didática (Discente)',
              gestaoDidaticaItensProporcoes,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 24 − Proporções de respostas dadas aos itens relacionados à Gestão Didática (Docente)',
              gestaoDidaticaItensProporcoesDoc,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            addBoxplotFigure(
              d,
              yy,
              pw,
              'Figura 25 − Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado à Gestão Didática',
              gestaoDidaticaBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            addDescritivasTable(
              d,
              yy,
              pw,
              'Tabela 6: Estatísticas descritivas das Médias das Avaliações das Turmas/Docentes por Item relacionado à Gestão Didática',
              gestaoDidaticaBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 26 − Médias dos itens relacionados ao Processo Avaliativo (Discente)',
              processoAvaliativoItensMediasDisc,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 27 − Médias dos itens relacionados ao Processo Avaliativo (Docente)',
              processoAvaliativoItensMediasDoc,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 28 − Proporções de respostas dadas aos itens relacionados ao Processo Avaliativo (Discente)',
              processoAvaliativoItensProporcoesDisc,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 29 − Proporções de respostas dadas aos itens relacionados ao Processo Avaliativo (Docente)',
              processoAvaliativoItensProporcoesDoc,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            addBoxplotFigure(
              d,
              yy,
              pw,
              'Figura 30 − Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado ao Processo Avaliativo',
              processoAvaliativoBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            addDescritivasTable(
              d,
              yy,
              pw,
              'Tabela 7: Estatísticas descritivas das Médias das Avaliações das Turmas/Docentes por Item relacionado ao Processo Avaliativo',
              processoAvaliativoBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 31 − Médias dos itens relacionados às Instalações físicas (Discente)',
              instalacoesItensMediasDisc,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 32 − Médias dos itens relacionados às Instalações físicas (Docente)',
              instalacoesItensMediasDoc,
              { valueField: 'media', labelField: 'item' }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 33 − Proporções de respostas dadas aos itens relacionados às Instalações físicas (Discente)',
              instalacoesItensProporcoesDisc,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            drawGroupedProportionChart(
              d,
              yy,
              pw,
              'Figura 34 − Proporções de respostas dadas aos itens relacionados às Instalações físicas (Docente)',
              instalacoesItensProporcoesDoc,
              'item'
            ),
        },
        {
          render: (d, yy, pw) =>
            addBoxplotFigure(
              d,
              yy,
              pw,
              'Figura 35 − Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado às Instalações Físicas',
              instalacoesBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            addDescritivasTable(
              d,
              yy,
              pw,
              'Tabela 8: Estatísticas descritivas das Médias das Avaliações das Turmas/Docentes por Item relacionado às Instalações Físicas',
              instalacoesBoxplot
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 36 − Percentual de Participação em Atividades Acadêmicas por Atividade (Discente)',
              atividadesDiscente,
              {
                valueField: 'percentual',
                labelField: 'atividade',
                fixedMax: 100,
                showPercentAxis: true,
              }
            ),
        },
        {
          render: (d, yy, pw) =>
            drawSimpleBarChart(
              d,
              yy,
              pw,
              'Figura 37 − Percentual de Participação em Atividades Acadêmicas por Atividade (Docente)',
              atividadesDocente,
              {
                valueField: 'percentual',
                labelField: 'atividade',
                fixedMax: 100,
                showPercentAxis: true,
              }
            ),
        },
      ];

      const measureBlockHeight = async (block) => {
        const tempDoc = new jsPDF({ unit: 'pt', format: 'a4' });
        const tempPageWidth = tempDoc.internal.pageSize.getWidth();
        const startY = 60;
        const endY = await block.render(tempDoc, startY, tempPageWidth);
        return Math.max(0, endY - startY);
      };

      for (let i = 0; i < blocks.length; i += 2) {
        const first = blocks[i];
        const second = blocks[i + 1] || null;

        const h1 = await measureBlockHeight(first);
        const h2 = second ? await measureBlockHeight(second) : 0;
        const between = h1 > 0 && h2 > 0 ? 24 : 0;
        const total = h1 + h2 + between;

        doc.addPage();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPair = Math.max(60, (pageHeight - total) / 2);

        yPair = await first.render(doc, yPair, pageWidth);
        if (second) {
          if (between) yPair += 24;
          yPair = await second.render(doc, yPair, pageWidth);
        }
      }

      addPageNumbers(doc);

      setProgressText('Finalizando PDF…');
      setProgress(100);

      const baseBlob = doc.output('blob');
      const finalBlob = await appendPdfAttachments(baseBlob, [
        '/api/files/questionario_disc.pdf',
        '/api/files/questionario_doc.pdf',
      ]);
      const url = URL.createObjectURL(finalBlob);

      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
      setPdfUrl(url);
      lastBuiltKeyRef.current = buildKey;
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setPdfError('Não foi possível gerar o PDF. Verifique os filtros ou recarregue a página.');
      setPdfUrl('');
    } finally {
      buildingRef.current = false;
      currentBuildKeyRef.current = '';
      setIsGeneratingPreview(false);
      setBlocking(false);

      const pendingKey = pendingBuildKeyRef.current;
      if (pendingKey && pendingKey !== lastBuiltKeyRef.current) {
        pendingBuildKeyRef.current = '';
        setTimeout(() => {
          latestBuildRef.current?.();
        }, 0);
      } else {
        pendingBuildKeyRef.current = '';
      }
    }
  }

  latestBuildRef.current = buildPdf;

  useEffect(() => {
    if (!canGenerate) {
      setIsGeneratingPreview(false);
      return;
    }

    const t = setTimeout(buildPdf, 400);
    return () => clearTimeout(t);
  }, [canGenerate, selected.ano, selected.campus, selected.curso, summaryData]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  const downloadName = `relatorio-avalia-${selected.ano || 'ano'}-${String(
    selected.campus || 'todos'
  )
    .replace(/\s+/g, '-')
    .toLowerCase()}-${String(selected.curso || 'todos')
    .replace(/\s+/g, '-')
    .toLowerCase()}.pdf`;

  const clampPct = (v) => Math.floor(Math.max(0, Math.min(100, v)));

  const MissingMsg = () => {
    if (!selected.ano) return <>Selecione <strong>Ano</strong> para começar.</>;
    if (!selected.campus) return <>Selecione <strong>Campus</strong> para continuar.</>;
    if (!selected.curso) return <>Selecione <strong>Curso</strong> para continuar.</>;
    return <>Aguarde a preparação do relatório.</>;
  };

  return (
    <div>
      <div ref={contentRef}>
        <div className={styles.filtersContainer}>
          <DiscenteFilters
            filters={dynamicFilters}
            selectedFilters={selected}
            onFilterChange={handleFilterChange}
            showDimensionFilter={false}
            showRankingToggle={false}
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
          isAllContexts={selected.campus === 'todos'}
          missingMessage={<MissingMsg />}
          clampPct={clampPct}
          contextConfig={REPORT_CONTEXTS.presencial}
          isGeneratingPreview={isGeneratingPreview}
        />
      </div>

      <div
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          width: '1200px',
          background: '#fff',
          opacity: 1,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {hiddenBoxplot && (
          <div
            key={hiddenBoxplot.key}
            ref={hiddenBoxplotRef}
            style={{
              width: '1200px',
              minHeight: '480px',
              background: '#fff',
              padding: '24px',
              boxSizing: 'border-box',
            }}
          >
            <BoxplotChart
              apiData={hiddenBoxplot.apiData}
              title=""
              customOptions={{
                title: {
                  text: '',
                },
                chart: {
                  zoom: { enabled: false },
                  toolbar: { show: false },
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}