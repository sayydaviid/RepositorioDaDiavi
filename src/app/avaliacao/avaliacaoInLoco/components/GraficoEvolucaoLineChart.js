'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import styles from '../../../../styles/dados.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function GraficoEvolucaoLineChart({ data }) {
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
        data: data?.series?.d1 ?? [],
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 1)',
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 5,
        datalabels: {
          display: false,
        },
      },
      {
        label: 'D2',
        data: data?.series?.d2 ?? [],
        borderColor: 'rgba(255, 142, 41, 1)',
        backgroundColor: 'rgba(255, 142, 41, 1)',
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 5,
        datalabels: {
          display: false,
        },
      },
      {
        label: 'D3',
        data: data?.series?.d3 ?? [],
        borderColor: 'rgba(107, 114, 128, 1)',
        backgroundColor: 'rgba(107, 114, 128, 1)',
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 5,
        datalabels: {
          display: false,
        },
      },
      {
        label: 'CC',
        data: data?.series?.cc ?? [],
        borderColor: 'rgba(245, 158, 11, 1)',
        backgroundColor: 'rgba(245, 158, 11, 1)',
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 5,
        datalabels: {
          display: false,
        },
      },
      {
        label: 'AVAL',
        data: data?.series?.aval ?? [],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 1)',
        tension: 0,
        pointRadius: 4,
        pointHoverRadius: 5,
        datalabels: {
          display: false,
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
      verticalValueLabels: false,
      datalabels: false,
      tooltip: {
        callbacks: {
          label: (context) => {
            const dimension = context.dataset.label;
            const description = dimensionDescriptions[dimension];
            const value = Number(context.raw ?? 0).toFixed(2).replace('.', ',');

            if (description) {
              return `${dimension} - ${description}: ${value}`;
            }

            return `${dimension}: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 6,
        ticks: {
          callback: (value) => `${Number(value).toFixed(2).replace('.', ',')}`,
        },
      },
    },
  };

  return (
    <>
      <h3 className={styles.chartTitle}>Média anual de D1, D2, D3, CC e AVAL</h3>
      <div className={styles.chartContainer}>
        <Line data={chartData} options={options} />
      </div>
    </>
  );
}
