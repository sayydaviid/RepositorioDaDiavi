// Este arquivo mapeia as perguntas do questionário EAD para suas respectivas dimensões e subdimensões.

// Mapeamento de ID da pergunta para o texto completo da pergunta
export const questionMapEad = {
  '1': 'Organizei meus estudos com base no plano de ensino (programação) da(o) disciplina/tema/módulo',
  '2': 'Mantive um relacionamento cordial com o(a) professor (a) coordenador (a) da disciplina',
  '3': 'Mantive um relacionamento cordial com o (a) tutor (a) presencial',
  '4': 'Mantive um relacionamento cordial com o (a) tutor (a) a distância',
  '5': 'Mantive um relacionamento cordial com o (a) coordenador (a) do polo',
  '6': 'Frequentei as atividades presenciais conforme programado',
  '7': 'Participei das atividades a distância conforme programado',
  '8': 'Compreendi os conteúdos ministrados na(o) disciplina/tema/módulo',
  '9': 'Estive motivado/a ao longo da oferta da(o) disciplina/tema/módulo',
  '10': 'Aprofundei meus conhecimentos, de maneira autônoma, consultando outras fontes',
  '11': 'Realizei as atividades da disciplina/tema/módulo, atendendo aos prazos estabelecidos',
  '12': 'Realizei as atividades da disciplina/tema/módulo observando os critérios estabelecidos',
  '13': 'Dediquei horas de estudo à disciplina ao longo da semana',
  '14': 'O(A) professor(a)/coordenador(a) da(o) disciplina/tema/módulo mostrou-se disponível para me atender e orientar',
  '15': 'O(A) professor(a)/coordenador(a) da(o) disciplina/tema/módulo me tratou com ética e respeito',
  '16': 'O(A) tutor(a) presencial mostrou-se disponível para me atender e orientar',
  '17': 'O(A) tutor(a) presencial me tratou com ética e respeito',
  '18': 'O(A) tutor(a) a distância mostrou-se disponível para me atender e orientar',
  '19': 'O(A) tutor(a) a distância me tratou com ética e respeito',
  '20': 'Tive acesso ao plano de ensino (programação) da(o) disciplina/tema/módulo',
  '21': 'O plano de ensino (programação) da(o) disciplina/tema/módulo foi cumprido',
  '22': 'As atividades de tutoria realizadas contemplaram as necessidades da turma',
  '23': 'As atividades de tutoria foram executadas conforme o planejado',
  '24': 'Os conteúdos da(o) disciplina/tema/módulo foram ministrados com clareza e objetividade',
  '25': 'Os conceitos/conteúdos foram apresentados de forma contextualizada',
  '26': 'Fui estimulado a desenvolver o pensamento crítico',
  '27': 'Foram utilizados recursos diversos (vídeos, materiais complementares, webconferências, etc.) durante a oferta da(o) disciplina/tema/módulo',
  '28': 'Esta(e) disciplina/tema/módulo contribuiu com minha formação cidadã e profissional',
  '29': 'A interação com professores e colegas foi favorecida/estimulada',
  '30': 'O material didático fornecido para estudo da(o) disciplina/tema/módulo foi adequado',
  '31': 'O processo avaliativo da(o) disciplina/tema/módulo foi explicado aos discentes de forma clara e objetiva',
  '32': 'A avaliação da aprendizagem foi realizada com critérios bem definidos',
  '33': 'A avaliação da aprendizagem foi realizada de acordo com os conteúdos trabalhados',
  '34': 'Foram utilizados diferentes instrumentos/estratégias de avaliação (provas, seminários, produção textual, etc.)',
  '35': 'Os(As) instrumentos/estratégias de avaliação foram adequados(as), acessíveis aos discentes e os prazos/tempo foram suficientes',
  '36': 'As salas reservadas às atividades presenciais e seu mobiliário estavam em condições adequadas de uso',
  '37': 'A infraestrutura da bibliotecas atendeu adequadamente às necessidades discentes (sala de estudos, atendimento, climatização/conforto)',
  '38': 'O acervo físico atendeu às necessidades discente',
  '39': 'O acervo digital atendeu às necessidades discente',
  '40': 'Os recursos audiovisuais atenderam às necessidades do ensino no âmbito da(o) disciplina/tema/módulo',
  '41': 'O ambiente virtual de aprendizagem utilizado (Moodle/SIGAA) atendeu às necessidades dos discentes',
  '42': 'Os recursos de informática dos laboratórios, nos polos, atenderam às necessidades discentes',
  '43': 'O laboratório de atividades práticas estava adequado às atividades desenvolvidas',
  '44': 'As instalações gerais do polo (banheiros, espaços de convivência, espaço para alimentação, etc.) atendem às necessidades dos discentes',
  '45': 'A acessibilidade nos espaços utilizados, incluindo o ambiente virtual, é adequada',
};

// Mapeamento das 3 Dimensões Principais
export const dimensionMapEad = {
  'Autoavaliação Discente': Array.from({ length: 13 }, (_, i) => String(i + 1)), // Perguntas 1 a 13
  'Avaliação da Ação Docente': Array.from({ length: 22 }, (_, i) => String(i + 14)), // Perguntas 14 a 35
  'Instalações Físicas e Recursos de TI': Array.from({ length: 10 }, (_, i) => String(i + 36)), // Perguntas 36 a 45
};

// Mapeamento detalhado das Subdimensões da Dimensão 2
export const subDimensionMapEad = {
  'Atitude Profissional': Array.from({ length: 6 }, (_, i) => String(i + 14)), // 14 a 19
  'Gestão Didática': Array.from({ length: 11 }, (_, i) => String(i + 20)), // 20 a 30
  'Processo Avaliativo': Array.from({ length: 5 }, (_, i) => String(i + 31)), // 31 a 35
};