# Documentação Completa do Projeto DIAVI

## 1) Visão geral

Este repositório é uma aplicação **Next.js (App Router)** para análise e geração de relatórios de avaliações institucionais (presencial, EAD e Minha Opinião), com:

- Dashboards interativos (gráficos, filtros e indicadores)
- Rotas de API para leitura de CSV e cache
- Módulos de relatório com geração/preview de PDF
- Componentes compartilhados de layout e navegação

Stack principal identificada em `package.json`:

- `next@16`, `react@19`, `react-dom@19`
- `chart.js`, `react-chartjs-2`, `chartjs-plugin-datalabels`, `@sgratzl/chartjs-chart-boxplot`, `apexcharts`
- `jspdf`, `jspdf-autotable`, `pdf-lib`, `html-to-image`
- `papaparse`, `pg`, `@vercel/blob`

---

## 2) Estrutura de pastas (raiz)

| Pasta/Arquivo | Tipo | Finalidade |
|---|---|---|
| `.env.local` | configuração | Variáveis de ambiente locais (ex.: endpoints, segredos) |
| `.git/` | controle de versão | Metadados do Git |
| `.vscode/` | IDE | Configurações de editor/workspace |
| `.next/` | build | Artefatos gerados pelo Next.js |
| `node_modules/` | dependências | Pacotes instalados |
| `public/` | assets estáticos | Imagens e PDFs servidos diretamente |
| `src/` | código-fonte | Código da aplicação |
| `README.md` | documentação | Documento de entrada do projeto |
| `eslint.config.mjs` | lint | Regras ESLint (`next/core-web-vitals`) |
| `jsconfig.json` | paths | Alias `@/* -> src/*` |
| `next.config.mjs` | framework | Configuração Next, rewrites e headers |
| `package.json` | npm | Scripts e dependências |
| `package-lock.json` | npm | Lockfile de dependências |

### 2.1) Conteúdo de `public/`

- `public/boxplot.jpeg`
- `public/capa_avalia.png`
- `public/CPA logo.jpg`
- `public/DIAVI_logo.png`
- `public/file.svg`
- `public/globe.svg`
- `public/logo-placeholder.svg`
- `public/questionario_disc_2023.pdf`
- `public/questionario_disc_2025.pdf`
- `public/window.svg`

---

## 3) Estrutura completa de pastas em `src/`

| Pasta | Função no sistema |
|---|---|
| `src/app` | Rotas e páginas (App Router) |
| `src/app/api` | Endpoints backend internos |
| `src/app/api/dashboard-cache` | Proxy/cache para dados de dashboard |
| `src/app/api/discente` | API de dados discente (CSV -> JSON) |
| `src/app/api/docente` | API de dados docente (CSV -> JSON) |
| `src/app/api/files` | Estrutura para servir arquivos |
| `src/app/api/files/[fileName]` | Rota dinâmica para download/serve de arquivos |
| `src/app/api/reports` | Endpoints de relatórios |
| `src/app/api/reports/ead` | Submódulo de relatórios EAD |
| `src/app/api/reports/ead/cache` | Cache de relatório EAD (Blob) |
| `src/app/api/tecnico` | API de dados técnico (CSV -> JSON) |
| `src/app/avaliacao` | Domínio principal de avaliação |
| `src/app/avaliacao/avalia` | Módulo Avalia |
| `src/app/avaliacao/avalia/components` | Componentes visuais do Avalia |
| `src/app/avaliacao/avalia/lib` | Utilitários e mapeamentos Avalia |
| `src/app/avaliacao/avalia/presencial` | Dashboard Presencial |
| `src/app/avaliacao/avalia/presencial/atividades_academicas` | Aba temática de atividades |
| `src/app/avaliacao/avalia/presencial/autoavaliacao_discente` | Aba temática de autoavaliação |
| `src/app/avaliacao/avalia/presencial/base_docente` | Aba temática de base docente |
| `src/app/avaliacao/avalia/presencial/dimensoes_gerais` | Aba de dimensões gerais |
| `src/app/avaliacao/avalia/presencial/instalacoes_fisicas` | Aba de instalações físicas |
| `src/app/avaliacao/avalia/presencial/ranking_participantes` | Aba de ranking |
| `src/app/avaliacao/avalia/presencial/relatorio` | Geração de relatório presencial |
| `src/app/avaliacao/avalia/presencial/relatorio/capa` | Regras de capa/texto do relatório |
| `src/app/avaliacao/ead` | Dashboard EAD |
| `src/app/avaliacao/ead/relatorioEAD` | Geração de relatório EAD |
| `src/app/avaliacao/files` | Assets internos de relatório |
| `src/app/avaliacao/lib` | Utilitários compartilhados do domínio |
| `src/app/avaliacao/minhaopiniao` | Módulo Minha Opinião |
| `src/app/avaliacao/minhaopiniao/components` | Componentes e filtros Minha Opinião |
| `src/app/avaliacao/minhaopiniao/context` | Contexto global de dados |
| `src/app/avaliacao/minhaopiniao/discente` | Dashboard Discente |
| `src/app/avaliacao/minhaopiniao/docente` | Dashboard Docente |
| `src/app/avaliacao/minhaopiniao/lib` | Mapeamentos de perguntas/dimensões |
| `src/app/avaliacao/minhaopiniao/tecnico` | Dashboard Técnico |
| `src/app/banco` | CSVs de origem |
| `src/components` | Componentes compartilhados globais |
| `src/styles` | CSS global e módulos CSS |

