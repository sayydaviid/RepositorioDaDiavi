'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import nProgress from 'nprogress'; // Import para feedback visual
import 'nprogress/nprogress.css';
import { useGlobalData } from '../app/avaliacao/minhaopiniao/context/DataContext'; // Import do cache global

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
  const { cache, saveToCache } = useGlobalData(); // Acesso ao cache

  const featureFlags = { minhaOpiniaoEnabled: true, presencialEnabled: true };
  const reportEnabled = { ead: true, presencial: false, minhaOpiniao: false };

  // --- Lógica de Prefetch de Dados ---
  const prefetchData = async (url, cacheKey) => {
    if (cache[cacheKey]) return; // Se já está no cache, não faz nada
    try {
      const res = await fetch(url);
      const data = await res.json();
      const finalData = data[2]?.data || data;
      saveToCache(cacheKey, finalData); // Salva no contexto global
    } catch (err) {
      console.error("Erro no prefetch da Sidebar:", err);
    }
  };

  const inAvalRoutes = pathname === '/avaliacao' || pathname.startsWith('/avaliacao/');
  const selectedEvaluation = pathname.startsWith('/avaliacao/minhaopiniao') 
    ? 'minhaopiniao' 
    : (pathname.startsWith('/avaliacao/avalia') || pathname.startsWith('/avaliacao/ead') ? 'avalia' : null);

  const [openMenus, setOpenMenus] = useState({ avaliacao: false, modalidade: false });

  useEffect(() => {
    if (inAvalRoutes) setOpenMenus(prev => ({ ...prev, avaliacao: true }));
    if (selectedEvaluation) setOpenMenus(prev => ({ ...prev, modalidade: true }));
  }, [inAvalRoutes, selectedEvaluation]);

  const handleMenuClick = (menuName) => {
    setOpenMenus((prev) => ({ ...prev, [menuName]: !prev[menuName] }));
  };

  const showGenerateButton = (
    pathname === '/avaliacao' || 
    (pathname.startsWith('/avaliacao/ead') && reportEnabled.ead) ||
    (pathname.startsWith('/avaliacao/minhaopiniao') && reportEnabled.minhaOpiniao)
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/DIAVI_logo.png" alt="Logo DIAVI" width={150} height={45} priority />
        <Image src="/CPA%20logo.jpg" alt="Logo CPA" width={120} height={45} priority style={{ objectFit: 'contain' }} />
      </div>

      <nav className={styles.nav}>
        <ul>
          <li className={pathname === '/' ? styles.activeParent : ''}>
            <Link href="/" className={styles.menuHeader} onClick={() => nProgress.start()}>
              <Home size={18} />
              <span>Página Inicial</span>
            </Link>
          </li>

          <li className={inAvalRoutes ? styles.activeParent : ''}>
            <div className={styles.menuHeader} onClick={() => handleMenuClick('avaliacao')}>
              <ClipboardCheck size={18} />
              <span>Avaliação</span>
              {openMenus.avaliacao ? <ChevronUp size={16} className={styles.chevron} /> : <ChevronDown size={16} className={styles.chevron} />}
            </div>

            {openMenus.avaliacao && (
              <ul className={styles.subMenu}>
                <li className={pathname.startsWith('/avaliacao/avalia') ? styles.subMenuItemActive : styles.subMenuItem}>
                  <Link href="/avaliacao/avalia" onClick={() => nProgress.start()}>Avalia</Link>
                </li>
                {featureFlags.minhaOpiniaoEnabled && (
                  <li className={pathname.startsWith('/avaliacao/minhaopiniao') ? styles.subMenuItemActive : styles.subMenuItem}>
                    <Link 
                      href="/avaliacao/minhaopiniao" 
                      onClick={() => nProgress.start()}
                      // Começa a baixar os dados quando o mouse encosta no botão
                      onMouseEnter={() => {
                        prefetchData('/api/discente', 'discente');
                        prefetchData('/api/docente', 'docente');
                        prefetchData('/api/tecnico', 'tecnico');
                      }}
                    >
                      Minha Opinião
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </li>

          {/* Modalidade e demais itens mantidos conforme sua estrutura */}
          {/* ... */}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;