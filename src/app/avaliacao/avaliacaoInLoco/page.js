// src/app/avaliacao/avaliacaoInLoco/page.js
import styles from '../../../styles/dados.module.css';

export default function AvaliacaoInLocoPage() {
  return (
    <div className={`${styles.mainContent} inloco-page-container`}>
      <section className="inloco-info-card">
        <h1 className="inloco-title">
          Avaliação In Loco dos Cursos de Graduação da UFPA
        </h1>

        <p className="inloco-paragraph">
          A <strong>Avaliação In Loco</strong> é um processo essencial para conhecer a realidade dos cursos de graduação da UFPA.
          Esta avaliação é conduzida pela <strong>Comissão Própria de Avaliação (CPA)</strong> com o objetivo de verificar
          in loco as condições infraestruturais, os processos acadêmicos e a qualidade do ensino oferecido.
        </p>

        <p className="inloco-paragraph">
          Durante as visitas in loco, são realizadas entrevistas com <strong>gestores</strong>, <strong>docentes</strong>,
          <strong> discentes</strong> e <strong>técnicos administrativos</strong>, permitindo uma avaliação completa e contextualizada
          das atividades desenvolvidas nos cursos.
        </p>

        <p className="inloco-paragraph">
          Os aspectos avaliados incluem:
        </p>

        <ul className="inloco-list">
          <li className="inloco-list-item">Infraestrutura física e tecnológica</li>
          <li className="inloco-list-item">Qualificação e atuação do corpo docente</li>
          <li className="inloco-list-item">Condições oferecidas aos discentes</li>
          <li className="inloco-list-item">Processos de gestão e organização acadêmica</li>
          <li className="inloco-list-item">Recursos humanos técnicos e administrativos</li>
          <li className="inloco-list-item">Políticas de apoio ao estudante</li>
        </ul>

        <p className="inloco-paragraph">
          Os resultados da avaliação in loco contribuem para a melhoria contínua da qualidade dos cursos, subsidiam
          o processo de autorização e renovação de reconhecimento, e orientam o planejamento estratégico da instituição.
        </p>

        <p className="inloco-paragraph inloco-paragraph-last">
          A participação colaborativa de todos os envolvidos no processo educativo é fundamental para o sucesso
          desta avaliação e para a excelência institucional da UFPA.
        </p>

        <hr className="inloco-divider" />
      </section>
    </div>
  );
}