### 3.1) Dados em `src/app/banco`

- `AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2023-4 .csv`
- `AUTOAVALIAÇÃO DOS CURSOS DE GRADUAÇÃO A DISTÂNCIA - 2025-2.csv`
- `DISCENTE.csv`
- `DOCENTE.csv`
- `TECNICO.csv`

### 3.2) Assets em `src/app/avaliacao/files`

- `boxplot.jpeg`
- `capa.png`
- `capa_avalia_2024-2.png`
- `capa_avalia_2024-4.png`
- `capa_avalia_2025-2.png`
- `questionario_disc.pdf`
- `questionario_doc.pdf`

### 3.3) Estilos em `src/styles`

- `globals.css` (estilo global)
- `dados.module.css` (estilo dos dashboards e relatórios)
- `page.module.css` (estilo de páginas gerais/home)
- `Sidebar.module.css` (sidebar)
- `Footer.module.css` (rodapé)
- `privacy.module.css` (modal de privacidade)

---

## 4) Catálogo completo de componentes

> Nesta seção, “componente” inclui componentes compartilhados, componentes de dashboard, clientes de relatório e abas reutilizáveis.

## 4.1) Componentes compartilhados (`src/components`)

### `Footer.js`
- **Responsabilidade:** Renderiza rodapé institucional e aciona modal de privacidade.
- **Dependências:** `privacy.js`, `Footer.module.css`.
- **Uso:** Layout global (`src/app/layout.js`).

### `Sidebar.js`
- **Responsabilidade:** Navegação lateral global entre módulos.
- **Dependências:** `next/navigation`, `next/link`, `next/image`, `LoadingOverlay`.
- **Uso:** Layout global (`src/app/layout.js`).

### `privacy.js`
- **Responsabilidade:** Modal de política de privacidade.
- **Props:** `open`, `onClose`.
- **Uso:** `Footer.js`.

### `ReportViewer.js`
- **Responsabilidade:** Exibição de preview PDF, estado de geração e ação de download.
- **Props principais:** `canGenerate`, `pdfUrl`, `pdfError`, `downloadName`, `blocking`, `progress`, `progressText`, `contextConfig`.
- **Uso:** clientes de relatório presencial e EAD.

### `reportContexts.js`
- **Responsabilidade:** Define configurações por contexto de relatório (`ead`, `presencial`).
- **Exporta:** `REPORT_CONTEXTS`.
- **Uso:** `ReportViewer` e clientes de relatório.

## 4.2) Componentes de UI do módulo Avalia (`src/app/avaliacao/avalia/components`)

### `Header.js`
- **Responsabilidade:** Cabeçalho padrão de páginas do módulo Avalia.
- **Props:** `title`.

### `LoadingOverlay.js`
- **Responsabilidade:** Overlay de carregamento para ações bloqueantes.
- **Props:** `isFullScreen`, `message`.

### `StatCard.js`
- **Responsabilidade:** Card de KPI/indicador numérico.
- **Props:** `title`, `value`, `unit`, `icon`.

