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

const verticalTopValuesPlugin = {
  id: 'verticalTopValuesPlugin',
  afterDatasetsDraw(chart) {
    if (chart?.config?.type !== 'bar') return;
    if (chart?.options?.plugins?.verticalTopValuesPlugin !== true) return;

    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.font = '600 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      meta.data.forEach((bar, index) => {
        const raw = dataset.data?.[index];
        if (raw === null || raw === undefined || Number.isNaN(Number(raw))) return;

        const text = Number(raw).toFixed(2).replace('.', ',');
        const x = bar.x;
        const y = bar.y - 10;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      });
    });

    ctx.restore();
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  verticalTopValuesPlugin
);

export default function MediaDimensaoAnualChart({ data }) {
  const dimensionDescriptions = {
    D1: 'ORGANIZAÇÃO DIDÁTICO-PEDAGÓGICA',
    D2: 'CORPO DOCENTE E TUTORIAL',
    D3: 'INFRAESTRUTURA',
  };

  const chartData = {
    labels: data?.anos ?? [],
    datasets: [
      {
        label: 'D1',
        data: data?.d1 ?? [],
        backgroundColor: 'rgba(54, 162, 235, 0.85)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'D2',
        data: data?.d2 ?? [],
        backgroundColor: 'rgba(255, 142, 41, 0.85)',
        borderColor: 'rgba(255, 142, 41, 1)',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'D3',
        data: data?.d3 ?? [],
        backgroundColor: 'rgba(107, 114, 128, 0.85)',
        borderColor: 'rgba(107, 114, 128, 1)',
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      verticalTopValuesPlugin: true,
      legend: { display: true, position: 'bottom' },
      datalabels: false,
      verticalValueLabels: false,
      topLabelsPlugin: false,
      tooltip: {
        callbacks: {
          label: (context) => {
            const dimension = context.dataset.label;
            const description = dimensionDescriptions[dimension] ?? '';
            const value = Number(context.raw ?? 0).toFixed(2).replace('.', ',');
            return `${dimension} - ${description}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
          font: { size: 10 },
        },
      },
      y: {
        beginAtZero: true,
        max: 5,
      },
    },
  };

  return (
    <>
      <h3 className={styles.chartTitle}>Média por Dimensão Anual</h3>
      <div className={styles.chartContainer}>
        <Bar data={chartData} options={options} />
      </div>
    </>
  );
}
