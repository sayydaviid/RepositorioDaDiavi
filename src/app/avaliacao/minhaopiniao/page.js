'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../../styles/page.module.css';

// 1. Importe o seu Contexto Global
import { useGlobalData } from '../minhaopiniao/context/DataContext'; 

export default function MinhaOpiniaoPage() {
  const router = useRouter();
  
  // 2. Acesse o cache e a função de salvar
  const { cache, saveToCache } = useGlobalData();

  // Mapeamento de rota para a chave do cache e endpoint
  const routeConfigs = {
    '/avaliacao/minhaopiniao/discente': { key: 'discente', url: '/api/discente' },
    '/avaliacao/minhaopiniao/docente': { key: 'docente', url: '/api/docente' },
    '/avaliacao/minhaopiniao/tecnico': { key: 'tecnico', url: '/api/tecnico' },
  };

  const prefetchFor = useCallback(
    async (href) => {
      // 1) Prefetch do bundle da rota (padrão do Next.js)
      router.prefetch(href);

      // 2) Lógica de Cache Inteligente
      const config = routeConfigs[href];
      if (!config) return;

      // Se o dado JÁ está no cache, não fazemos nada (economia de banda)
      if (cache[config.key]) {
        console.log(`Cache encontrado para ${config.key}, ignorando fetch.`);
        return;
      }

      // Se não está no cache, baixamos em background
      try {
        console.log(`Iniciando prefetch de dados para: ${config.key}`);
        const res = await fetch(config.url);
        const data = await res.json();
        
        // Ajuste para pegar a estrutura correta do seu JSON [2].data
        const finalData = data[2]?.data || data;
        
        // Guarda no Contexto Global
        saveToCache(config.key, Array.isArray(finalData) ? finalData : []);
        console.log(`Dados de ${config.key} guardados no cache com sucesso.`);
      } catch (err) {
        console.error(`Erro no prefetch de ${config.key}:`, err);
      }
    },
    [router, cache, saveToCache]
  );

  const onNavigate = useCallback(
    (e, href) => {
      e.preventDefault();
      // Não precisamos esperar o prefetch terminar para navegar, 
      // o prefetch é apenas um bônus de velocidade.
      router.push(href);
    },
    [router]
  );

  const makeLinkProps = (href) => ({
    href,
    className: styles.ctaPrimary,
    // Ativa o prefetch no hover (desktop), foco (teclado) ou toque (mobile)
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