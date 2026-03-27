import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeFilterValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (['TODOS', 'TODAS', 'ALL'].includes(normalized)) return '';
  return String(value).trim();
}

function detectModalidade(mod, curso) {
  const normalizedMod = normalizeText(mod);
  if (normalizedMod.includes('BACH')) return 'Bacharelado';
  if (normalizedMod.includes('LIC')) return 'Licenciatura';

  const normalizedCurso = normalizeText(curso);
  if (normalizedCurso.includes('BACH')) return 'Bacharelado';
  if (normalizedCurso.includes('LIC')) return 'Licenciatura';
  return '';
}

function parseDecimal(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  let normalized = text;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    normalized = normalized.replace(',', '.');
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function pickValue(row, aliases) {
  const aliasSet = new Set(aliases.map((alias) => normalizeText(alias)));
  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeText(key))) {
      return value;
    }
  }
  return undefined;
}

function buildRecordsFromSheet(worksheet) {
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  const headerRowIndex = matrix.findIndex((row) => {
    const normalizedCells = row.map((cell) => normalizeText(cell));
    const hasAno = normalizedCells.some((cell) => cell.includes('ANO AVAL'));
    const hasUnd = normalizedCells.some((cell) => cell.includes('UND-ACAD') || cell.includes('UND ACAD'));
    const hasCampus = normalizedCells.some((cell) => cell === 'CAMPUS' || cell.includes('CAMPUS'));
    const hasCurso = normalizedCells.some((cell) => cell === 'CURSO' || cell.includes('CURSO'));
    return hasAno && hasUnd && hasCampus && hasCurso;
  });

  if (headerRowIndex < 0) {
    throw new Error('Não foi possível localizar a linha de cabeçalho com ANO AVAL., UND-ACAD, CAMPUS e CURSO.');
  }

  const headers = matrix[headerRowIndex].map((cell) => String(cell ?? '').trim());
  const dataRows = matrix.slice(headerRowIndex + 1);

  const records = dataRows
    .map((cells) => {
      const row = {};
      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = cells[index] ?? '';
      });

      const anoRaw = pickValue(row, ['ANO AVAL.', 'ANO AVAL', 'ANO']);
      const undAcadRaw = pickValue(row, ['UND-ACAD', 'UND ACAD', 'UND_ACAD']);
      const campusRaw = pickValue(row, ['CAMPUS']);
      const cursoRaw = pickValue(row, ['CURSO']);
      const modRaw = pickValue(row, ['MOD']);
      const d1Raw = pickValue(row, ['D1']);
      const d2Raw = pickValue(row, ['D2']);
      const d3Raw = pickValue(row, ['D3']);
      const ccRaw = pickValue(row, ['CC']);
      const avalRaw = pickValue(row, ['AVAL']);

      const ano = String(anoRaw ?? '').trim();
      const undAcad = String(undAcadRaw ?? '').trim();
      const campus = String(campusRaw ?? '').trim();
      const curso = String(cursoRaw ?? '').trim();
      const modalidade = detectModalidade(modRaw, curso);
      const d1 = parseDecimal(d1Raw);
      const d2 = parseDecimal(d2Raw);
      const d3 = parseDecimal(d3Raw);
      const cc = parseDecimal(ccRaw);
      const aval = parseDecimal(avalRaw);

      if (!ano || !undAcad || !campus || !curso) {
        return null;
      }

      return { ano, undAcad, campus, curso, modalidade, d1, d2, d3, cc, aval };
    })
    .filter(Boolean);

  return records;
}