### `ActivityChart.js`
- **Responsabilidade:** Gráfico principal para distribuições/médias em tabs do Avalia.
- **Props principais:** `chartData`, `title`, `customOptions`, `height`, `legendWidth`, `showLegend`.
- **Dependências:** `react-chartjs-2`, `chartjs-plugin-datalabels`.

### `BoxplotChart.js`
- **Responsabilidade:** Gráfico tipo boxplot com carregamento dinâmico.
- **Dependências:** `next/dynamic`, bibliotecas de gráfico.

### `DiscenteFilterAvalia.js`
- **Responsabilidade:** Filtro controlado para recortes do dashboard presencial.
- **Props principais:** `filters`, `selectedFilters`, `onFilterChange`, `showRanking`, `onToggleRanking`.

### `EadFilters.js`
- **Responsabilidade:** Filtro controlado do dashboard EAD.
- **Props principais:** `filters`, `selectedFilters`, `onFilterChange`, `visibleFields`.

## 4.3) Componentes do módulo Minha Opinião (`src/app/avaliacao/minhaopiniao/components`)

### `Header.js`
- **Responsabilidade:** Cabeçalho padrão do módulo Minha Opinião.
- **Props:** `title`.

### `StatCard.js`
- **Responsabilidade:** KPI com título/valor/unidade.
- **Props:** `title`, `value`, `unit`, `icon`.

### `ActivityChart.js`
- **Responsabilidade:** Gráfico genérico para visualização de distribuição.
- **Props:** `chartData`, `title`.

### `QuestionChart.js`
- **Responsabilidade:** Gráfico orientado a perguntas com rótulos específicos.
- **Props principais:** `chartData`, `title`, `questionMap`, `options`.

### `DiscenteFilters.js`
- **Responsabilidade:** Filtros para dashboard Discente.
- **Props principais:** `filters`, `selectedFilters`, `onFilterChange`, `questionMap`, `dimensionMap`.
- **Observação:** consulta municípios em API externa do IBGE.

### `DocenteFilters.js`
- **Responsabilidade:** Filtros para dashboard Docente.
- **Props principais:** análogos ao Discente.

### `TecnicoFilters.js`
- **Responsabilidade:** Filtros para dashboard Técnico.
- **Props principais:** análogos ao Discente.

## 4.4) Componentes cliente e abas do dashboard presencial

### `DiscenteDashboardClient.js`
- **Responsabilidade:** Orquestra estado do dashboard presencial (filtros, datasets, tabs, cards).
- **Props principais:** `initialData`, `filtersOptions`.
- **Consome:** tabs de domínio e componentes base (`StatCard`, `LoadingOverlay`, filtros).

### Abas temáticas

#### `atividades_academicas/AtividadesAcademicasTab.js`
- **Responsabilidade:** Renderiza bloco analítico de atividades acadêmicas.
- **Entradas típicas:** dados já formatados de gráficos e helpers de tooltip.

#### `autoavaliacao_discente/AutoavaliacaoTab.js`
- **Responsabilidade:** Renderiza autoavaliação discente (itens, subdimensões, boxplots, descritivas).
- **Entradas:** múltiplos formatadores e datasets de dimensão/subdimensão.

#### `base_docente/BaseDocenteTab.js`
- **Responsabilidade:** Renderiza visão analítica da base docente (médias/proporções por dimensão/item).
- **Entradas:** datasets de docente e formatadores específicos.

#### `dimensoes_gerais/DimensoesGeraisTab.js`
- **Responsabilidade:** Consolida indicadores de dimensões gerais com gráficos e tabelas descritivas.

#### `instalacoes_fisicas/InstalacoesFisicasTab.js`
- **Responsabilidade:** Exibe análises de instalações físicas com barras e boxplots.

#### `ranking_participantes/RankingParticipantesTab.js`
- **Responsabilidade:** Ranking por entidade (campus/curso).
- **Props:** `title`, `description`, `rows`, `entityLabel`.

## 4.5) Componentes de relatório

### `presencial/relatorio/relatorio-presencial-client.js`
- **Responsabilidade:** Geração de PDF presencial, preview e download.
- **Props:** `filtersOptions`, `initialSelected`.
- **Integra:** `ReportViewer`, `reportContexts`, filtros e assets de capa.

### `ead/relatorioEAD/relatorio-eadead-client.js`
- **Responsabilidade:** Geração de PDF EAD com suporte a cache remoto.
- **Props:** `filtersByYear`, `anosDisponiveis`, `initialSelected`.
- **Integra:** `ReportViewer`, `reportContexts`, `EadFilters`.

