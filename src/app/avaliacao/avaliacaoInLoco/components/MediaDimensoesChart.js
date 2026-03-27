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

const barShadow3dPlugin = {
  id: 'barShadow3d',
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  },
};

const verticalValueLabelsPlugin = {
  id: 'verticalValueLabels',
  afterDatasetsDraw(chart) {
    if (chart?.config?.type !== 'bar') return;
    if (chart?.options?.plugins?.verticalValueLabels !== true) return;

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
        const rawValue = dataset.data?.[index];
        if (rawValue === null || rawValue === undefined || Number.isNaN(Number(rawValue))) {
          return;
        }

        const text = `- ${Number(rawValue).toFixed(2).replace('.', ',')}`;
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
  barShadow3dPlugin,
  verticalValueLabelsPlugin
);

export default function MediaDimensoesChart({ data, title }) {
  const dimensionDescriptions = {
    D1: 'ORGANIZAÇÃO DIDÁTICO-PEDAGÓGICA',
    D2: 'CORPO DOCENTE E TUTORIAL',
    D3: 'INFRAESTRUTURA',
  };

  const chartData = {
    labels: data?.labels ?? [],
    datasets: [
      {
        label: 'D1',
        data: data?.d1 ?? [],
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.62,
        maxBarThickness: 24,
      },
      {
        label: 'D2',
        data: data?.d2 ?? [],
        backgroundColor: 'rgba(255, 142, 41, 0.8)',
        borderColor: 'rgba(255, 142, 41, 1)',
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.62,
        maxBarThickness: 24,
      },
      {
        label: 'D3',
        data: data?.d3 ?? [],
        backgroundColor: 'rgba(107, 114, 128, 0.8)',
        borderColor: 'rgba(107, 114, 128, 1)',
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.62,
        maxBarThickness: 24,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      verticalValueLabels: true,
      legend: { display: true, position: 'bottom' },
      title: { display: false },
      datalabels: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const dimension = context.dataset.label;
            const description = dimensionDescriptions[dimension] ?? '';
            const value = Number(context.raw ?? 0).toFixed(2);
            return `${dimension} - ${description}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: false,
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          font: { size: 10 },
        },
      },
      y: {
        stacked: false,
        beginAtZero: true,
        max: 5,
        title: {
          display: true,
          text: 'Média',
        },
      },
    },
  };

  return (
    <>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.chartContainer}>
        <Bar data={chartData} options={options} />
      </div>
    </>
  );
}
