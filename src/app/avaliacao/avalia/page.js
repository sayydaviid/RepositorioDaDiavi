// src/app/avaliacao/page.js
import styles from '../../../styles/dados.module.css';

export default function AvaliarPage() {
  return (
    <div className={styles.mainContent} style={{ maxWidth: 980, margin: '0 auto' }}>
      <section
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '28px 28px',
          lineHeight: 1.65,
          boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
        }}
      >
        <h1 style={{ fontSize: 28, marginBottom: 8, color: '#0F172A' }}>
          Avaliação dos cursos de graduação da UFPA
        </h1>

        <p style={{ marginBottom: 16, color: '#334155' }}>
          O presente instrumento foi elaborado pela <strong>Comissão Própria de Avaliação (CPA) da UFPA</strong>,
          com o objetivo de conhecer a percepção dos <strong>discentes</strong> sobre seus cursos de graduação.
        </p>

        <p style={{ marginBottom: 16, color: '#334155' }}>
          O questionário é composto por tópicos que possibilitam avaliar cada atividade curricular realizada no período letivo,
          envolvendo <strong>autoavaliação discente</strong>, <strong>avaliação da ação docente</strong> e a
          <strong> infraestrutura disponível</strong>.
        </p>

        <p style={{ marginBottom: 16, color: '#334155' }}>
          Os tópicos são apresentados na forma de afirmativas, para as quais deve ser atribuído um valor de <strong>1 a 4</strong>,
          conforme a avaliação da realidade vivenciada. O valor <strong>5</strong> deve ser utilizado apenas quando a
          afirmativa <em>não se aplica</em> à disciplina/módulo/tema.
        </p>

        <p style={{ marginBottom: 16, color: '#334155' }}>
          A opinião dos <strong>discentes</strong> é fundamental para a análise da qualidade das ações desenvolvidas
          e para a melhoria das fragilidades identificadas, pois permite avaliar o percurso formativo e os aspectos do curso
          que impactam o desempenho discente e docente. Recomenda-se a leitura atenta de cada afirmativa e a marcação da
          alternativa que melhor represente a percepção do discente.
        </p>

        <p style={{ marginBottom: 24, color: '#334155' }}>
          Ressalta-se que <strong>não há identificação do respondente</strong> no questionário, preservando-se o anonimato.
          Agradecemos, antecipadamente, a participação.
        </p>

        <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '20px 0 24px' }} />

        <h2 style={{ fontSize: 22, marginBottom: 12, color: '#0F172A' }}>
          Escala de avaliação
        </h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#334155' }}>
          <li><strong>Valor 1</strong> = Insuficiente</li>
          <li><strong>Valor 2</strong> = Regular</li>
          <li><strong>Valor 3</strong> = Bom/Boa</li>
          <li><strong>Valor 4</strong> = Excelente</li>
          <li><strong>Valor 5</strong> = Não se aplica</li>
        </ul>

        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            padding: '14px 16px',
            borderRadius: 12,
            marginTop: 20,
            color: '#0f172a',
          }}
        >
          <strong>Atenção:</strong> nos painéis e gráficos de resultados, o <strong>valor 5</strong> (<em>Não se aplica</em>)
          <strong> não é contabilizado</strong>, por não representar avaliação de qualidade do item.
        </div>
      </section>
    </div>
  );
}
