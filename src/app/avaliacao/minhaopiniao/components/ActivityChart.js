// src/app/dados/components/ActivityChart.js
'use client'; // Gráficos precisam ser componentes de cliente
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import styles from '../../../../styles/dados.module.css';

// Registra os componentes necessários do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ActivityChart = ({ chartData, title }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
        y: {
            beginAtZero: true
        }
    }
  };

  return (
    <div className={styles.chartCard}>
      <h2 className={styles.chartTitle}>{title}</h2>
      <div className={styles.chartContainer}>
        <Bar options={options} data={chartData} />
      </div>
    </div>
  );
};

export default ActivityChart;