---

## 5) Páginas, layouts e rotas (catálogo técnico completo)

## 5.1) Layout e páginas base

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/app/layout.js` | layout raiz | Aplica fontes, `DataProvider`, estrutura global (`Sidebar` + conteúdo + `Footer`) |
| `src/app/page.js` | página home | Tela inicial com links para módulos |

## 5.2) Páginas do domínio Avaliação

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/app/avaliacao/avalia/page.js` | página | Entrada do módulo Avalia |
| `src/app/avaliacao/avalia/presencial/page.js` | página server/client bridge | Pré-carrega dados/filtros e monta `DiscenteDashboardClient` |
| `src/app/avaliacao/avalia/presencial/relatorio/page.js` | página relatório | Prepara estado para relatório presencial |
| `src/app/avaliacao/ead/page.js` | página | Pré-processa dados EAD e monta `EadDashboardClient` |
| `src/app/avaliacao/ead/relatorioEAD/page.js` | página relatório | Prepara estado para relatório EAD |
| `src/app/avaliacao/minhaopiniao/page.js` | página | Landing do módulo Minha Opinião |
| `src/app/avaliacao/minhaopiniao/discente/page.js` | página dashboard | Dashboard Discente |
| `src/app/avaliacao/minhaopiniao/docente/page.js` | página dashboard | Dashboard Docente |
| `src/app/avaliacao/minhaopiniao/tecnico/page.js` | página dashboard | Dashboard Técnico |

## 5.3) Rotas de API (`src/app/api`)

| Endpoint | Arquivo | Método(s) | Responsabilidade |
|---|---|---|---|
| `/api/discente` | `src/app/api/discente/route.js` | `GET` | Lê CSV discente e retorna JSON |
| `/api/docente` | `src/app/api/docente/route.js` | `GET` | Lê CSV docente e retorna JSON |
| `/api/tecnico` | `src/app/api/tecnico/route.js` | `GET` | Lê CSV técnico e retorna JSON |
| `/api/files/[fileName]` | `src/app/api/files/[fileName]/route.js` | `GET` | Serve arquivo por parâmetro dinâmico |
| `/api/dashboard-cache` | `src/app/api/dashboard-cache/route.js` | `GET` | Proxy/cache para dados de dashboard |
| `/api/reports/ead/cache` | `src/app/api/reports/ead/cache/route.js` | `GET`, `POST` | Persistência/recuperação de cache de relatório EAD |

---

## 6) Bibliotecas, contexto e mapeamentos

## 6.1) Avalia (`src/app/avaliacao/avalia/lib`)

| Arquivo | Papel |
|---|---|
| `neon-cache.js` | Persistência/consulta de payloads em banco (`pg`) para cache |
| `questionMappingAvalia.js` | Mapeamento de perguntas/dimensões do módulo Avalia |

## 6.2) Compartilhado Avaliação (`src/app/avaliacao/lib`)

| Arquivo | Papel |
|---|---|
| `prefetchCache.js` | Warmup/prefetch de endpoints |
| `questionMappingEad.js` | Mapeamentos de perguntas, dimensões e subdimensões do EAD |

## 6.3) Minha Opinião (`src/app/avaliacao/minhaopiniao/lib` e `context`)

| Arquivo | Papel |
|---|---|
| `context/DataContext.js` | Contexto global para cache/compartilhamento de dados entre páginas |
| `lib/DimensionMappingDiscente.js` | Mapeamento de dimensões para Discente |
| `lib/DimensionMappingDocente.js` | Mapeamento de dimensões para Docente |
| `lib/dimensionMappingTecnico.js` | Mapeamento de dimensões para Técnico |
| `lib/questionMapping.js` | Mapeamento de perguntas (Discente) e conversão de escala |
| `lib/questionMappingDocente.js` | Mapeamento de perguntas Docente e conversão de escala |
| `lib/questionMappingTecnico.js` | Mapeamento de perguntas Técnico e conversão de escala |

---

## 7) Fluxos funcionais principais

## 7.1) Minha Opinião

1. APIs (`/api/discente`, `/api/docente`, `/api/tecnico`) carregam CSV e devolvem JSON.
2. `DataProvider` mantém estado compartilhado.
3. Páginas por perfil aplicam filtros e renderizam `QuestionChart`/`StatCard`.

