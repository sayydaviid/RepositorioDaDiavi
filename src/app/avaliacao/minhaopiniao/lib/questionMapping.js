export const questionMapping = {
  // --- Políticas de Ensino, Pesquisa, Pós-Graduação e Extensão ---
  "P.2.1": "Seu conhecimento sobre o projeto pedagógico do seu curso.",
  "P.2.2": "A pertinência dos conteúdos e temas tratados nas disciplinas cursadas para a formação profissional.",
  "P.2.3": "A disponibilidade dos professores para atender e orientar fora do horário de aula.",
  "P.2.4": "A abordagem dos conteúdos transversais ('História e Cultura Afro-Brasileira e Indígena' e 'Políticas de Educação Ambiental') no seu curso.",
  "P.2.5": "A contextualização e associação dos conteúdos abordados no seu curso à realidade.",
  "P.2.6": "A divulgação e oportunidades de contatos de atuação relacionadas à formação profissional como estágio, bolsas, etc.",
  "P.2.7": "A relevância acadêmica, científica e social das atividades de extensão desenvolvidas pela UFPA.",
  "P.2.8": "A vinculação das atividades de extensão à formação acadêmica.",
  "P.2.9": "Oportunidades de participação discente em atividades de extensão disponibilizados pela UFPA.",
  "P.2.10": "Oportunidades de participação discente em atividades de pesquisa disponibilizados pela UFPA.",
  "P.2.11": "A integração das ações de ensino, pesquisa e extensão no âmbito do seu curso.",

  // --- Responsabilidade Social ---
  "P.3.12": "As atividades/ações de inclusão social (políticas afirmativas) desenvolvidas pela UFPA.",
  "P.3.13": "As ações voltadas a defesa do meio ambiente desenvolvidas pela UFPA.",
  "P.3.14": "As atividades/ações em defesa do patrimônio cultural e da produção artística desenvolvidas pela UFPA.",
  
  // --- Comunicação com a Sociedade ---
  "P.4.15": "A disponibilização de informações pelos canais da UFPA (web, redes, etc) à comunidade interna.",
  "P.4.16": "A divulgação das ações desenvolvidas pela UFPA para a sociedade (portal da UFPA, redes sociais, eventos e outros veículos de comunicação).",
  "P.4.17": "O atendimento das necessidades acadêmicas nos ambientes virtuais da instituição (SIGAA, Sagitta, Biblioteca Central, etc).",

  // --- Organização e Gestão da Instituição ---
  "P.6.18": "A representatividade discente nos órgãos de gestão da instituição (conselhos superiores, institutos, faculdades).",
  
  // --- Infraestrutura Física ---
  "P.7.19": "Condições de acesso para pessoas com deficiência e/ou mobilidade reduzida.",
  "P.7.20": "A adequação dos ambientes de ensino para o atendimento de estudantes com deficiência.",
  "P.7.21": "A manutenção e a conservação do campus/instituto em que você estuda.",
  "P.7.22": "A quantidade e a qualidade dos laboratórios didáticos.",
  "P.7.23": "A quantidade e a qualidade dos equipamentos e materiais destinados às atividades práticas.",
  "P.7.24": "O uso adequado de recursos audiovisuais e tecnológicos no seu curso.",
  "P.7.25": "A qualidade dos serviços prestados aos usuários pelas Bibliotecas (empréstimos, reservas, orientações, treinamentos, etc).",
  "P.7.26": "A quantidade e a qualidade do acervo bibliográfico, físico e virtual, disponível para o seu curso.",
  "P.7.27": "Os espaços de convivência para atividades culturais, desportivas e de lazer na UFPA.",

  // --- Planejamento e Avaliação ---
  "P.8.28": "A divulgação do resultado das avaliações internas (AVALIA) e externas do curso para os estudantes.",
  "P.8.29": "Os resultados da Avaliação Institucional são divulgados para a comunidade acadêmica.",
  "P.8.30": "Medidas adotadas pela gestão do curso com base nos resultados da avaliação.",

  // --- Políticas de Atendimento ao Estudante ---
  "P.9.31": "A divulgação dos programas e serviços para atendimento ao discente (acolhimento, permanência, monitoria, acessibilidade, assistência, RU, etc).",
  "P.9.32": "O atendimento, por esses serviços, das necessidades específicas dos estudantes.",
  "P.9.33": "Nível de satisfação com o seu curso.",
  "P.9.34": "Nível de satisfação com a UFPA.",
};

/**
 * Converte o valor da resposta (1-5) do seu JSON para uma pontuação numérica.
 * 1 = Ótimo (5 pontos)
 * 2 = Bom (4 pontos)
 * 3 = Regular (3 pontos)
 * 4 = Insuficiente (2 pontos)
 * 5 = NSR (ignorado no cálculo da média)
 */
export const ratingToScore = {
  "1": 5,
  "2": 4,
  "3": 3,
  "4": 2,
  "5": null,
};