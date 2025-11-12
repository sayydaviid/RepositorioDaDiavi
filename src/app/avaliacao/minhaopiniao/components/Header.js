// src/app/dados/components/Header.js
import { Search, Bell } from 'lucide-react';
import styles from '../../../../styles/dados.module.css';

const Header = ({ title }) => {
  const today = new Date().toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.headerTitle}>{title}</h1>
        <p className={styles.headerSubtitle}>{today}</p>
      </div>
    </header>
  );
};

export default Header;