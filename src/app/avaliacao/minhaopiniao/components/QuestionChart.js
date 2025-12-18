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
import styles from '../../../../styles/dados.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/* ======================================================
   Helper: quebra textos longos (tooltip)
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
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ======================================================
   Tooltip helpers
====================================================== */
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

    // Fade out/in: 50ms
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

    // Global mousemove: se não está no canvas ativo, esconde
    if (!window.__chartjsExternalTooltipGlobalBound) {
      window.__chartjsExternalTooltipGlobalBound = true;

      document.addEventListener(
        'mousemove',
        (e) => {
          const t = document.getElementById(TOOLTIP_ID);
          if (!t) return;

          const activeCanvas = t.__activeCanvas;
          if (!activeCanvas) return;

          // Se saiu do canvas ativo, some
          if (!activeCanvas.contains(e.target)) {
            hideTooltip(t);
          }
        },
        true
      );

      window.addEventListener(
        'scroll',
        () => {
          const t = document.getElementById(TOOLTIP_ID);
          hideTooltip(t);
        },
        { passive: true }
      );

      window.addEventListener('blur', () => {
        const t = document.getElementById(TOOLTIP_ID);
        hideTooltip(t);
      });
    }
  }

  return el;
}

/* ======================================================
   External Tooltip Handler
====================================================== */
function externalTooltipHandler(context, questionMap) {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltipEl();

  // IMPORTANTÍSSIMO: se não estiver em cima de um ELEMENTO (barra), não mostra
  // Com intersect:true, isso vira o comportamento padrão.
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
  const formatted =
    value === null || value === undefined
      ? ''
      : Number(value).toFixed(2).replace('.', ',');

  tooltipEl.innerHTML = `
    <div style="font-weight:700; font-size:13px; margin-bottom:6px;">${key}</div>
    ${
      wrapped.length
        ? `<div style="opacity:0.95; margin-bottom:8px;">${wrapped
            .map((l) => `<div>${l}</div>`)
            .join('')}</div>`
        : ''
    }
    ${
      formatted
        ? `<div style="display:flex; gap:8px; align-items:center;">
             <span style="width:10px; height:10px; background:#ff8e29; display:inline-block; border-radius:2px;"></span>
             <span>Média: ${formatted} de 5</span>
           </div>`
        : ''
    }
  `;

  const canvasRect = chart.canvas.getBoundingClientRect();
  const tooltipWidth = tooltipEl.offsetWidth || 300;
  const tooltipHeight = tooltipEl.offsetHeight || 120;

  let x = canvasRect.left + tooltip.caretX - tooltipWidth / 2;
  let y = canvasRect.top + tooltip.caretY - tooltipHeight - 12;

  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (x < pad) x = pad;
  if (x + tooltipWidth > vw - pad) x = vw - pad - tooltipWidth;

  if (y < pad) y = canvasRect.top + tooltip.caretY + 12;
  if (y + tooltipHeight > vh - pad) y = vh - pad - tooltipHeight;

  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
  tooltipEl.style.opacity = '1';
}

/* ======================================================
   QuestionChart
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
        padding: { bottom: 20 },
      },

      tooltip: {
        enabled: false,
        external: (ctx) => externalTooltipHandler(ctx, questionMap),
      },
    },

    layout: {
      padding: { top: 12 },
    },

    // AQUI está a correção do seu requisito:
    // tooltip só quando estiver EM CIMA da barra
    interaction: {
      mode: 'nearest',
      intersect: true,
    },

    // Garante que o ChartJS processe saída do canvas
    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],

    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 5,
        ticks: { stepSize: 1 },
      },
      x: {
        ticks: { font: { weight: 'bold' } },
      },
    },
  };

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
    interaction: {
      ...defaultOptions.interaction,
      ...(customOptions?.interaction || {}),
    },
  };

  // Se sair do card, esconde (reforço)
  const onMouseLeaveContainer = () => {
    const t = document.getElementById(TOOLTIP_ID);
    hideTooltip(t);
  };

  return (
    <div className={styles.chartContainer} onMouseLeave={onMouseLeaveContainer}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
