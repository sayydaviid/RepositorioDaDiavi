'use client';

export default function LoadingOverlay({ isFullScreen = true, message = "Carregando..." }) {
  return (
    <>
      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{
        position: isFullScreen ? 'fixed' : 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(255,255,255,0.8)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        flexDirection: 'column', zIndex: 9999,
        backdropFilter: 'blur(4px)',
        borderRadius: isFullScreen ? 0 : '8px',
      }}>
        <div style={{
          width: 50, height: 50,
          border: '6px solid #f3f3f3',
          borderTop: '6px solid #FF8E29', // Cor institucional
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <p style={{ color: '#333', fontWeight: '600', fontSize: '0.9rem' }}>{message}</p>
      </div>
    </>
  );
}