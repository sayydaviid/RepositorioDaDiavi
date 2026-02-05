// src/app/avalia/components/BoxplotChart.js
'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

/**
 * =========================
 * PERF GUARD RAILS (ajuste conforme necessidade)
 * =========================
 * Se seu endpoint pode retornar MUITO outlier, esses limites são obrigatórios
 * para não travar a UI (SVG + main thread).
 */
const MAX_OUTLIERS_SCANNED = 25000; // no máximo quantos pontos vamos "varrer" do payload
const MAX_OUTLIERS_DRAWN = 1500;   // no máximo quantos outliers serão desenhados
const BIN_COUNT = 6;               // número de bins (poucas séries scatter -> mais leve)
const MAX_LABEL_CATS = 80;         // acima disso desliga labels por annotations (muito SVG)
const MAX_TICK_AMOUNT = 40;        // evita tickAmount = 300 (mesmo com labels hidden)

/**
 * ApexCharts boxPlot:
 * Esperado: [lowerFence, q1, med, q3, upperFence]
 */
function sanitizeBox5(y) {
  if (!Array.isArray(y) || y.length < 5) return y;

  let [min, q1, med, q3, max] = y.map((v) => (Number.isFinite(+v) ? +v : NaN));
  if (![min, q1, med, q3, max].every(Number.isFinite)) return y;

  if (min > max) [min, max] = [max, min];
  if (q1 > q3) [q1, q3] = [q3, q1];

  if (q1 < min) q1 = min;
  if (q3 > max) q3 = max;

  if (med < q1) med = q1;
  if (med > q3) med = q3;

  // evita “caixa-traço”
  const MIN_BOX_HEIGHT = 0.12;
  const iqr0 = q3 - q1;
  if (iqr0 < MIN_BOX_HEIGHT) {
    const half = MIN_BOX_HEIGHT / 2;
    q1 = Math.max(1.0, med - half);
    q3 = Math.min(4.5, med + half);
  }

  const iqr = q3 - q1;
  const lowerFence = Math.max(min, q1 - 1.5 * iqr);
  const upperFence = Math.min(max, q3 + 1.5 * iqr);

  const lf = Math.min(lowerFence, q1);
  const uf = Math.max(upperFence, q3);

  return [
    Number(lf.toFixed(2)),
    Number(q1.toFixed(2)),
    Number(med.toFixed(2)),
    Number(q3.toFixed(2)),
    Number(uf.toFixed(2)),
  ];
}

