// DimensoesGeraisTab.js
'use client';

import ActivityChart from '../../components/ActivityChart';
import BoxplotChart from '../../components/BoxplotChart';

export default function DimensoesGeraisTab({
  datasets,
  dashboardData,
  styles,
  disableZoomOptions,
  twoDecTooltip,
  renderDescritivasTable,
}) {
  return (
    <div
      style={{
        position: 'relative',
        gap: '1rem',
        overflow: 'visible',
      }}
    >
      <div className={styles.singleGrid}>
        {/* Linha 1: Médias */}
        <div id="chart-medias-dimensoes" className={styles.chartContainer}>
          <ActivityChart
            chartData={datasets.discMedias}
            title="Médias por dimensão (Discente)"
            customOptions={{
              ...disableZoomOptions,
              plugins: {
                legend: { display: false },
                tooltip: twoDecTooltip(),
              },
            }}
          />
        </div>

        <div className={styles.chartContainer}>
          {dashboardData.docDimMedias ? (
            <ActivityChart
              chartData={datasets.docMedias}
              title="Médias por dimensão (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltip(),
                },
              }}
            />
          ) : (
            <p>Dados de médias por dimensão (Docente) não disponíveis.</p>
          )}
        </div>

        {/* Linha 2: Proporções */}
        <div id="chart-dimensoes" className={styles.chartContainer}>
          <ActivityChart
            chartData={datasets.discProporcoes}
            title="Proporções de respostas dadas por Dimensão (Discente)"
            legendPosition="overlayTopRight"
            customOptions={{
              ...disableZoomOptions,
              plugins: { tooltip: twoDecTooltip('%') },
            }}
          />
        </div>

        <div className={styles.chartContainer}>
          {dashboardData.docDimProporcoes ? (
            <ActivityChart
              chartData={datasets.docProporcoes}
              title="Proporções de respostas dadas por Dimensão (Docente)"
              legendPosition="overlayTopRight"
              customOptions={{
                ...disableZoomOptions,
                plugins: { tooltip: twoDecTooltip('%') },
              }}
            />
          ) : (
            <p>Dados de proporções por dimensão (Docente) não disponíveis.</p>
          )}
        </div>
      </div>

      {/* ADICIONADO id="chart-boxplot-dimensoes" PARA O PDF ENCONTRAR O GRÁFICO */}
      <div
        id="chart-boxplot-dimensoes"
        className={styles.chartContainer}
        style={{ gridColumn: '1 / -1', minHeight: '400px' }}
      >
        {dashboardData.turmaDimBoxplot ? (
          <BoxplotChart
            apiData={dashboardData.turmaDimBoxplot}
            title="Distribuição das Médias das Avaliações das Turmas/Docente por Dimensão"
            customOptions={disableZoomOptions}
          />
        ) : (
          <p>Dados de boxplot (Turmas/Docente por Dimensão) não disponíveis.</p>
        )}
      </div>

      {/* Caixa 2: A tabela em um container separado, para não dar sobreposição */}
      <div
        className={styles.chartContainer}
        style={{ gridColumn: '1 / -1', height: 'auto', padding: '1.5rem' }}
      >
        <h3
          style={{
            margin: '0 0 10px 0',
            textAlign: 'center',
            width: '100%',
          }}
        >
          Estatísticas Descritivas das Médias das Avaliações das Turmas/Docentes por
          Dimensão
        </h3>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%' }}>
            {renderDescritivasTable(dashboardData.turmaDimDescritivas)}
          </div>
        </div>
      </div>
    </div>
  );
}