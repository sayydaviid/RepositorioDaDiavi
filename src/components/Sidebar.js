'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  BookCopy,
  Download,
} from 'lucide-react';
import styles from '../styles/Sidebar.module.css';

const Sidebar = () => {
  const pathname = usePathname();

  // flags pra ativar/desativar partes
  const featureFlags = {
    minhaOpiniaoEnabled: true,
    presencialEnabled: true,
  };

  // NEW: controles de exibição do botão de relatório por seção
  const reportEnabled = {
    ead: true,           // pode ajustar se quiser controlar EAD também
    presencial: false,    // colocar false para esconder em /avaliacao/avalia/presencial
    minhaOpiniao: false,  // colocar false para esconder em /avaliacao/minhaopiniao/*
  };

  // estamos em /avaliacao...
  const inAvalRoutes =
    pathname === '/avaliacao' || pathname.startsWith('/avaliacao/');

  // qual avaliação está selecionada
  const selectedEvaluation = pathname.startsWith('/avaliacao/minhaopiniao')
    ? 'minhaopiniao'
    : pathname.startsWith('/avaliacao/avalia') ||
      pathname.startsWith('/avaliacao/ead')
    ? 'avalia'
    : null;

  // estamos em alguma "modalidade"?
  const inModalidade =
    (featureFlags.presencialEnabled &&
      pathname.startsWith('/avaliacao/avalia/presencial')) ||
    pathname.startsWith('/avaliacao/ead') ||
    (pathname.startsWith('/avaliacao/minhaopiniao/') &&
      !pathname.startsWith('/avaliacao/minhaopiniao/relatorio'));

  // é página de relatório?
  const isReportPage =
    pathname.startsWith('/avaliacao/ead/relatorioEAD') ||
    pathname.startsWith('/avaliacao/minhaopiniao/relatorio') ||
    pathname.startsWith('/avaliacao/avalia/presencial/relatorio');

  const getInitialOpenMenus = useCallback(() => {
    const initial = { avaliacao: false, modalidade: false };
    if (inAvalRoutes) initial.avaliacao = true;
    if (selectedEvaluation) initial.modalidade = true;
    return initial;
  }, [inAvalRoutes, selectedEvaluation]);

  const [openMenus, setOpenMenus] = useState(getInitialOpenMenus);

  useEffect(() => {
    setOpenMenus(getInitialOpenMenus());
  }, [getInitialOpenMenus]);

  useEffect(() => {
    if (selectedEvaluation) {
      setOpenMenus((prev) => ({
        ...prev,
        avaliacao: true,
        modalidade: true,
      }));
    }
  }, [selectedEvaluation]);

  const handleMenuClick = (menuName) => {
    setOpenMenus((prev) => ({ ...prev, [menuName]: !prev[menuName] }));
  };

  const showModalidade = !!selectedEvaluation;

  const avaliacaoHeaderClass =
    inAvalRoutes && !inModalidade ? styles.activeParent : '';

  const modalidadeHeaderClass =
    inModalidade && !isReportPage ? styles.activeParent : '';

  // NEW: regra de visibilidade do botão por rota + flags
  const showGenerateButton =
    (
      pathname === '/avaliacao' || // na raiz de avaliação mantém visível
      (pathname.startsWith('/avaliacao/ead') && reportEnabled.ead) ||
      (pathname.startsWith('/avaliacao/avalia/presencial') && reportEnabled.presencial) ||
      (pathname.startsWith('/avaliacao/minhaopiniao') && reportEnabled.minhaOpiniao)
    );

  const isReportActive = isReportPage;

  const activeReportBtnStyle = isReportActive
    ? {
        backgroundColor: '#ff8a1e',
        color: '#fff',
        borderColor: 'transparent',
      }
    : undefined;

  let reportHref = '/avaliacao/ead/relatorioEAD';
  if (pathname.startsWith('/avaliacao/minhaopiniao')) {
    reportHref = '/avaliacao/minhaopiniao/relatorio';
  } else if (pathname.startsWith('/avaliacao/avalia/presencial')) {
    reportHref = '/avaliacao/avalia/presencial/relatorio';
  } else if (pathname.startsWith('/avaliacao/ead')) {
    reportHref = '/avaliacao/ead/relatorioEAD';
  }

  const minhaOpiniaoDiscenteActive =
    pathname === '/avaliacao/minhaopiniao/discente' ||
    pathname.startsWith('/avaliacao/minhaopiniao/discente/');

  const minhaOpiniaoDocenteActive =
    pathname === '/avaliacao/minhaopiniao/docente' ||
    pathname.startsWith('/avaliacao/minhaopiniao/docente/');

  const minhaOpiniaoTecnicoActive =
    pathname === '/avaliacao/minhaopiniao/tecnico' ||
    pathname.startsWith('/avaliacao/minhaopiniao/tecnico/');

  return (
    <aside className={styles.sidebar}>
      <div
        className={styles.logoContainer}
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <Image
          src="/DIAVI_logo.png"
          alt="Logo DIAVI"
          width={150}
          height={45}
          priority
        />
        <Image
          src="/CPA%20logo.jpg"
          alt="Logo CPA"
          width={120}
          height={45}
          priority
          style={{ objectFit: 'contain' }}
        />
      </div>

      <nav className={styles.nav}>
        <ul>
          {/* Página Inicial */}
          <li className={pathname === '/' ? styles.activeParent : ''}>
            <Link href="/" className={styles.menuHeader}>
              <Home size={18} />
              <span>Página Inicial</span>
            </Link>
          </li>

          {/* Avaliação */}
          <li className={avaliacaoHeaderClass}>
            <div
              className={styles.menuHeader}
              onClick={() => handleMenuClick('avaliacao')}
            >
              <ClipboardCheck size={18} />
              <span>Avaliação</span>
              {openMenus.avaliacao ? (
                <ChevronUp size={16} className={styles.chevron} />
              ) : (
                <ChevronDown size={16} className={styles.chevron} />
              )}
            </div>

            {openMenus.avaliacao && (
              <ul className={styles.subMenu}>
                <li
                  className={
                    pathname.startsWith('/avaliacao/avalia')
                      ? styles.subMenuItemActive
                      : styles.subMenuItem
                  }
                >
                  <Link href="/avaliacao/avalia">Avalia</Link>
                </li>

                {featureFlags.minhaOpiniaoEnabled && (
                  <li
                    className={
                      pathname.startsWith('/avaliacao/minhaopiniao')
                        ? styles.subMenuItemActive
                        : styles.subMenuItem
                    }
                  >
                    <Link href="/avaliacao/minhaopiniao">Minha Opinião</Link>
                  </li>
                )}
              </ul>
            )}
          </li>

          {/* Modalidade / segundo nível */}
          {showModalidade && (
            <li className={modalidadeHeaderClass}>
              <div
                className={styles.menuHeader}
                onClick={() => handleMenuClick('modalidade')}
              >
                <BookCopy size={18} />
                <span>Modalidade</span>
                {openMenus.modalidade ? (
                  <ChevronUp size={16} className={styles.chevron} />
                ) : (
                  <ChevronDown size={16} className={styles.chevron} />
                )}
              </div>

              {openMenus.modalidade && (
                <ul className={styles.subMenu}>
                  {selectedEvaluation === 'minhaopiniao' ? (
                    <>
                      <li
                        className={
                          minhaOpiniaoDiscenteActive
                            ? styles.subMenuItemActive
                            : styles.subMenuItem
                        }
                      >
                        <Link href="/avaliacao/minhaopiniao/discente">
                          Discente
                        </Link>
                      </li>
                      <li
                        className={
                          minhaOpiniaoDocenteActive
                            ? styles.subMenuItemActive
                            : styles.subMenuItem
                        }
                      >
                        <Link href="/avaliacao/minhaopiniao/docente">
                          Docente
                        </Link>
                      </li>
                      <li
                        className={
                          minhaOpiniaoTecnicoActive
                            ? styles.subMenuItemActive
                            : styles.subMenuItem
                        }
                      >
                        <Link href="/avaliacao/minhaopiniao/tecnico">
                          Técnico
                        </Link>
                      </li>
                    </>
                  ) : (
                    <>
                      {featureFlags.presencialEnabled && (
                        <li
                          className={
                            pathname.startsWith('/avaliacao/avalia/presencial')
                              ? styles.subMenuItemActive
                              : styles.subMenuItem
                          }
                        >
                          <Link href="/avaliacao/avalia/presencial">
                            Presencial
                          </Link>
                        </li>
                      )}
                      <li
                        className={
                          pathname.startsWith('/avaliacao/ead')
                            ? styles.subMenuItemActive
                            : styles.subMenuItem
                        }
                      >
                        <Link href="/avaliacao/ead">EAD</Link>
                      </li>
                    </>
                  )}
                </ul>
              )}
            </li>
          )}
        </ul>

        {/* Botão Gerar Relatório */}
        {showGenerateButton && (
          <div className={styles.generateReportContainer}>
            <Link
              href={reportHref}
              aria-label="Gerar relatório"
              className={styles.generateReportBtn}
              style={activeReportBtnStyle}
            >
              <Download size={18} />
              <span>Gerar relatório</span>
            </Link>
          </div>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