function toSortedArray(values, sortAsNumber = false) {
  const arr = Array.from(values);
  if (sortAsNumber) {
    return arr.sort((a, b) => Number(a) - Number(b));
  }
  return arr.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function loadAvaliacaoInLocoWorkbook() {
  const dataDir = join(process.cwd(), 'public/data');
  const files = readdirSync(dataDir);
  const xlsxFile = files.find((file) => file.endsWith('.xlsx'));

  if (!xlsxFile) {
    throw new Error('Nenhum arquivo .xlsx encontrado no diretório de dados');
  }

  const filePath = join(dataDir, xlsxFile);
  const fileBuffer = readFileSync(filePath);
  return XLSX.read(fileBuffer, { type: 'buffer' });
}

function findSheetByName(workbook, preferredName) {
  const normalizedTarget = normalizeText(preferredName);
  const exactName = workbook.SheetNames.find((name) => normalizeText(name) === normalizedTarget);
  if (exactName) return workbook.Sheets[exactName];

  const partialName = workbook.SheetNames.find((name) => normalizeText(name).includes(normalizedTarget));
  if (partialName) return workbook.Sheets[partialName];

  return null;
}

function buildConsolidatedEvolucaoFromSheet(worksheet) {
  if (!worksheet) return null;

  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  const headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => normalizeText(cell).includes('ANO / MEDIAS'))
  );

  if (headerRowIndex < 0) return null;

  const headerRow = matrix[headerRowIndex];
  const getColumnIndex = (aliases) => {
    const normalizedAliases = aliases.map((alias) => normalizeText(alias));
    return headerRow.findIndex((cell) => normalizedAliases.includes(normalizeText(cell)));
  };

  const anoIndex = getColumnIndex(['ANO / MÉDIAS', 'ANO / MEDIAS', 'ANO']);
  const d1Index = getColumnIndex(['D1']);
  const d2Index = getColumnIndex(['D2']);
  const d3Index = getColumnIndex(['D3']);
  const ccIndex = getColumnIndex(['CC']);
  const avalIndex = getColumnIndex(['AVAL']);
  const quantIndex = getColumnIndex(['QUANT.', 'QUANT', 'QUANTIDADE']);

  if (anoIndex < 0 || d1Index < 0 || d2Index < 0 || d3Index < 0) return null;

  const rows = matrix
    .slice(headerRowIndex + 1)
    .map((cells) => {
      const ano = String(cells[anoIndex] ?? '').trim();
      const anoNumero = Number(ano);
      if (!Number.isFinite(anoNumero) || anoNumero < 2011) return null;

      const d1 = parseDecimal(cells[d1Index]);
      const d2 = parseDecimal(cells[d2Index]);
      const d3 = parseDecimal(cells[d3Index]);
      const cc = ccIndex >= 0 ? parseDecimal(cells[ccIndex]) : null;
      const aval = avalIndex >= 0 ? parseDecimal(cells[avalIndex]) : null;
      const quant = quantIndex >= 0 ? parseDecimal(cells[quantIndex]) : null;

      const hasAnyValue = [d1, d2, d3, cc, aval, quant].some((value) => value !== null);
      if (!hasAnyValue) return null;

      return {
        ano,
        anoNumero,
        d1,
        d2,
        d3,
        cc,
        aval,
        quant,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.anoNumero - b.anoNumero);

  if (!rows.length) return null;

  return {
    anos: rows.map((row) => row.ano),
    series: {
      d1: rows.map((row) => row.d1),
      d2: rows.map((row) => row.d2),
      d3: rows.map((row) => row.d3),
      cc: rows.map((row) => row.cc),
      aval: rows.map((row) => row.aval),
    },
    quantidadeCursosAvaliados: {
      anos: rows.map((row) => row.ano),
      valores: rows.map((row) => (row.quant === null ? null : Number(row.quant))),
    },
    mediaDimensaoAnual: {
      anos: rows.map((row) => row.ano),
      d1: rows.map((row) => row.d1),
      d2: rows.map((row) => row.d2),
      d3: rows.map((row) => row.d3),
    },
  };
}

export function getAvaliacaoInLocoData() {
  try {
    const workbook = loadAvaliacaoInLocoWorkbook();

    const preferredSheetName = '2011 A 2025';
    const selectedSheetName = workbook.SheetNames.includes(preferredSheetName)
      ? preferredSheetName
      : workbook.SheetNames[0];

    const worksheet = workbook.Sheets[selectedSheetName];
    const records = buildRecordsFromSheet(worksheet);

    const anos = new Set();
    const undAcad = new Set();
    const campi = new Set();
    const cursos = new Set();
    const modalidades = new Set();

    records.forEach((row) => {
      anos.add(row.ano);
      undAcad.add(row.undAcad);
      campi.add(row.campus);
      cursos.add(row.curso);
      if (row.modalidade) modalidades.add(row.modalidade);
    });

    return {
      anos: toSortedArray(anos, true),
      undAcad: toSortedArray(undAcad),
      campi: toSortedArray(campi),
      cursos: toSortedArray(cursos),
      modalidades: toSortedArray(modalidades),
      records,
    };
  } catch (error) {
    console.error('Erro ao ler arquivo XLSX:', error);
    return {
      anos: [],
      undAcad: [],
      campi: [],
      cursos: [],
      modalidades: [],
      records: [],
    };
  }
}

export function getAvaliacaoInLocoFilters(params = {}) {
  const { records } = getAvaliacaoInLocoData();

  const ano = normalizeFilterValue(params.ano);
  const undAcad = normalizeFilterValue(params.undAcad);
  const modalidade = normalizeFilterValue(params.modalidade);
  const campus = normalizeFilterValue(params.campus);

  const filtered = records.filter((row) => {
    if (ano && row.ano !== ano) return false;
    if (undAcad && row.undAcad !== undAcad) return false;
    if (modalidade && row.modalidade !== modalidade) return false;
    if (campus && row.campus !== campus) return false;
    return true;
  });

  const anos = new Set();
  const undAcadSet = new Set();
  const campiSet = new Set();
  const cursosSet = new Set();
  const modalidadesSet = new Set();

  filtered.forEach((row) => {
    anos.add(row.ano);
    undAcadSet.add(row.undAcad);
    campiSet.add(row.campus);
    cursosSet.add(row.curso);
    if (row.modalidade) modalidadesSet.add(row.modalidade);
  });

  return {
    anos: toSortedArray(anos, true),
    undAcad: toSortedArray(undAcadSet),
    campi: toSortedArray(campiSet),
    cursos: toSortedArray(cursosSet),
    modalidades: toSortedArray(modalidadesSet),
  };
}

export function getAvaliacaoInLocoMediaDimensoes(params = {}) {
  const { records } = getAvaliacaoInLocoData();

  const ano = normalizeFilterValue(params.ano);
  const undAcad = normalizeFilterValue(params.undAcad);
  const modalidade = normalizeFilterValue(params.modalidade);
  const campus = normalizeFilterValue(params.campus);
  const curso = normalizeFilterValue(params.curso);

  const filtered = records.filter((row) => {
    if (ano && row.ano !== ano) return false;
    if (undAcad && row.undAcad !== undAcad) return false;
    if (modalidade && row.modalidade !== modalidade) return false;
    if (campus && row.campus !== campus) return false;
    if (curso && row.curso !== curso) return false;
    return true;
  });

  const groupedByUnd = new Map();

  filtered.forEach((row) => {
    const key = row.undAcad;
    if (!groupedByUnd.has(key)) {
      groupedByUnd.set(key, {
        undAcad: key,
        d1: [],
        d2: [],
        d3: [],
      });
    }

    const group = groupedByUnd.get(key);
    if (typeof row.d1 === 'number' && Number.isFinite(row.d1)) group.d1.push(row.d1);
    if (typeof row.d2 === 'number' && Number.isFinite(row.d2)) group.d2.push(row.d2);
    if (typeof row.d3 === 'number' && Number.isFinite(row.d3)) group.d3.push(row.d3);
  });

  const calcMean = (arr) => {
    if (!arr.length) return null;
    const sum = arr.reduce((acc, value) => acc + value, 0);
    return Number((sum / arr.length).toFixed(2));
  };

  const sortedGroups = Array.from(groupedByUnd.values()).sort((a, b) =>
    a.undAcad.localeCompare(b.undAcad, 'pt-BR')
  );

  return {
    totalRegistros: filtered.length,
    unidades: sortedGroups.map((group) => group.undAcad),
    mediasPorDimensao: {
      d1: sortedGroups.map((group) => calcMean(group.d1)),
      d2: sortedGroups.map((group) => calcMean(group.d2)),
      d3: sortedGroups.map((group) => calcMean(group.d3)),
    },
  };
}

export function getAvaliacaoInLocoEvolucaoAnual(params = {}) {
  const undAcad = normalizeFilterValue(params.undAcad);
  const curso = normalizeFilterValue(params.curso);
  const hasCustomFilter = Boolean(undAcad || curso);

  if (!hasCustomFilter) {
    try {
      const workbook = loadAvaliacaoInLocoWorkbook();
      const evolucaoSheet = findSheetByName(workbook, 'GRAFICO-EVOLUÇÃO');
      const consolidatedData = buildConsolidatedEvolucaoFromSheet(evolucaoSheet);

      if (consolidatedData) {
        return consolidatedData;
      }
    } catch (error) {
      console.error('Erro ao ler dados consolidados da aba GRAFICO-EVOLUÇÃO:', error);
    }
  }

  const { records } = getAvaliacaoInLocoData();
  const filteredRecords = records.filter((row) => {
    if (undAcad && row.undAcad !== undAcad) return false;
    if (curso && row.curso !== curso) return false;
    return true;
  });

  const groupedByYear = new Map();

  filteredRecords.forEach((row) => {
    const year = String(row.ano || '').trim();
    if (!year) return;

    if (!groupedByYear.has(year)) {
      groupedByYear.set(year, {
        d1: [],
        d2: [],
        d3: [],
        cc: [],
        aval: [],
      });
    }

    const group = groupedByYear.get(year);
    if (typeof row.d1 === 'number' && Number.isFinite(row.d1)) group.d1.push(row.d1);
    if (typeof row.d2 === 'number' && Number.isFinite(row.d2)) group.d2.push(row.d2);
    if (typeof row.d3 === 'number' && Number.isFinite(row.d3)) group.d3.push(row.d3);
    if (typeof row.cc === 'number' && Number.isFinite(row.cc)) group.cc.push(row.cc);
    if (typeof row.aval === 'number' && Number.isFinite(row.aval)) group.aval.push(row.aval);
  });

  const calcMean = (arr) => {
    if (!arr.length) return null;
    const sum = arr.reduce((acc, value) => acc + value, 0);
    return Number((sum / arr.length).toFixed(2));
  };

  const groupedRowsByYear = new Map();
  filteredRecords.forEach((row) => {
    const year = String(row.ano || '').trim();
    if (!year) return;

    if (!groupedRowsByYear.has(year)) {
      groupedRowsByYear.set(year, []);
    }

    groupedRowsByYear.get(year).push(row);
  });

  const anos = Array.from(groupedByYear.keys())
    .filter((ano) => Number(ano) >= 2011)
    .sort((a, b) => Number(a) - Number(b));

  const anosQuantidade = Array.from(groupedRowsByYear.keys())
    .filter((ano) => Number(ano) >= 2011)
    .sort((a, b) => Number(a) - Number(b));

  const anosMediaDimensaoAnual = Array.from(groupedByYear.keys())
    .filter((ano) => Number(ano) >= 2011)
    .sort((a, b) => Number(a) - Number(b));

  return {
    anos,
    series: {
      d1: anos.map((ano) => calcMean(groupedByYear.get(ano).d1)),
      d2: anos.map((ano) => calcMean(groupedByYear.get(ano).d2)),
      d3: anos.map((ano) => calcMean(groupedByYear.get(ano).d3)),
      cc: anos.map((ano) => calcMean(groupedByYear.get(ano).cc)),
      aval: anos.map((ano) => calcMean(groupedByYear.get(ano).aval)),
    },
    quantidadeCursosAvaliados: {
      anos: anosQuantidade,
      valores: anosQuantidade.map((ano) => (groupedRowsByYear.get(ano) ?? []).length),
    },
    mediaDimensaoAnual: {
      anos: anosMediaDimensaoAnual,
      d1: anosMediaDimensaoAnual.map((ano) => calcMean(groupedByYear.get(ano).d1)),
      d2: anosMediaDimensaoAnual.map((ano) => calcMean(groupedByYear.get(ano).d2)),
      d3: anosMediaDimensaoAnual.map((ano) => calcMean(groupedByYear.get(ano).d3)),
    },
  };
}
