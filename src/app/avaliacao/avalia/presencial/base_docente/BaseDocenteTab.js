'use client';

import ActivityChart from '../../components/ActivityChart';
import { QUESTION_MAPPING_AVALIA } from '../../lib/questionMappingAvalia';

export default function BaseDocenteTab({
  // ui
  styles,
  disableZoomOptions,
  twoDecTooltip,
  twoDecTooltipWithQuestions,
  xTicksNoRot,

  // formatters
  formatMediasSubdimChartData,
  formatProporcoesSubdimChartData,
  formatMediasItensChartData,
  formatProporcoesItensChartData,
  normalizeAtitudeDocenteChartData,
  formatMediasDimDocente,
  formatProporcoesDimDocente,

  // dados
  docSubMed,
  docSubProp,
  docTurmaMed,
  docTurmaProp,

  itensAtitudeMedDoc,
  itensAtitudePropDoc,

  itensGestaoMedDoc,
  itensGestaoPropDoc,

  procDocMed,
  procDocProp,

  itensInstalacoesMedDoc,
  itensInstalacoesPropDoc,

  docDimMed,
  docDimProp,

  dimensionFilter = '',
}) {
  const showDim1 = !dimensionFilter || dimensionFilter === '1';
  const showDim2 = !dimensionFilter || dimensionFilter === '2';

  return (
    <div style={{ position: 'relative', overflow: 'visible' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2rem',
          width: '100%',
          overflow: 'visible',
        }}
      >
        {showDim2 && (
          <>
        {/* === 1. Médias por Subdimensão da Autoavaliação da Ação Docente === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {docSubMed ? (
            <ActivityChart
              chartData={formatMediasSubdimChartData(docSubMed)}
              title="Médias por Subdimensão da Autoavaliação da Ação Docente"
              customOptions={{
                ...disableZoomOptions,
                plugins: { legend: { display: false }, tooltip: twoDecTooltip() },
                layout: { padding: { top: 10, right: 6, bottom: 0, left: 6 } },
                scales: { y: { max: 5 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Médias (Subdimensão - Base Docente) não disponíveis.</p>
          )}
        </div>

        {/* === 2. Proporções por Subdimensão da Autoavaliação da Ação Docente === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {docSubProp ? (
            <ActivityChart
              chartData={formatProporcoesSubdimChartData(docSubProp)}
              title="Proporções de respostas dadas por Subdimensão da Autoavaliação da Ação Docente"
              customOptions={{
                ...disableZoomOptions,
                plugins: { tooltip: twoDecTooltip('%') },
                layout: { padding: { top: 50, right: 6, bottom: 0, left: 1 } },
                scales: { x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Proporções (Subdimensão - Base Docente) não disponíveis.</p>
          )}
        </div>
            </>
          )}

          {showDim1 && (
            <>
        {/* === 3. Médias dos itens relacionados à Avaliação da Turma === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {docTurmaMed ? (
            <ActivityChart
              chartData={formatMediasItensChartData(docTurmaMed)}
              title="Médias dos itens relacionados à Avaliação da Turma"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.docente.avaliacaoTurma),
                },
                layout: { padding: { top: 8, right: 6, bottom: 0, left: 6 } },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 4 } },
              }}
            />
          ) : (
            <p>Médias (Avaliação da Turma) não disponíveis.</p>
          )}
        </div>

        {/* === 4. Proporções dos itens relacionados à Avaliação da Turma === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {docTurmaProp ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(docTurmaProp)}
              title="Proporções de respostas dadas aos itens relacionados à Avaliação da Turma"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.docente.avaliacaoTurma),
                },
                layout: { padding: { top: 8, right: -12, bottom: 0, left: -30 } },
                scales: { y: { max: 100 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Proporções (Avaliação da Turma) não disponíveis.</p>
          )}
        </div>
            </>
          )}

          {showDim2 && (
            <>
        {/* === 5. Médias dos itens relacionados à Atitude Profissional (Docente) === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensAtitudeMedDoc ? (
            <ActivityChart
              chartData={normalizeAtitudeDocenteChartData(
                formatMediasItensChartData(itensAtitudeMedDoc)
              )}
              title="Médias dos itens relacionados à Atitude Profissional (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.docente.atitude),
                },
                scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Médias (Atitude Profissional) não disponíveis.</p>
          )}
        </div>

        {/* === 6. Proporções dos itens relacionados à Atitude Profissional (Docente) === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensAtitudePropDoc ? (
            <ActivityChart
              chartData={normalizeAtitudeDocenteChartData(
                formatProporcoesItensChartData(itensAtitudePropDoc)
              )}
              title="Proporções de respostas dadas aos itens relacionados à Atitude Profissional (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.docente.atitude),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Atitude Profissional) não disponíveis.</p>
          )}
        </div>

        {/* === 7. Médias dos itens relacionados à Gestão Didática (Docente) === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensGestaoMedDoc && itensGestaoMedDoc.length > 0 ? (
            <ActivityChart
              chartData={formatMediasItensChartData(itensGestaoMedDoc)}
              title="Médias dos itens relacionados à Gestão Didática (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.docente.gestao),
                },
                scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Médias (Gestão Didática) não disponíveis.</p>
          )}
        </div>

        {/* === 8. Proporções dos itens relacionados à Gestão Didática (Docente) === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensGestaoPropDoc && itensGestaoPropDoc.length > 0 ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(itensGestaoPropDoc)}
              title="Proporções de respostas dadas aos itens relacionados à Gestão Didática (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.docente.gestao),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Gestão Didática) não disponíveis.</p>
          )}
        </div>

        {/* === 9. Médias dos itens relacionados ao Processo Avaliativo (Docente) === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {procDocMed ? (
            <ActivityChart
              chartData={formatMediasItensChartData(procDocMed)}
              title="Médias dos itens relacionados ao Processo Avaliativo (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.docente.processo),
                },
                scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Médias (Processo Avaliativo) não disponíveis.</p>
          )}
        </div>

        {/* === 10. Proporções dos itens relacionados ao Processo Avaliativo (Docente) === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {procDocProp ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(procDocProp)}
              title="Proporções de respostas dadas aos itens relacionados ao Processo Avaliativo (Docente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.docente.processo),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Processo Avaliativo) não disponíveis.</p>
          )}
        </div>
            </>
          )}

      </div>
    </div>
  );
}