/** Quebra label em múltiplas linhas (respeita \n se já vier pronto) */
function splitLines(label, maxLen = 14) {
  if (!label) return [''];
  const txt = String(label).trim();
  if (txt.includes('\n')) {
    return txt
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const words = txt.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (t.length > maxLen) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function lerpColorHex(a, b, t) {
  const toRgb = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  const A = toRgb(a);
  const B = toRgb(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const bb = Math.round(A.b + (B.b - A.b) * t);
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(bb)}`;
}

export default React.memo(function BoxplotChart({ apiData, title }) {
  if (!apiData || !apiData.boxplot_data) {
    return (
      <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Carregando...
      </div>
    );
  }

  const chartTitle = title || 'Distribuição das Médias das Avaliações';

  /**
   * 1) Box data sanitizado (memo)
   */
  const adjustedBoxData = useMemo(() => {
    const src = apiData.boxplot_data || [];
    return src.map((d) => ({
      x: d.x,
      y: sanitizeBox5(d.y),
    }));
  }, [apiData.boxplot_data]);

  /**
   * 2) Categories + map + fences (memo)
   */
  const { categories, categoryMap, fencesByCat } = useMemo(() => {
    const cats = adjustedBoxData.map((d) => d.x);

    const map = new Map();
    for (let i = 0; i < cats.length; i++) map.set(cats[i], i + 1);

    const fences = new Map();
    for (const d of adjustedBoxData) {
      const y = d.y;
      fences.set(d.x, { low: y?.[0], high: y?.[4] });
    }

    return { categories: cats, categoryMap: map, fencesByCat: fences };
  }, [adjustedBoxData]);

  /**
   * 3) Outliers em bins (com caps + stride) para não travar
   * - sem Math.max(...arrayGrande)
   * - limita varredura do payload e quantidade desenhada
   */
  const { outlierSeries, outlierSeriesColors } = useMemo(() => {
    const raw = apiData.outliers_data || [];
    if (!raw.length || !categories.length) {
      return { outlierSeries: [], outlierSeriesColors: [] };
    }

    // stride para limitar varredura
    const stepRaw = Math.max(1, Math.ceil(raw.length / MAX_OUTLIERS_SCANNED));

    // 1ª fase: filtra outliers válidos e calcula maxDist (sem arrays gigantes)
    const kept = [];
    let maxDist = 1e-9;

    for (let i = 0; i < raw.length; i += stepRaw) {
      const p = raw[i];
      const f = fencesByCat.get(p.x);
      const yv = +p.y;
      if (!f || !Number.isFinite(yv)) continue;

      let dist = 0;
      if (yv < f.low) dist = f.low - yv;
      else if (yv > f.high) dist = yv - f.high;
      else continue;

      const xi = categoryMap.get(p.x);
      if (!xi) continue;

      kept.push({ x: xi, y: yv, dist });
      if (dist > maxDist) maxDist = dist;
    }

    if (!kept.length) return { outlierSeries: [], outlierSeriesColors: [] };

    // cap final do que vai ser desenhado (amostragem)
    let points = kept;
    if (points.length > MAX_OUTLIERS_DRAWN) {
      const step = Math.max(1, Math.ceil(points.length / MAX_OUTLIERS_DRAWN));
      const sampled = [];
      for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
      points = sampled;
    }

    // prepara cores por bin
    const DARK = '#1F2937';
    const LIGHT = '#CBD5E1';
    const binColors = Array.from({ length: BIN_COUNT }, (_, i) =>
      lerpColorHex(DARK, LIGHT, i / (BIN_COUNT - 1))
    );

    // bins -> poucas séries = leve
    const bins = Array.from({ length: BIN_COUNT }, () => []);
    for (const p of points) {
      const t = p.dist / maxDist; // 0..1
      const bi = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(t * (BIN_COUNT - 1))));
      bins[bi].push({ x: p.x, y: p.y });
    }

    // monta séries somente dos bins usados + lista de cores alinhada com as séries
    const series = [];
    const colorsUsed = [];
    for (let i = 0; i < BIN_COUNT; i++) {
      if (!bins[i].length) continue;
      series.push({ name: `_out_${i}`, type: 'scatter', data: bins[i] });
      colorsUsed.push(binColors[i]);
    }

    return { outlierSeries: series, outlierSeriesColors: colorsUsed };
  }, [apiData.outliers_data, categories.length, categoryMap, fencesByCat]);

  /**
   * 4) Labels via annotations (com cap por N de categorias)
   * Se tiver categoria demais, desliga (senão vira muita coisa no SVG)
   */
  const { labelAnnotations, maxLines, baseOffsetY, lineH, labelsEnabled } = useMemo(() => {
    if (!categories.length || categories.length > MAX_LABEL_CATS) {
      return {
        labelAnnotations: [],
        maxLines: 0,
        baseOffsetY: 0,
        lineH: 0,
        labelsEnabled: false,
      };
    }

    const splitAll = categories.map((c) => splitLines(c, 14));
    const mLines = splitAll.length ? Math.max(...splitAll.map((ls) => ls.length)) : 1;

    const _lineH = 13;
    const _baseOffsetY = 18;

    const anns = [];
    for (let i = 0; i < categories.length; i++) {
      const lines = splitAll[i];
      for (let li = 0; li < lines.length; li++) {
        anns.push({
          x: i + 1,
          x2: i + 1,
          y: 1,
          y2: 1,
          borderColor: 'transparent',
          label: {
            borderColor: 'transparent',
            position: 'bottom',
            orientation: 'horizontal',
            offsetY: _baseOffsetY + li * _lineH,
            text: lines[li],
            style: {
              background: 'transparent',
              color: '#64748B',
              fontSize: '10px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 400,
              textAlign: 'center',
            },
          },
        });
      }
    }

    return { labelAnnotations: anns, maxLines: mLines, baseOffsetY: _baseOffsetY, lineH: _lineH, labelsEnabled: true };
  }, [categories]);

  /**
   * 5) Series estável (memo)
   */
  const series = useMemo(() => {
    const boxSeries = {
      name: 'Distribuição',
      type: 'boxPlot',
      data: adjustedBoxData.map((d) => ({ x: categoryMap.get(d.x), y: d.y })),
    };
    return [boxSeries, ...outlierSeries];
  }, [adjustedBoxData, categoryMap, outlierSeries]);

  /**
   * 6) Options estável (memo)
   */
  const options = useMemo(() => {
    // colors: 1º = box; o resto = bins realmente usados (alinhado com series)
    const colors = ['#053B50', ...outlierSeriesColors];

    // stroke arrays alinhados ao número de séries
    const strokeWidths = [1.1, ...Array(Math.max(0, series.length - 1)).fill(0)];
    const strokeColors = ['#053B50', ...Array(Math.max(0, series.length - 1)).fill('transparent')];

    const extraBottom = labelsEnabled ? (20 + baseOffsetY + maxLines * lineH) : 20;

    // tickAmount alto com muita categoria é custo inútil (labels estão hidden)
    const tickAmount =
      categories.length <= MAX_TICK_AMOUNT ? categories.length : Math.min(MAX_TICK_AMOUNT, 10);

    return {
      colors,
      annotations: labelsEnabled ? { xaxis: labelAnnotations } : undefined,

      chart: {
        type: 'boxPlot',
        height: 350,
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: 'Inter, system-ui, sans-serif',
        animations: {
          enabled: false, // elimina loops internos e “updated storms”
        },
      },

      legend: { show: false },

      title: {
        text: chartTitle,
        align: 'left',
        style: { fontSize: '14px', fontWeight: 600, color: '#1E293B' },
      },

      plotOptions: {
        boxPlot: {
          colors: { upper: '#2E7D9C', lower: '#5EB2D4' },
          columnWidth: '48%',
        },
      },

      dataLabels: { enabled: false },

      stroke: {
        show: true,
        width: strokeWidths,
        colors: strokeColors,
      },

      fill: { opacity: 0.85 },

      markers: {
        size: 4,
        strokeWidth: 0,
        shape: 'circle',
      },

      xaxis: {
        type: 'numeric',
        min: 0.5,
        max: categories.length + 0.5,
        tickAmount,
        labels: { show: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },

      yaxis: {
        min: 1,
        max: 4.5,
        tickAmount: 7,
        labels: {
          style: { colors: '#64748B' },
          formatter: (v) => Number(v).toFixed(2),
        },
      },

      grid: {
        borderColor: '#F1F5F9',
        padding: { left: 10, bottom: extraBottom },
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
      },

      tooltip: {
        shared: false,
        intersect: true,
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          if (seriesIndex === 0) {
            const stats = w.config.series[0].data[dataPointIndex].y;
            const item = categories[dataPointIndex] ?? '';
            return `
              <div style="padding: 12px; border-radius: 8px; background: #FFF; border: 1px solid #E2E8F0;">
                <div style="font-weight: 700; color: #1E293B">Item: ${item}</div>
                <div style="font-size: 12px; color: #64748B;">
                  <div>MAX.: <b>${stats[4]}</b></div>
                  <div>Q3: <b>${stats[3]}</b></div>
                  <div>Mediana: <b>${stats[2]}</b></div>
                  <div>Q1: <b>${stats[1]}</b></div>
                  <div>MIN.: <b>${stats[0]}</b></div>
                </div>
              </div>`;
          }

          // Outliers (qualquer uma das séries bins)
          const p = w.config.series[seriesIndex]?.data?.[dataPointIndex];
          if (!p) return '';
          return `
            <div style="padding: 10px; border-radius: 8px; background: #FFF; border: 1px solid #E2E8F0;">
              <div style="font-weight: 700; color: #1E293B">Outlier</div>
              <div style="font-size: 12px; color: #64748B;">Valor: <b>${Number(p.y).toFixed(2)}</b></div>
            </div>`;
        },
      },
    };
  }, [
    chartTitle,
    categories,
    labelsEnabled,
    labelAnnotations,
    maxLines,
    baseOffsetY,
    lineH,
    series.length,
    outlierSeriesColors,
  ]);

  return (
    <div style={{ width: '100%', height: '350px' }}>
      <Chart options={options} series={series} type="boxPlot" height={350} />
    </div>
  );
});
