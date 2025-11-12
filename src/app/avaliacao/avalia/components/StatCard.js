// src/app/dados/components/StatCard.js
import styles from '../../../../styles/dados.module.css';

const StatCard = ({ title, value, unit, icon }) => {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <p className={styles.statTitle}>{title}</p>
      <div>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statUnit}>{unit}</span>
      </div>
    </div>
  );
};

export default StatCard;