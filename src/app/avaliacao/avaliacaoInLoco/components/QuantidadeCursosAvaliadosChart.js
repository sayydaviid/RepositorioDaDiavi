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

const topLabelsPlugin = {
  id: 'topLabelsPlugin',
  afterDatasetsDraw(chart) {
    if (chart?.config?.type !== 'bar') return;
    if (chart?.options?.plugins?.topLabelsPlugin !== true) return;

    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#374151';
    ctx.font = '600 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      meta.data.forEach((bar, index) => {
        const value = Number(dataset.data?.[index] ?? 0);
        if (!Number.isFinite(bar?.x) || !Number.isFinite(bar?.y)) return;
        ctx.fillText(String(value), bar.x, bar.y - 4);
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
  topLabelsPlugin
);

export default function QuantidadeCursosAvaliadosChart({ data }) {
  const labels = data?.anos ?? [];
  const values = data?.valores ?? [];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Quant. Cursos Avaliados',
        data: values,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 3,
        maxBarThickness: 28,
      },
    ],
  };

  const maxValue = Math.max(...values, 0);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      topLabelsPlugin: true,
      legend: { display: false },
      datalabels: false,
      verticalValueLabels: false,
      verticalTopValuesPlugin: false,
      tooltip: {
        callbacks: {
          label: (context) => `Quantidade: ${Number(context.raw ?? 0)}`,
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
        suggestedMax: maxValue + 2,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  return (
    <>
      <h3 className={styles.chartTitle}>Quant. Cursos Avaliados</h3>
      <div className={styles.chartContainer}>
        <Bar data={chartData} options={options} />
      </div>
    </>
  );
}
