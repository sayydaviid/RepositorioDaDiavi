'use client';

import styles from '../styles/dados.module.css';

export default function ReportViewer({
  canGenerate,
  pdfUrl,
  pdfError,
  downloadName,
  blocking,
  progress,
  progressText,
  isAllContexts = false,
  missingMessage,
  clampPct,
  contextConfig,
  isGeneratingPreview = false,
}) {
  const {
    downloadLabel = 'Baixar PDF',
    previewTitle = 'Preview PDF',
    generatingPreviewLabel = 'Gerando pré-visualização…',
    generatingPreviewAllSuffix = '(processando todos)',
    generatingOverlayLabel = <>Gerando relatório…</>,
    generatingOverlayAllLabel = <>Gerando relatório para <strong>Todos</strong>…</>,
    previewHeight = '80vh',
  } = contextConfig || {};

  return (
    <>
      <div style={{ marginTop: 16 }}>
        {!canGenerate ? (
          <div className={styles.errorMessage} style={{ padding: 12 }}>
            {missingMessage}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download={downloadName}
                  className={styles.applyButton}
                >
                  {downloadLabel}
                </a>
              )}

              {pdfError && (
                <span className={styles.errorMessage} style={{ padding: 8 }}>
                  {pdfError}
                </span>
              )}
            </div>

            {pdfUrl ? (
              <iframe
                title={previewTitle}
                src={pdfUrl}
                style={{ width: '100%', height: previewHeight, border: '1px solid #333' }}
              />
            ) : isGeneratingPreview && !pdfError ? (
              <div className={styles.errorMessage} style={{ padding: 12 }}>
                {generatingPreviewLabel}{' '}
                {isAllContexts ? generatingPreviewAllSuffix : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {blocking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            color: '#fff',
            textAlign: 'center',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          aria-modal="true"
          role="dialog"
        >
          <div style={{ fontSize: 18, marginBottom: 14 }}>
            {isAllContexts ? generatingOverlayAllLabel : generatingOverlayLabel}
          </div>

          <div
            aria-label="Progresso de geração"
            style={{
              width: 'min(720px, 90vw)',
              height: 18,
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.4)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${clampPct(progress)}%`,
                height: '100%',
                background: '#fff',
                borderRadius: 9999,
                transition: 'width 220ms ease',
              }}
            />
          </div>

          <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>
            {progressText} &nbsp;•&nbsp; {clampPct(progress)}%
          </div>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
            Por favor, aguarde. A página ficará bloqueada até a conclusão.
          </div>
        </div>
      )}
    </>
  );
}