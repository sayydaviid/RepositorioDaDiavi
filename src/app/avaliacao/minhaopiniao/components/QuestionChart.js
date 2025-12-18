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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/* ======================================================
   Helper: quebra textos longos (tooltip)
====================================================== */
function wrapLines(text, max = 70) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const w of words) {
    const testLine = line ? `${line} ${w}` : w;
    if (testLine.length > max) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line);
  return lines;
}

/* ======================================================
   QuestionChart
====================================================== */
/**
 * @param {object} props
 * @param {object} props.chartData  Dados formatados para o Chart.js
 * @param {string} props.title      Título do gráfico
 * @param {object} props.questionMap Mapa de perguntas (discente/docente)
 * @param {object} [props.options]  Opções extras do Chart.js
 */
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
      legend: {
        display: false,
      },

      title: {
        display: true,
        text: title,
        font: {
          size: 18,
          weight: 'bold',
        },
        padding: {
          bottom: 20,
        },
      },

      tooltip: {
        backgroundColor: '#050F24',
        titleFont: { size: 14 },
        bodyFont: { size: 12 },

        callbacks: {
          title: (items) => {
            const key = items?.[0]?.label;
            const fullText = questionMap?.[key] || '';
            return [key, ...wrapLines(fullText, 70)];
          },

          label: (context) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';

            const formatted = Number(value)
              .toFixed(2)
              .replace('.', ',');

            return `Média: ${formatted} de 5`;
          },
        },
      },
    },

    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
        },
        title: {
          display: true,
          text: 'Média',
        },
      },

      x: {
        ticks: {
          font: {
            weight: 'bold',
          },
        },
      },
    },
  };

  // Mescla opções padrão com opções customizadas (se existirem)
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
  };

  return (
    <div className={styles.chartContainer}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
