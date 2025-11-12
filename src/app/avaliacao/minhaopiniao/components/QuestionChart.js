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
// 1. REMOVA a importação estática do questionMapping
// import { questionMapping } from '../lib/questionMapping'; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function wrapLines(text, max = 70) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line ? line + ' ' : '') + w;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

/**
 * Componente que renderiza um gráfico de barras genérico.
 * @param {object} props
 * @param {object} props.chartData - Objeto de dados formatado para o Chart.js.
 * @param {string} props.title - O título a ser exibido acima do gráfico.
 * @param {object} props.questionMap - O mapa de perguntas (discente ou docente).
 * @param {object} [props.options] - Opções personalizadas para mesclar com as opções padrão.
 */
// 2. ADICIONE questionMap e options às props recebidas
export default function QuestionChart({ chartData, title, questionMap, options: customOptions }) {
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
        backgroundColor: '#050F24',
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
        callbacks: {
          title: (items) => {
            const key = items?.[0]?.label;
            // 3. USE o questionMap da prop, não o importado
            const full = questionMap ? (questionMap[key] || '') : '';
            return [key, ...wrapLines(full, 70)];
          },
          label: (context) => {
            const v = context.parsed.y;
            if (v !== null && v !== undefined) {
              const formattedValue = Number(v).toFixed(2).replace('.', ',');
              return ` Média ${formattedValue} de 5`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        ticks: { stepSize: 1 },
      },
      x: {
        ticks: { font: { weight: 'bold' } },
      },
    },
  };

  // Combina as opções padrão com as personalizadas que podem ser passadas
  const options = { ...defaultOptions, ...customOptions };

  return (
    <div className={styles.chartContainer}>
      {/* 4. Passe as opções finais para o gráfico */}
      <Bar data={chartData} options={options} />
    </div>
  );
}