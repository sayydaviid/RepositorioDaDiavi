'use client';

export default function RankingParticipantesTab({
  title,
  description,
  rows,
  entityLabel = 'Curso',
}) {
  const data = Array.isArray(rows) ? rows : [];

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '1rem',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
        {description && (
          <p style={{ margin: '0.35rem 0 0', color: '#666' }}>{description}</p>
        )}
      </div>

      {!data.length ? (
        <p style={{ textAlign: 'center', padding: '1rem 0' }}>
          Nenhum dado disponível para os filtros selecionados.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff',
              fontSize: 14,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Ranking</th>
                <th style={thStyle}>{entityLabel}</th>
                <th style={thStyle}>Discentes</th>
                <th style={thStyle}>Docentes</th>
                <th style={thStyle}>Total de Participantes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={`${row?.curso ?? row?.campus ?? index}-${index}`}>
                  <td style={tdStyle}>{row?.ranking ?? index + 1}</td>
                  <td style={tdStyle}>{row?.curso ?? row?.campus ?? '—'}</td>
                  <td style={tdStyle}>{row?.discentes ?? 0}</td>
                  <td style={tdStyle}>{row?.docentes ?? 0}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>
                    {row?.total_participantes ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 10px',
  borderBottom: '2px solid rgba(0,0,0,0.12)',
  whiteSpace: 'nowrap',
  fontWeight: 700,
};

const tdStyle = {
  padding: '10px',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  whiteSpace: 'nowrap',
};