'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../../styles/page.module.css';
import { prefetchJSON } from '../lib/prefetchCache'; // ajuste se necessário

export default function MinhaOpiniaoPage() {
  const router = useRouter();

  // Ajuste as rotas de API reais que cada página consome
  const apiByRoute = {
    '/avaliacao/minhaopiniao/discente': ['/api/discente'],
    '/avaliacao/minhaopiniao/docente': ['/api/docente'],
    '/avaliacao/minhaopiniao/tecnico': ['/api/tecnico'],
  };

  const prefetchFor = useCallback(
    (href) => {
      // 1) Prefetch do bundle/rota (Next)
      router.prefetch(href);

      // 2) Prefetch do(s) endpoint(s) que essa rota usa
      const urls = apiByRoute[href] || [];
      for (const url of urls) {
        prefetchJSON(url).catch(() => {});
      }
    },
    [router]
  );

  const onNavigate = useCallback(
    (e, href) => {
      e.preventDefault();
      prefetchFor(href);
      router.push(href);
    },
    [prefetchFor, router]
  );

  const makeLinkProps = (href) => ({
    href,
    prefetch: true,
    className: styles.ctaPrimary,
    onMouseEnter: () => prefetchFor(href),
    onFocus: () => prefetchFor(href),
    onTouchStart: () => prefetchFor(href), // mobile
    onClick: (e) => onNavigate(e, href),
  });

  return (
    <section className={styles.wrapper}>
      <header className={styles.hero}>
        {/* TEXTO */}
        <div className={styles.heroText}>
          <span className={styles.kicker}>DIAVI • CPA • UFPA</span>

          <h1>
            Minha Opinião <br />
            a voz da comunidade acadêmica
          </h1>

          <p>
            O <strong>Minha Opinião</strong> é o instrumento institucional da UFPA
            para coleta e análise da percepção de <strong>discentes</strong>,
            <strong> docentes</strong> e <strong>técnicos</strong> sobre as
            condições acadêmicas, administrativas e institucionais.
            <br />
            <br />
            Aqui você pode explorar indicadores, comparar resultados e gerar
            relatórios que subsidiam a tomada de decisão e o aprimoramento
            contínuo da Universidade.
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
          <svg
            width="420"
            height="360"
            viewBox="0 0 420 360"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Gráfico */}
            <rect x="90" y="180" width="30" height="80" rx="6" fill="#6B5BCE" />
            <rect x="140" y="150" width="30" height="110" rx="6" fill="#8B7CF0" />
            <rect x="190" y="120" width="30" height="140" rx="6" fill="#FF8A1E" />
            <rect x="240" y="160" width="30" height="100" rx="6" fill="#6B5BCE" />
            <rect x="290" y="140" width="30" height="120" rx="6" fill="#8B7CF0" />

            {/* Linha de base */}
            <rect x="80" y="260" width="260" height="4" rx="2" fill="#9CA3AF" />
          </svg>
        </div>
      </header>
    </section>
  );
}
