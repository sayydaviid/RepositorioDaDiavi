'use client';
import { useEffect, useRef } from 'react';
import styles from '../styles/privacy.module.css';

export default function Privacy({ open, onClose }) {
  const overlayRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Fecha com ESC e trava scroll sem empurrar layout
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);

    // ---- bloqueia scroll sem empurrar layout ----
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const { style } = document.documentElement;
    const prevOverflow = style.overflow;
    const prevPadding = style.paddingRight;
    style.overflow = 'hidden';
    // adiciona padding igual à largura do scrollbar (geralmente 15–17px)
    if (scrollbarWidth > 0) style.paddingRight = `${scrollbarWidth}px`;

    // foco no botão fechar
    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      style.overflow = prevOverflow;
      style.paddingRight = prevPadding;
      clearTimeout(t);
    };
  }, [open, onClose]);

  // Fecha clicando fora
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onMouseDown={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
    >
      <article
        className={styles.card}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="privacy-title">Política de Privacidade</h2>
          <button
            ref={closeBtnRef}
            className={styles.close}
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.content}>
          <p className={styles.kicker}>DIAVI • UFPA</p>
          <p><strong>Última atualização:</strong> 14 de outubro de 2025</p>

          <p>
            A <strong>Diretoria de Avaliação Institucional (DIAVI)</strong> da <strong>UFPA</strong>
            valoriza a privacidade. Este site não coleta dados pessoais de forma direta.
            Registramos apenas informações técnicas de acesso (IP, navegador, páginas visitadas)
            para fins estatísticos e de melhoria do serviço.
          </p>

          <h3>Uso e compartilhamento</h3>
          <p>
            Os dados coletados automaticamente são usados para garantir o funcionamento, segurança
            e melhoria do portal. Não vendemos ou compartilhamos informações com terceiros, e
            seguimos a <strong>LGPD (Lei nº 13.709/2018)</strong>.
          </p>

          <h3>Cookies</h3>
          <p>
            Podemos utilizar cookies para preferências e métricas. Você pode desativá-los nas
            configurações do navegador.
          </p>

          <h3>Seus direitos</h3>
          <p>
            Você pode solicitar informações sobre eventual uso de dados, correção ou exclusão.
            Contato: <a href="mailto:diavi@ufpa.br">diavi@ufpa.br</a>.
          </p>

          <h3>Alterações</h3>
          <p>
            Esta política pode ser atualizada. Manteremos a data de atualização no início do documento.
          </p>
        </div>
      </article>
    </div>
  );
}
