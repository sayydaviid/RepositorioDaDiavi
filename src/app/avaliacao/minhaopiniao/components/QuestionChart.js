'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
// 1. Importar o plugin de datalabels
import ChartDataLabels from 'chartjs-plugin-datalabels';
import styles from '../../../../styles/dados.module.css';

// 2. Registrar o plugin
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ChartDataLabels
);

/* ======================================================
   Helpers de Tooltip (Mantidos conforme seu código original)
====================================================== */
function wrapLines(text, max = 70) {
  if (!text) return [];
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length > max) {
      if (line) lines.push(line);
      line = w;
    } else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

const TOOLTIP_ID = 'chartjs-ext-tooltip';

function hideTooltip(el) {
  if (!el) return;
  el.style.opacity = '0';
  el.__activeCanvas = null;
}

function getOrCreateTooltipEl() {
  let el = document.getElementById(TOOLTIP_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOOLTIP_ID;
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '99999';
    el.style.opacity = '0';
    el.style.transition = 'opacity 50ms ease';
    el.style.maxWidth = '420px';
    el.style.background = '#050F24';
    el.style.color = '#fff';
    el.style.borderRadius = '8px';
    el.style.padding = '10px 12px';
    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.2';
    document.body.appendChild(el);

    if (!window.__chartjsExternalTooltipGlobalBound) {
      window.__chartjsExternalTooltipGlobalBound = true;
      document.addEventListener('mousemove', (e) => {
        const t = document.getElementById(TOOLTIP_ID);
        if (!t) return;
        const activeCanvas = t.__activeCanvas;
        if (!activeCanvas) return;
        if (!activeCanvas.contains(e.target)) { hideTooltip(t); }
      }, true);
      window.addEventListener('scroll', () => hideTooltip(document.getElementById(TOOLTIP_ID)), { passive: true });
    }
  }
  return el;
}

function externalTooltipHandler(context, questionMap) {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltipEl();
  if (!tooltip || !tooltip.dataPoints || tooltip.dataPoints.length === 0) {
    hideTooltip(tooltipEl);
    return;
  }
  tooltipEl.__activeCanvas = chart.canvas;
  const item = tooltip.dataPoints[0];
  const key = item?.label || '';
  const fullText = questionMap?.[key] || '';
  const wrapped = wrapLines(fullText, 70);
  const value = item?.parsed?.y;
  const formatted = value === null || value === undefined ? '' : Number(value).toFixed(2).replace('.', ',');

  tooltipEl.innerHTML = `
    <div style="font-weight:700; font-size:13px; margin-bottom:6px;">${key}</div>
    ${wrapped.length ? `<div style="opacity:0.95; margin-bottom:8px;">${wrapped.map((l) => `<div>${l}</div>`).join('')}</div>` : ''}
    ${formatted ? `<div style="display:flex; gap:8px; align-items:center;">
             <span style="width:10px; height:10px; background:#ff8e29; display:inline-block; border-radius:2px;"></span>
             <span>Média: ${formatted} de 5</span>
           </div>` : ''}
  `;

  const canvasRect = chart.canvas.getBoundingClientRect();
  let x = canvasRect.left + tooltip.caretX - (tooltipEl.offsetWidth / 2);
  let y = canvasRect.top + tooltip.caretY - tooltipEl.offsetHeight - 12;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
  tooltipEl.style.opacity = '1';
}

/* ======================================================
   QuestionChart Ajustado
====================================================== */
export default function QuestionChart({
  chartData,
  title,
  questionMap,
  options: customOptions,
}) {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: { display: false },

      title: {
        display: true,
        text: title,
        font: { size: 18, weight: 'bold' },
        padding: { bottom: 25 }, // Espaço entre título e números
      },

      // 3. Configuração para exibir números ACIMA das barras
      datalabels: {
        anchor: 'end', // Fixa no topo da barra
        align: 'top',  // Posiciona acima do topo
        offset: 5,     // Distância da barra
        color: '#444',
        font: { weight: 'bold', size: 12 },
        formatter: (value) => value.toFixed(2),
      },

      tooltip: {
        enabled: false,
        external: (ctx) => externalTooltipHandler(ctx, questionMap),
      },
    },

    layout: {
      // 4. Padding superior aumentado para o número do "5,00" não ser cortado
      padding: { top: 30, left: 10, right: 10, bottom: 10 },
    },

    interaction: {
      mode: 'nearest',
      intersect: true,
    },

    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],

    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 5.5, // 5. Ajustado de 5 para 5.5 para criar espaço visual no topo
        ticks: { stepSize: 1 },
      },
      x: {
        ticks: { font: { weight: 'bold' } },
      },
    },
  };

  // Merge profundo das opções
  const options = {
    ...defaultOptions,
    ...customOptions,
    plugins: {
      ...defaultOptions.plugins,
      ...(customOptions?.plugins || {}),
    },
    scales: {
      ...defaultOptions.scales,
      ...(customOptions?.scales || {}),
    },
    layout: {
      ...defaultOptions.layout,
      ...(customOptions?.layout || {}),
    },
  };

  return (
    <div className={styles.chartContainer} onMouseLeave={() => hideTooltip(document.getElementById(TOOLTIP_ID))}>
      <Bar data={chartData} options={options} />
    </div>
  );
}