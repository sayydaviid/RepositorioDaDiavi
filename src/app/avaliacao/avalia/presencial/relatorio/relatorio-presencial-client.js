"use client";

import { useState } from 'react';
import styles from '../../../../../styles/dados.module.css';


// Componente cliente simples para gerar relatório presencial
export default function RelatorioPresencialClient({ filtersByYear, anosDisponiveis, initialSelected }) {
  const [selected, setSelected] = useState(initialSelected || { ano: '', curso: '', polo: '' });
  const [message, setMessage] = useState('');

  const handleChange = (e) => setSelected(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleGenerate = async () => {
    setMessage('Gerando relatório...');
    try {
      // Simples: monta nome do arquivo e faz download de um CSV fictício
      const downloadName = `relatorio-presencial-${selected.ano || 'all'}-${selected.curso || 'curso'}.csv`;
      // Gera CSV simples a partir dos filtros (no cliente apenas uma demo)
      const csv = `ano,curso,polo\n${selected.ano || ''},${selected.curso || ''},${selected.polo || ''}\n`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('Relatório gerado.');
    } catch (e) {
      setMessage('Erro ao gerar relatório.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const anos = anosDisponiveis || [];
  const cursos = (filtersByYear?.[selected.ano]?.cursos) || [];

  return (
    <div>
      <div className={styles.formRow} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <label>Ano:</label>
        <select name="ano" value={selected.ano} onChange={handleChange}>
          <option value="">(todos)</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <label>Curso:</label>
        <select name="curso" value={selected.curso} onChange={handleChange}>
          <option value="">(todos)</option>
          {cursos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label>Polo:</label>
        <input name="polo" value={selected.polo} onChange={handleChange} placeholder="Polo (opcional)" />

        <button onClick={handleGenerate} className={styles.ctaPrimary}>Gerar</button>
      </div>
      {message && <p className={styles.loadingMessage}>{message}</p>}
    </div>
  );
}
