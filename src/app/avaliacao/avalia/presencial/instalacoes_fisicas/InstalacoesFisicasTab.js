'use client';

import ActivityChart from '../../components/ActivityChart';
import BoxplotChart from '../../components/BoxplotChart';
import { QUESTION_MAPPING_AVALIA } from '../../lib/questionMappingAvalia';

export default function InstalacoesFisicasTab({
  styles,
  disableZoomOptions,
  twoDecTooltip,
  twoDecTooltipWithQuestions,
  // ticks/formatters
  formatProporcoesItensChartData,
  formatMediasItensChartData,
  // dados
  itensInstalacoesProp,
  itensInstalacoesPropDoc,
  itensInstalacoesMed,
  itensInstalacoesMedDoc,
  // payload completo
  itensInstalacoesBoxDisc,
}) {
  const tabela = itensInstalacoesBoxDisc?.tabela_items;

  const STAT_COLS = ['Min', 'Q1', 'Mediana', 'Media', 'Q3', 'Max'];
  const STAT_LABEL = {
    Min: 'Min',
    Q1: 'Q1',
    Mediana: 'Mediana',
    Media: 'Média',
    Q3: 'Q3',
    Max: 'Max',
  };

  const itens = Array.isArray(tabela)
    ? tabela
        .map((r) => String(r?.item ?? '').trim())
        .filter((x) => x)
    : [];

  return (
    <div style={{ position: 'relative', overflow: 'visible' }}>
      <div
        className={styles.dashboardLayout}
        style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}
      >
        {/* Gráficos de Médias */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          <div className={styles.chartContainer}>
            {itensInstalacoesMed ? (
              <ActivityChart
                chartData={formatMediasItensChartData(itensInstalacoesMed)}
                title="Médias — Itens de Instalações Físicas (Discente)"
                customOptions={{
                  ...disableZoomOptions,
                  plugins: {
                    legend: { display: false },
                    tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.discente.instalacoes),
                  },
                  scales: { y: { max: 4 } },
                }}
              />
            ) : (
              <p>Dados não disponíveis.</p>
            )}
          </div>

          <div className={styles.chartContainer}>
            {itensInstalacoesMedDoc ? (
              <ActivityChart
                chartData={formatMediasItensChartData(itensInstalacoesMedDoc)}
                title="Médias — Itens de Instalações Físicas (Docente)"
                customOptions={{
                  ...disableZoomOptions,
                  plugins: {
                    legend: { display: false },
                    tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.docente.instalacoes),
                  },
                  scales: { y: { max: 4 } },
                }}
              />
            ) : (
              <p>Médias (Docente) não disponíveis.</p>
            )}
          </div>
        </div>

        {/* Gráficos de Proporções */}
        <div className={styles.chartContainer}>
          {itensInstalacoesProp ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(itensInstalacoesProp)}
              title="Proporções — Itens de Instalações Físicas (Discente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.discente.instalacoes),
                },
              }}
            />
          ) : (
            <p>Dados não disponíveis.</p>
          )}
        </div>

        <div className={styles.chartContainer}>
          {itensInstalacoesPropDoc ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(itensInstalacoesPropDoc)}
              title="Proporções — Itens de Instalações Físicas (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.docente.instalacoes),
                },
              }}
            />
          ) : (
            <p>Proporções (Docente) não disponíveis.</p>
          )}
        </div>

        {/* CAIXA 1: Apenas o Boxplot */}
        <div 
          className={styles.chartContainer} 
          style={{ gridColumn: '1 / -1', minHeight: '400px' }}
        >
          {itensInstalacoesBoxDisc ? (
            <BoxplotChart
              apiData={itensInstalacoesBoxDisc}
              title="Boxplot — Distribuição das Médias por Item (Instalações Físicas • Discente)"
              customOptions={disableZoomOptions}
            />
          ) : (
            <p>Boxplot (Discente) não disponível.</p>
          )}
        </div>

        {/* CAIXA 2: A tabela em um container separado (mesma lógica de DimensoesGeraisTab) */}
        <div 
          className={styles.chartContainer} 
          style={{ gridColumn: '1 / -1', height: 'auto', padding: '1.5rem' }}
        >
          <h3
            style={{
              margin: '0 0 15px 0',
              textAlign: 'center',
              width: '100%',
              fontSize: '1rem',
            }}
          >
            Estatísticas Descritivas das Médias por Item (Instalações Físicas • Discente)
          </h3>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '100%' }}>
              {Array.isArray(tabela) && tabela.length ? (
                <div
                  style={{
                    overflowX: 'auto',
                    background: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.85rem',
                      minWidth: '800px',
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th
                          style={{
                            textAlign: 'left',
                            borderBottom: '2px solid rgba(0,0,0,0.1)',
                            padding: '12px 10px',
                            fontWeight: 'bold',
                            position: 'sticky',
                            left: 0,
                            background: '#f8f9fa',
                            zIndex: 3,
                          }}
                        >
                          Estatística
                        </th>
                        {itens.map((it, idx) => (
                          <th
                            key={`${it}-${idx}`}
                            style={{
                              textAlign: 'left',
                              borderBottom: '2px solid rgba(0,0,0,0.1)',
                              padding: '12px 10px',
                              minWidth: '140px',
                            }}
                          >
                            {it}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STAT_COLS.map((stat) => (
                        <tr key={stat} style={{ backgroundColor: '#fff' }}>
                          <td
                            style={{
                              borderBottom: '1px solid rgba(0,0,0,0.08)',
                              padding: '10px',
                              fontWeight: 600,
                              position: 'sticky',
                              left: 0,
                              background: '#fff',
                              zIndex: 1,
                              boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)',
                            }}
                          >
                            {STAT_LABEL[stat] ?? stat}
                          </td>
                          {tabela.map((row, idx) => {
                            const raw = row?.[stat];
                            const cell = Number.isFinite(Number(raw))
                              ? Number(raw).toFixed(2)
                              : raw ?? '-';
                            return (
                              <td
                                key={`${stat}-${idx}`}
                                style={{
                                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                                  padding: '10px',
                                  textAlign: 'left',
                                }}
                              >
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ textAlign: 'center' }}>
                  Tabela descritiva não disponível.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}