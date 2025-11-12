'use client';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import styles from '../../../../styles/dados.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const ActivityChart = ({
  chartData,
  title,
  customOptions = {},
  height = 420,          // << controle de altura do card
  legendWidth = 160,     // << largura fixa da coluna da legenda
  showLegend = true
}) => {
  const isPercentual = title.includes('Proporções') || title.includes('Atividades');

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,   // << ESSENCIAL para respeitar a altura do container
    layout: { padding: { top: 20 } },
    plugins: {
      legend: { display: false }, // usamos legenda customizada ao lado
      datalabels: {
        anchor: 'end',
        align: 'end',
        formatter: (value) => Math.round(value * 100) / 100,
        font: { size: 10 },
        color: '#444'
      },
      tooltip: {}
    },
    scales: {
      x: {
        ticks: { maxRotation: 0, minRotation: 0, autoSkip: false, font: { size: 10 } }
      },
      y: {
        beginAtZero: true,
        title: {
          display: isPercentual,
          text: isPercentual ? 'Percentual' : undefined,
          font: { size: 14 }
        },
        max: isPercentual ? 100 : 4
      }
    }
  };

  const finalOptions = {
    ...defaultOptions,
    ...customOptions,
    plugins: {
      ...defaultOptions.plugins,
      ...customOptions.plugins
    },
    scales: {
      ...defaultOptions.scales,
      ...customOptions.scales,
      x: { ...defaultOptions.scales.x, ...(customOptions.scales?.x || {}) },
      y: { ...defaultOptions.scales.y, ...(customOptions.scales?.y || {}) }
    }
  };

  return (
    <div className={styles.chartWrapper}>
      <h2 className={styles.chartTitle}>{title}</h2>

      {/* Área do gráfico em layout flex com altura controlada */}
      <div
        className={styles.chartCanvasWrapper}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          height
        }}
      >
        {/* Canvas ocupa todo o espaço disponível */}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <Bar options={finalOptions} data={chartData} />
        </div>

        {/* Legenda ao lado, nunca por cima do gráfico */}
        {showLegend && chartData?.datasets?.length > 1 && (
          <div
            className={styles.customLegend}
            style={{
              flex: `0 0 ${legendWidth}px`,
              alignSelf: 'flex-start'
            }}
          >
            {chartData.datasets.map((dataset) => (
              <div key={dataset.label} className={styles.legendItem}>
                <span
                  className={styles.legendColorBox}
                  style={{ backgroundColor: dataset.backgroundColor }}
                />
                <span className={styles.legendLabel}>{dataset.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityChart;
