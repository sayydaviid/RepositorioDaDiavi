// src/app/components/Footer.js
'use client';

import React, { useState, useCallback } from 'react';
import styles from '../styles/Footer.module.css';
import Privacy from './privacy'; // ajuste o caminho se necessário

const Footer = () => {
  const [openPrivacy, setOpenPrivacy] = useState(false);

  const handleOpenPrivacy = useCallback(() => setOpenPrivacy(true), []);
  const handleClosePrivacy = useCallback(() => setOpenPrivacy(false), []);

  return (
    <>
      <footer className={styles.footer}>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} DIAVI. Todos os direitos reservados.
        </p>

        <div className={styles.footerLinks}>
          {/* Botão estilizado como link para abrir o modal */}
          <button
            type="button"
            className={styles.linkButton}
            onClick={handleOpenPrivacy}
            aria-haspopup="dialog"
            aria-controls="privacy-modal"
          >
            Política de Privacidade
          </button>
        </div>
      </footer>

      {/* Modal de Privacidade */}
      <div id="privacy-modal">
        <Privacy open={openPrivacy} onClose={handleClosePrivacy} />
      </div>
    </>
  );
};

export default Footer;
