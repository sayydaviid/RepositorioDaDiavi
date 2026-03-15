'use client';

import ActivityChart from '../../components/ActivityChart';
import BoxplotChart from '../../components/BoxplotChart';
import { QUESTION_MAPPING_AVALIA } from '../../lib/questionMappingAvalia';

export default function AutoavaliacaoTab({
  // estilos / helpers
  styles,
  disableZoomOptions,
  twoDecTooltip,
  twoDecTooltipWithQuestions,
  xTicksNoRot,
  renderDescritivasTable,

  // formatters
  formatMediasItensChartData,
  formatProporcoesItensChartData,

  // ✅ subdim formatters
  formatMediasSubdimChartData,
  formatProporcoesSubdimChartData,

  // ✅ Ação Docente (subdimensões) - base discente
  acaoDocSubMedDisc,
  acaoDocSubPropDisc,
  acaoDocSubBoxDisc,

  // (mantidos — você já passava, mesmo que não use aqui)
  docenteMed,
  docenteProp,
  docenteBox,

  // dados (autoavaliação discente)
  itensAutoMed,
  itensAutoProp,
  itensAutoBox,

  // dados (atitude discente)
  itensAtitudeMedDisc,
  itensAtitudePropDisc,
  itensAtitudeBoxDisc,

  // dados (gestão discente)
  itensGestaoMedDisc,
  itensGestaoPropDisc,
  itensGestaoBoxDisc,

  // dados (processo avaliativo discente)
  procDiscMed,
  procDiscProp,
  procDiscBox,

  // dados (instalações discente)
  itensInstalacoesMed,
  itensInstalacoesProp,
  itensInstalacoesBoxDisc,

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
        {/* ============================================================
            ✅ AUTOAVALIAÇÃO DISCENTE (ordem igual ao R original)
            Figura 13 (Proporções) -> Figura 11 (Médias) -> Figura 15 (Boxplot)
           ============================================================ */}
        {showDim2 && (
          <>
        {/* Figura 6 */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {acaoDocSubMedDisc ? (
            <ActivityChart
              chartData={formatMediasSubdimChartData(acaoDocSubMedDisc)}
              title="Médias por Subdimensão da Avaliação da Ação Docente"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.discente.autoavaliacao),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 4 } },
              }}
            />
          ) : (
            <p>Médias (Ação Docente por Subdimensão) não disponíveis.</p>
          )}
        </div>

        {/* Figura 8 */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {acaoDocSubPropDisc ? (
            <ActivityChart
              chartData={formatProporcoesSubdimChartData(acaoDocSubPropDisc)}
              title="Proporções de respostas dadas por Subdimensão da Avaliação da Ação Docente"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.discente.autoavaliacao),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Ação Docente por Subdimensão) não disponíveis.</p>
          )}
        </div>

        {/* ✅ Figura 10 (logo após a Figura 8) + ✅ Tabela descritiva abaixo */}
        {acaoDocSubBoxDisc ? (
          <>
            <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
              <BoxplotChart
                apiData={acaoDocSubBoxDisc}
                title="Distribuição das Médias das Avaliações das Turmas/Docentes por Subdimensão da Ação Docente"
                customOptions={disableZoomOptions}
              />
            </div>

            <div className={styles.chartContainer} style={{ width: '100%', height: 'auto', padding: '1.5rem' }}>
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: '#333' }}>
                Estatísticas descritivas – Ação Docente (por Subdimensão)
              </h4>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 1100 }}>
                  {renderDescritivasTable(acaoDocSubBoxDisc)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.chartContainer} style={{ width: '100%', minHeight: '100px' }}>
            <p>Boxplot e Estatísticas (Ação Docente por Subdimensão) não disponíveis.</p>
          </div>
        )}
          </>
        )}

              {showDim1 && (
                <>
                {/* Figura 11 */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensAutoMed ? (
            <ActivityChart
              chartData={formatMediasItensChartData(itensAutoMed)}
              title="Médias dos itens relacionados à Autoavaliação Discente"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.discente.autoavaliacao),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 4 } },
              }}
            />
          ) : (
            <p>Médias (Autoavaliação) não disponíveis.</p>
          )}
        </div>

        {/* Figura 13 */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensAutoProp ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(itensAutoProp)}
              title="Proporções de respostas dadas aos itens relacionados à Autoavaliação Discente"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.discente.autoavaliacao),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Autoavaliação) não disponíveis.</p>
          )}
        </div>



        {/* Figura 15 */}
        {itensAutoBox ? (
          <>
            <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
              <BoxplotChart
                apiData={itensAutoBox}
                title="Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado à Autoavaliação Discente"
                customOptions={disableZoomOptions}
              />
            </div>

            <div className={styles.chartContainer} style={{ width: '100%', height: 'auto', padding: '1.5rem' }}>
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: '#333' }}>
                Estatísticas descritivas – Autoavaliação Discente (por item)
              </h4>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 1100 }}>
                  {renderDescritivasTable(itensAutoBox)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.chartContainer} style={{ width: '100%', minHeight: '100px' }}>
            <p>Boxplot e Estatísticas (Autoavaliação) não disponíveis.</p>
          </div>
        )}
          </>
        )}

        {/* ============================================================
            ✅ AÇÃO DOCENTE (SUBDIMENSÕES) - BASE DISCENTE
            Ordem do R: Figura 8 (Proporções) -> Figura 6 (Médias) -> Figura 10 (Boxplot)
           ============================================================ */}

        {/* ============================================================
            Abaixo: blocos por item (Atitude, Gestão, Processo, Instalações)
            (seu conteúdo original permanece)
           ============================================================ */}

        {showDim2 && (
          <>
        {/* === ATITUDE PROFISSIONAL DISCENTE === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensAtitudeMedDisc ? (
            <ActivityChart
              chartData={formatMediasItensChartData(itensAtitudeMedDisc)}
              title="Médias dos itens relacionados à Atitude Profissional (Discente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.discente.atitude),
                },
                scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Médias (Atitude Profissional) não disponíveis.</p>
          )}
        </div>

        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensAtitudePropDisc ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(itensAtitudePropDisc)}
              title="Proporções de respostas dadas aos itens relacionados à Atitude Profissional (Discente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.discente.atitude),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Atitude Profissional) não disponíveis.</p>
          )}
        </div>

        {itensAtitudeBoxDisc ? (
          <>
            <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
              <BoxplotChart
                apiData={itensAtitudeBoxDisc}
                title="Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado à Atitude Profissional"
                customOptions={disableZoomOptions}
              />
            </div>

            <div className={styles.chartContainer} style={{ width: '100%', height: 'auto', padding: '1.5rem' }}>
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: '#333' }}>
                Estatísticas descritivas – Atitude Profissional (Discente)
              </h4>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 1100 }}>
                  {renderDescritivasTable(itensAtitudeBoxDisc)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.chartContainer} style={{ width: '100%', minHeight: '100px' }}>
            <p>Boxplot e Estatísticas (Atitude Profissional) não disponíveis.</p>
          </div>
        )}

        {/* === GESTÃO DIDÁTICA DISCENTE === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensGestaoMedDisc ? (
            <ActivityChart
              chartData={formatMediasItensChartData(itensGestaoMedDisc)}
              title="Médias dos itens relacionados à Gestão Didática (Discente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.discente.gestao),
                },
                scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Médias (Gestão Didática) não disponíveis.</p>
          )}
        </div>

        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {itensGestaoPropDisc ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(itensGestaoPropDisc)}
              title="Proporções de respostas dadas aos itens relacionados à Gestão Didática (Discente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.discente.gestao),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Gestão Didática) não disponíveis.</p>
          )}
        </div>

        {itensGestaoBoxDisc ? (
          <>
            <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
              <BoxplotChart
                apiData={itensGestaoBoxDisc}
                title="Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado à Gestão Didática"
                customOptions={disableZoomOptions}
              />
            </div>

            <div className={styles.chartContainer} style={{ width: '100%', height: 'auto', padding: '1.5rem' }}>
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: '#333' }}>
                Estatísticas descritivas – Gestão Didática (Discente)
              </h4>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 1100 }}>
                  {renderDescritivasTable(itensGestaoBoxDisc)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.chartContainer} style={{ width: '100%', minHeight: '100px' }}>
            <p>Boxplot e Estatísticas (Gestão Didática) não disponíveis.</p>
          </div>
        )}

        {/* === PROCESSO AVALIATIVO DISCENTE === */}
        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {procDiscMed ? (
            <ActivityChart
              chartData={formatMediasItensChartData(procDiscMed)}
              title="Médias dos itens relacionados ao Processo Avaliativo (Discente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: twoDecTooltipWithQuestions('', QUESTION_MAPPING_AVALIA.discente.processo),
                },
                scales: { y: { max: 4 }, x: { ticks: xTicksNoRot } },
              }}
            />
          ) : (
            <p>Médias (Processo Avaliativo) não disponíveis.</p>
          )}
        </div>

        <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
          {procDiscProp ? (
            <ActivityChart
              chartData={formatProporcoesItensChartData(procDiscProp)}
              title="Proporções de respostas dadas aos itens relacionados ao Processo Avaliativo (Discente)"
              customOptions={{
                ...disableZoomOptions,
                plugins: {
                  tooltip: twoDecTooltipWithQuestions('%', QUESTION_MAPPING_AVALIA.discente.processo),
                },
                scales: { x: { ticks: xTicksNoRot }, y: { max: 100 } },
              }}
            />
          ) : (
            <p>Proporções (Processo Avaliativo) não disponíveis.</p>
          )}
        </div>

        {procDiscBox ? (
          <>
            <div className={styles.chartContainer} style={{ width: '100%', minHeight: '400px' }}>
              <BoxplotChart
                apiData={procDiscBox}
                title="Distribuição das Médias das Avaliações das Turmas/Docentes por Item relacionado ao Processo Avaliativo"
                customOptions={disableZoomOptions}
              />
            </div>

            <div className={styles.chartContainer} style={{ width: '100%', height: 'auto', padding: '1.5rem' }}>
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: '#333' }}>
                Estatísticas descritivas – Processo Avaliativo (Discente)
              </h4>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 1100 }}>
                  {renderDescritivasTable(procDiscBox)}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.chartContainer} style={{ width: '100%', minHeight: '100px' }}>
            <p>Boxplot e Estatísticas (Processo Avaliativo) não disponíveis.</p>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}