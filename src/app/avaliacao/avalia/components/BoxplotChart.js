// src/app/avalia/components/BoxplotChart.js

'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

/* Divide o rótulo em linhas semânticas.
   - Se vier com "\n", respeita a quebra enviada pelo pai (EadDashboardClient). */
function splitLines(label, maxLen = 14) {
  if (!label) return [""];
  const txt = String(label).trim();

  // 1) Se o pai já mandou quebras, respeita-as.
  if (txt.includes('\n')) {
    return txt.split('\n').map(s => s.trim()).filter(Boolean);
  }

  // 2) (fallback) quebra por comprimento aproximado
  const words = txt.split(" ");
  const lines = [];
  let line = "";
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

// Gradiente de cinza para outliers
const getColorForValue = (value, min, max) => {
  if (min === max) return "#CCCCCC";
  const p = (value - min) / (max - min);
  const from = 204, to = 102;
  const v = Math.round(from + (to - from) * p);
  const hex = v.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
};

// Garante altura mínima para a caixa do boxplot (evita virar um traço)
const EPS = 0.06; // altura mínima ~0.06 na escala 1..4
function inflateBoxY(y) {
  if (!Array.isArray(y) || y.length < 5) return y;
  let [wmin, q1, med, q3, wmax] = y;

  if (q3 - q1 < EPS) {
    const half = EPS / 2;
    q1 = Math.max(1.0, med - half);
    q3 = Math.min(4.0, med + half);
    // whiskers devem envolver a caixa
    wmin = Math.min(wmin, q1);
    wmax = Math.max(wmax, q3);
  }

  // clamp final
  wmin = Math.max(1.0, Math.min(wmin, 4.0));
  wmax = Math.max(1.0, Math.min(wmax, 4.0));
  q1 = Math.max(1.0, Math.min(q1, 4.0));
  med = Math.max(1.0, Math.min(med, 4.0));
  q3 = Math.max(1.0, Math.min(q3, 4.0));

  return [wmin, q1, med, q3, wmax];
}

export default function BoxplotChart({ apiData, title }) {
  if (!apiData || !apiData.boxplot_data) {
    return (
      <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Carregando...
      </div>
    );
  }

  const chartTitle = title || "Distribuição das Médias das Avaliações";

  // Ajusta as caixas com EPS para evitar “traços”
  const adjustedBoxData = apiData.boxplot_data.map((d) => ({
    x: d.x,
    y: inflateBoxY(d.y),
  }));

  const categories = adjustedBoxData.map((d) => d.x);
  // Mapeia a categoria textual para um X numérico contínuo (1..N)
  const categoryMap = categories.reduce((acc, c, i) => ((acc[c] = i + 1), acc), {});

  // Bounds (whiskers) com dados ajustados
  const whiskerBounds = adjustedBoxData.reduce((acc, d) => {
    acc[d.x] = { lower: d.y[0], upper: d.y[4] };
    return acc;
  }, {});

  // Outliers e coloração
  const outlierValues = (apiData.outliers_data || [])
    .map((p) => p.outliers ?? p.y)
    .filter((v, i) => {
      const x = (apiData.outliers_data || [])[i]?.x;
      const b = whiskerBounds[x];
      return b && (v < b.lower || v > b.upper);
    });

  const minOut = outlierValues.length ? Math.min(...outlierValues) : 0;
  const maxOut = outlierValues.length ? Math.max(...outlierValues) : 0;

  const coloredOutliers = (apiData.outliers_data || [])
    .filter((p) => {
      const b = whiskerBounds[p.x];
      if (!b) return false;
      const v = p.outliers ?? p.y;
      return v < b.lower || v > b.upper;
    })
    .map((p) => ({
      x: categoryMap[p.x], // Usa o mapeamento numérico para o X
      y: p.outliers ?? p.y,
      fillColor: getColorForValue(p.outliers ?? p.y, minOut, maxOut),
    }));

  const series = [
    {
      name: "Boxplot",
      type: "boxPlot",
      data: adjustedBoxData.map((d) => ({ x: categoryMap[d.x], y: d.y })), // Usa o mapeamento numérico para o X
    },
    { name: "Outliers", type: "scatter", data: coloredOutliers },
  ];

  // === RÓTULOS MULTILINHA POR ANOTAÇÕES (sem sobreposição) ===
  const splitAll = categories.map((c) => splitLines(c, 14));
  const maxLines = Math.max(...splitAll.map((ls) => ls.length));
  const lineH = 13;       // Altura de cada linha
  const baseOffsetY = 18; // Offset base para a primeira linha

  const labelAnnotations = [];
  categories.forEach((cat, i) => {
    const lines = splitAll[i];
    lines.forEach((text, li) => {
      labelAnnotations.push({
        x: i + 1, // 'x' = posição numérica do item (1..N)
        x2: i + 1,
        y: 1, // parte inferior do gráfico
        y2: 1,
        borderColor: "transparent",
        label: {
          borderColor: "transparent",
          position: "bottom",
          orientation: "horizontal",
          offsetY: baseOffsetY + li * lineH,
          text,
          style: {
            background: "transparent",
            color: "#666",
            fontSize: "10px",
            fontFamily: "Helvetica, Arial, sans-serif",
            fontWeight: 400,
            textAlign: "center",
          },
        },
      });
    });
  });

  const options = {
    annotations: { xaxis: labelAnnotations },
    chart: {
      type: "boxPlot",
      height: 350,
      toolbar: { show: false },
      background: "transparent",
    },
    title: {
      text: chartTitle,
      align: "left",
      style: { fontSize: "14px", fontWeight: "bold", color: "#373d3f" },
    },
    plotOptions: {
      boxPlot: {
        colors: { upper: "#2E7D9C", lower: "#2E7D9C" },
      },
    },
    stroke: { width: 1.5, colors: ["#000"] },
    xaxis: {
      type: "numeric",
      min: 0.5,
      max: categories.length + 0.5,
      tickAmount: categories.length,
      labels: { show: false }, // <<< esconde labels nativos (agora só aparecem as anotações)
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      title: { text: "Média" },
      min: 1,
      max: 4.2, // respiro maior no topo
      tickAmount: 7,
      labels: { formatter: (v) => v.toFixed(2) },
    },
    grid: {
      borderColor: "#e0e6ed",
      padding: { left: 10, bottom: 20 + baseOffsetY + (maxLines) * lineH },
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    legend: { show: false },
    markers: { size: 4, strokeWidth: 0, shape: "circle" },
    tooltip: {
      shared: false,
      intersect: true,
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        if (seriesIndex === 0) {
          const stats = w.config.series[0].data[dataPointIndex].y;
          const originalXValue = categories[dataPointIndex];
          return (
            `<div class="apexcharts-tooltip-box">` +
            `<strong>Item: ${originalXValue}</strong><br>` +
            `Max: ${stats[4].toFixed(2)}<br>` +
            `Q3: ${stats[3].toFixed(2)}<br>` +
            `Mediana: ${stats[2].toFixed(2)}<br>` +
            `Q1: ${stats[1].toFixed(2)}<br>` +
            `Min: ${stats[0].toFixed(2)}` +
            `</div>`
          );
        }
        const p = w.config.series[1].data[dataPointIndex];
        return `<div class="apexcharts-tooltip-box">Outlier: ${p.y.toFixed(2)}</div>`;
      },
    },
  };

  return (
    <div style={{ width: "100%", height: "350px" }}>
      <Chart options={options} series={series} type="boxPlot" height={350} />
    </div>
  );
}
