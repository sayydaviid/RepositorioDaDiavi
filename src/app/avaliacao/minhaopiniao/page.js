'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../../styles/page.module.css';

// 1. Importe o seu Contexto Global
import { useGlobalData } from '../minhaopiniao/context/DataContext'; 

/* ==========================================================================
   Função Auxiliar: Parse de CSV
   (Necessária aqui para converter o texto bruto antes de salvar no Cache Global)
   ========================================================================== */
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  // Remove o cabeçalho original (pois os índices mudaram/estão duplicados na fonte)
  const dataRows = lines.slice(1); 

  return dataRows.map(line => {
    const columns = [];
    let currentVal = '';
    let insideQuote = false;

    // Parser manual para lidar com aspas e vírgulas internas
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        columns.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    columns.push(currentVal.trim());

    // Mapeamento idêntico ao da página de dados
    const rowObj = {
      CURSO_DISCENTE: columns[3] || 'N/I',
      CAMPUS_DISCENTE: columns[4] || 'N/I',
      UNIDADE_DISCENTE: columns[4] || 'N/I', // Fallback usando Campus
    };

    // Mapeia Pergunta_1 a Pergunta_34
    for (let q = 1; q <= 34; q++) {
      rowObj[`Pergunta_${q}`] = columns[5 + q]; 
    }

    return rowObj;
  });
}

/* ==========================================================================
   Componente Principal
   ========================================================================== */
export default function MinhaOpiniaoPage() {
  const router = useRouter();
  
  // 2. Acesse o cache e a função de salvar
  const { cache, saveToCache } = useGlobalData();

  const routeConfigs = {
    '/avaliacao/minhaopiniao/discente': { key: 'discente', url: '/api/discente', type: 'csv' }, // Marquei como CSV
    '/avaliacao/minhaopiniao/docente': { key: 'docente', url: '/api/docente', type: 'json' }, // Mantive JSON por enquanto (se mudou, altere aqui)
    '/avaliacao/minhaopiniao/tecnico': { key: 'tecnico', url: '/api/tecnico', type: 'json' },
  };

  const prefetchFor = useCallback(
    async (href) => {
      // 1) Prefetch do bundle da rota (padrão do Next.js)
      router.prefetch(href);

      // 2) Lógica de Cache Inteligente
      const config = routeConfigs[href];
      if (!config) return;

      // Se o dado JÁ está no cache, não fazemos nada
      if (cache[config.key] && cache[config.key].length > 0) {
        console.log(`Cache encontrado para ${config.key}, ignorando fetch.`);
        return;
      }

      // Se não está no cache, baixamos em background
      try {
        console.log(`Iniciando prefetch de dados para: ${config.key}`);
        const res = await fetch(config.url);

        let finalData = [];

        // --- CORREÇÃO AQUI ---
        // Verifica se devemos tratar como CSV ou JSON baseado na config ou resposta
        if (config.type === 'csv') {
            const textData = await res.text(); // Baixa como TEXTO
            finalData = parseCSV(textData);    // Converte para Objeto
        } else {
            // Lógica antiga para JSON (Docente/Técnico se ainda forem JSON)
            const jsonData = await res.json();
            finalData = jsonData[2]?.data || jsonData;
        }
        
        // Guarda no Contexto Global
        saveToCache(config.key, Array.isArray(finalData) ? finalData : []);
        console.log(`Dados de ${config.key} guardados no cache com sucesso. Registros: ${finalData.length}`);
      } catch (err) {
        console.error(`Erro no prefetch de ${config.key}:`, err);
      }
    },
    [router, cache, saveToCache] // Dependências
  );

  const onNavigate = useCallback(
    (e, href) => {
      e.preventDefault();
      router.push(href);
    },
    [router]
  );

  const makeLinkProps = (href) => ({
    href,
    className: styles.ctaPrimary,
    onMouseEnter: () => prefetchFor(href),
    onFocus: () => prefetchFor(href),
    onTouchStart: () => prefetchFor(href), 
    onClick: (e) => onNavigate(e, href),
  });

  return (
    <section className={styles.wrapper}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.kicker}>DIAVI • CPA • UFPA</span>

          <h1>
            Minha Opinião <br />
            a voz da comunidade acadêmica
          </h1>

          <p>
            O <strong>Minha Opinião</strong> é o instrumento institucional da UFPA
            para coleta e análise da percepção de <strong>discentes</strong>,
            <strong> docentes</strong> e <strong>técnicos</strong>.
            <br /><br />
            Explore indicadores e compare resultados em tempo real.
          </p>

          <div className={styles.ctaGroup}>
            <Link {...makeLinkProps('/avaliacao/minhaopiniao/discente')}>
              Discente
            </Link>

            <Link {...makeLinkProps('/avaliacao/minhaopiniao/docente')}>
              Docente
            </Link>

            <Link {...makeLinkProps('/avaliacao/minhaopiniao/tecnico')}>
              Técnico
            </Link>
          </div>
        </div>

        {/* ILUSTRAÇÃO */}
        <div className={styles.heroArt} aria-hidden="true">
          <svg width="420" height="360" viewBox="0 0 420 360" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="90" y="180" width="30" height="80" rx="6" fill="#6B5BCE" />
            <rect x="140" y="150" width="30" height="110" rx="6" fill="#8B7CF0" />
            <rect x="190" y="120" width="30" height="140" rx="6" fill="#FF8A1E" />
            <rect x="240" y="160" width="30" height="100" rx="6" fill="#6B5BCE" />
            <rect x="290" y="140" width="30" height="120" rx="6" fill="#8B7CF0" />
            <rect x="80" y="260" width="260" height="4" rx="2" fill="#9CA3AF" />
          </svg>
        </div>
      </header>
    </section>
  );
}