## 7.2) Avalia Presencial

1. Página presencial pré-carrega dados e filtros.
2. `DiscenteDashboardClient` controla recortes e seleção de abas.
3. Abas temáticas renderizam gráficos, boxplots e rankings.

## 7.3) EAD

1. Página EAD prepara datasets no servidor.
2. `EadDashboardClient` aplica filtros e monta visualizações.
3. Relatório EAD usa cache remoto via `/api/reports/ead/cache`.

## 7.4) Relatórios PDF

1. Página de relatório prepara dados iniciais.
2. Componente cliente gera/atualiza preview de PDF.
3. `ReportViewer` exibe status, preview e download.

---

## 8) Configuração técnica relevante

### `next.config.mjs`
- `rewrites`: `/backend/:path*` para `NEXT_PUBLIC_API_BASE` (ou fallback HF Space).
- `headers`: cache-control específico para `/backend` e `/api`.
- `httpAgentOptions.keepAlive = false` para reduzir erros de conexão no upstream.
- ajustes experimentais de geração estática para estabilidade.

### `eslint.config.mjs`
- Base `next/core-web-vitals`.
- Ignora `.next`, `node_modules`, `build`, `out`.

### `jsconfig.json`
- Alias de importação: `@/*` -> `src/*`.

---

## 9) Índice rápido por tipo de artefato

### 9.1) Componentes compartilhados
- `src/components/Footer.js`
- `src/components/Sidebar.js`
- `src/components/privacy.js`
- `src/components/ReportViewer.js`
- `src/components/reportContexts.js`

### 9.2) Componentes do Avalia
- `src/app/avaliacao/avalia/components/ActivityChart.js`
- `src/app/avaliacao/avalia/components/BoxplotChart.js`
- `src/app/avaliacao/avalia/components/DiscenteFilterAvalia.js`
- `src/app/avaliacao/avalia/components/EadFilters.js`
- `src/app/avaliacao/avalia/components/Header.js`
- `src/app/avaliacao/avalia/components/LoadingOverlay.js`
- `src/app/avaliacao/avalia/components/StatCard.js`

### 9.3) Componentes Minha Opinião
- `src/app/avaliacao/minhaopiniao/components/ActivityChart.js`
- `src/app/avaliacao/minhaopiniao/components/DiscenteFilters.js`
- `src/app/avaliacao/minhaopiniao/components/DocenteFilters.js`
- `src/app/avaliacao/minhaopiniao/components/Header.js`
- `src/app/avaliacao/minhaopiniao/components/QuestionChart.js`
- `src/app/avaliacao/minhaopiniao/components/StatCard.js`
- `src/app/avaliacao/minhaopiniao/components/TecnicoFilters.js`

### 9.4) Clientes e abas de domínio
- `src/app/avaliacao/avalia/presencial/DiscenteDashboardClient.js`
- `src/app/avaliacao/avalia/presencial/atividades_academicas/AtividadesAcademicasTab.js`
- `src/app/avaliacao/avalia/presencial/autoavaliacao_discente/AutoavaliacaoTab.js`
- `src/app/avaliacao/avalia/presencial/base_docente/BaseDocenteTab.js`
- `src/app/avaliacao/avalia/presencial/dimensoes_gerais/DimensoesGeraisTab.js`
- `src/app/avaliacao/avalia/presencial/instalacoes_fisicas/InstalacoesFisicasTab.js`
- `src/app/avaliacao/avalia/presencial/ranking_participantes/RankingParticipantesTab.js`
- `src/app/avaliacao/ead/EadDashboardClient.js`
- `src/app/avaliacao/avalia/presencial/relatorio/relatorio-presencial-client.js`
- `src/app/avaliacao/ead/relatorioEAD/relatorio-eadead-client.js`

---

## 10) Observações finais

- A base de dados principal é alimentada por CSVs locais e por chamadas para backend externo via `rewrites`.
- O projeto separa bem **camada de dados** (API/lib) e **camada de apresentação** (components/pages).
- Há dois níveis de assets: `public/` (estático global) e `src/app/avaliacao/files` (assets de relatório importados por módulo).
- Para evolução da documentação, recomenda-se manter esta página atualizada sempre que criar nova pasta em `src/app/avaliacao/*` ou novo componente em `components/`.
