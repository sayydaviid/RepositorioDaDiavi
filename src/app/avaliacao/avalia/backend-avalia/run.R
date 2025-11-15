# nolint start
# ===================================================================
# PONTO DE ENTRADA DA API (Versão Otimizada p/ Filtragem no Servidor)
# ===================================================================

# --- 0. Opções globais ---
options(stringsAsFactors = FALSE)

# --- 1. Carga de Pacotes e Módulos ---
library(plumber)
library(dplyr)
library(jsonlite)
library(tidyr)

# Porta/host para PaaS
PORT <- as.integer(Sys.getenv("PORT", "8000"))
HOST <- "0.0.0.0"

# (opcional) garantir working dir para o source("R/main.R")
suppressWarnings({
  f <- tryCatch(normalizePath(sys.frames()[[1]]$ofile), error = function(e) NULL)
  if (!is.null(f)) setwd(dirname(f))
})

# Carrega configs e utilitários (deve definir load_data, filter_data, etc.)
source("R/main.R")

# --- 1.1 Helpers ---
normalize_param <- function(x) {
  if (is.null(x)) return("all") # nolint
  x_chr <- tolower(trimws(as.character(x)))
  if (x_chr %in% c("", "all", "todos", "todas", "todo", "qualquer", "none", "null", "undefined")) {
    return("all")
  }
  return(x)
}

# segurança p/ mapeamento de subdimensões docente
.assert_subdim_map_doc <- function() {
  if (!exists("subdim_map_doc")) {
    stop("subdim_map_doc não encontrado. Defina em R/1_config.R como uma lista nomeada: nomes = subdimensões; valores = vetores de colunas.")
  }
  if (!is.list(subdim_map_doc) || is.null(names(subdim_map_doc))) {
    stop("subdim_map_doc deve ser uma lista nomeada. Ex: list('Planejamento' = c('D201','D202'), ...)")
  }
}

# Rotuladores de itens
.label_itens_auto  <- function(cols) gsub("^P(\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)
.label_itens_media <- function(cols) gsub("^mediap(\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)

# Rotulador genérico (para colunas que terminam com 3 dígitos, ex.: X211 -> 2.11)
.label_itens_any <- function(cols) {
  gsub(".*?(\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)
}

# Aceita "P211" / "D211" / "mediap211" -> "2.1.1"
.label_itens_any <- function(cols) {
  cols <- as.character(cols)
  cols <- gsub("^mediap(\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)
  cols <- gsub("^[PD](\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)
  cols
}

# --- 2. Carga Inicial dos Dados ---
all_data <- load_data()
base_discente_global <- all_data$discente
base_docente_global  <- all_data$docente
cat(">> Dados carregados. API pronta para iniciar.\n")

# --- 3. Definição da API ---
pr <- pr()

# --- 4. Filtro de CORS ---
pr <- pr_filter(pr, "cors", function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  if (req$REQUEST_METHOD == "OPTIONS") { res$status <- 200; return(list()) }
  plumber::forward()
})

# --- 5. Endpoints básicos ---
pr <- pr_get(pr, "/", function() list(api_status = "Online", message = "Bem-vindo à API do Dashboard AVALIA."))
pr <- pr_get(pr, "/health", function() list(status = "OK", time = as.character(Sys.time())))
pr <- pr_get(pr, "/filters", function() {
  list(
    campus = sort(unique(c(base_discente_global$CAMPUS, base_docente_global$CAMPUS))),
    cursos = sort(unique(c(base_discente_global$CURSO,  base_docente_global$CURSO)))
  )
})

# ==========================================================
# >>>>>>>>>>>> CARDS (DISCENTE) <<<<<<<<<<<<
# ==========================================================
pr <- pr_get(
  pr, "/discente/geral/summary",
  function(campus = "all", curso = "all") {
    campus_norm <- normalize_param(campus)
    curso_norm  <- normalize_param(curso)

    dados_filtrados <- filter_data(base_discente_global, base_docente_global, campus_norm, curso_norm)$disc
    total_respondentes <- length(unique(dados_filtrados$ID))

    todas_colunas_questoes <- c(colsAutoAvDisc, colsAcaoDocente, colsInfra)

    rankings <- base_discente_global %>%
      select(CAMPUS, all_of(todas_colunas_questoes)) %>%
      pivot_longer(cols = -CAMPUS, names_to = "questao", values_to = "nota") %>%
      filter(!is.na(nota) & !is.na(CAMPUS)) %>%
      mutate(nota = suppressWarnings(as.numeric(nota))) %>%
      group_by(CAMPUS) %>%
      summarise(media_geral = mean(nota, na.rm = TRUE), .groups = 'drop')

    melhor_campus <- rankings %>% filter(media_geral == max(media_geral, na.rm = TRUE)) %>% slice(1)
    pior_campus   <- rankings %>% filter(media_geral == min(media_geral, na.rm = TRUE)) %>% slice(1)

    list(
      total_respondentes = total_respondentes,
      campus_melhor_avaliado = list(campus = melhor_campus$CAMPUS, media = round(melhor_campus$media_geral, 2)),
      campus_pior_avaliado   = list(campus = pior_campus$CAMPUS,   media = round(pior_campus$media_geral, 2))
    )
  }
)

# -------------------------------
# DISCENTES (Agregados)
# -------------------------------
pr <- pr_get(
  pr, "/discente/dimensoes/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    data.frame(
      dimensao = c("Autoavaliação Discente", "Ação Docente", "Instalações Físicas"),
      media = c(
        mean(unlist(dados[, colsAutoAvDisc]), na.rm = TRUE),
        mean(unlist(dados[, colsAcaoDocente]), na.rm = TRUE),
        mean(unlist(dados[, colsInfra]),       na.rm = TRUE)
      )
    )
  }
)

pr <- pr_get(
  pr, "/discente/dimensoes/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    cont_disc  <- lapply(dados[, colsAutoAvDisc], table)
    cont_doc   <- lapply(dados[, colsAcaoDocente], table)
    cont_infra <- lapply(dados[, colsInfra],       table)
    data.frame(
      dimensao = rep(c("Autoavaliação Discente","Ação Docente","Instalações Físicas"), each = length(alternativas)),
      conceito = rep(conceitos, times = 3),
      valor = c(
        calculoPercent(alternativas, cont_disc),
        calculoPercent(alternativas, cont_doc),
        calculoPercent(alternativas, cont_infra)
      )
    )
  }
)

pr <- pr_get(
  pr, "/discente/dimensoes/boxplot",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    long_disc <- valoresUnicos(dados, mediap111:mediap117) %>%
      pivot_longer(cols = -ID, names_to = "item", values_to = "media") %>%
      mutate(dimensao = "Autoavaliação Discente")
    long_doc <- valoresUnicos(dados, mediap211:mediap234) %>%
      pivot_longer(cols = -ID, names_to = "item", values_to = "media") %>%
      mutate(dimensao = "Ação Docente")
    long_infra <- valoresUnicos(dados, mediap311:mediap314) %>%
      pivot_longer(cols = -ID, names_to = "item", values_to = "media") %>%
      mutate(dimensao = "Instalações Físicas")

    df_completo <- bind_rows(long_disc, long_doc, long_infra)

    stats_por_dim <- df_completo %>%
      group_by(dimensao) %>%
      summarise(stats = list(boxplot.stats(na.omit(media))), .groups = "drop")

    boxplot_data <- stats_por_dim %>%
      transmute(x = dimensao, y = lapply(stats, function(s) s$stats))

    all_outliers <- stats_por_dim %>%
      filter(sapply(stats, function(s) length(s$out) > 0)) %>%
      transmute(x = dimensao, outliers = lapply(stats, function(s) s$out)) %>%
      unnest(outliers)

    MAX_OUT <- 200
    sampled_out <- all_outliers %>%
      group_by(x) %>%
      group_modify(~ if (nrow(.x) > MAX_OUT) slice_sample(.x, n = MAX_OUT) else .x) %>%
      ungroup() %>% rename(y = outliers)

    list(boxplot_data = boxplot_data, outliers_data = sampled_out)
  }
)

# =========================================================================
# === SUBDIMENSÕES DA AÇÃO DOCENTE (DISCENTE) — PROPORÇÕES
# =========================================================================
pr <- pr_get(
  pr, "/discente/acaodocente/subdimensoes/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    cols_atp <- intersect(colsAtProfissional, names(dados))
    cols_ges <- intersect(colsGestaoDidatica, names(dados))
    cols_pro <- intersect(colsProcAvaliativo, names(dados))

    cont_atp <- if (length(cols_atp)) lapply(dados[, cols_atp, drop = FALSE], table) else list()
    cont_ges <- if (length(cols_ges)) lapply(dados[, cols_ges, drop = FALSE], table) else list()
    cont_pro <- if (length(cols_pro)) lapply(dados[, cols_pro, drop = FALSE], table) else list()

    df <- data.frame(
      subdimensao = rep(c("Atitude Profissional", "Gestão Didática", "Processo Avaliativo"), each = length(alternativas)),
      conceito = rep(conceitos, times = 3),
      valor = c(
        calculoPercent(alternativas, cont_atp),
        calculoPercent(alternativas, cont_ges),
        calculoPercent(alternativas, cont_pro)
      )
    )

    df$valor[is.nan(df$valor)] <- 0
    df
  }
)

# -------------------------------
# ATIVIDADES (DISCENTE)
# -------------------------------
pr <- pr_get(
  pr, "/discente/atividades/percentual",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    if (nrow(dados) == 0) return(data.frame(atividade = character(), percentual = numeric()))
    intervalo <- dados %>% select(all_of(colsAtividadesDisc)) %>% mutate(across(everything(), as.character))
    intervalo[is.na(intervalo)] <- "0"; intervalo[intervalo == ""] <- "0"
    if ("4.1.1.P" %in% names(intervalo)) {
      intervalo$"4.1.1.P"[ intervalo$"4.1.1.P" != "0" & intervalo$"4.1.1.P" != "1" ] <- "1"
    }
    intervalo <- intervalo %>% mutate(across(everything(), as.numeric))
    contagem <- colSums(intervalo == 1, na.rm = TRUE)
    percentuais <- (contagem / nrow(dados)) * 100
    data.frame(atividade = LETTERS[seq_along(percentuais)], percentual = percentuais)
  }
)

# ====== Detalhes por item (Discente) ======
pr <- pr_get(
  pr, "/discente/autoavaliacao/itens/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    itens <- dados[, colsAutoAvDisc, drop = FALSE]
    dados_longos <- itens %>%
      pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      filter(!is.na(valor)) %>%
      count(item, valor) %>%
      group_by(item) %>%
      mutate(total_item = sum(n), percentual = (n/total_item)*100) %>%
      ungroup()
    dados_longos %>%
      complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      mutate(item = .label_itens_auto(item), conceito = conceitos[as.numeric(valor)]) %>%
      select(item, conceito, valor = percentual)
  }
)

pr <- pr_get(
  pr, "/discente/autoavaliacao/itens/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    itens <- dados[, colsAutoAvDisc, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))
    data.frame(item = .label_itens_auto(names(medias)), media = as.numeric(medias), stringsAsFactors = FALSE)
  }
)

pr <- pr_get(
  pr, "/discente/autoavaliacao/itens/boxplot",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    itens <- valoresUnicos(dados, mediap111:mediap117)
    box_df_list <- list(); out_df_list <- list()
    for (nm in names(itens)) {
      if (nm == "ID") next
      vec <- itens[[nm]]; vec <- vec[!is.na(vec)]
      if (!length(vec)) next
      bs <- boxplot.stats(vec)
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = .label_itens_media(nm), y = I(list(bs$stats)))
      if (length(bs$out)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = .label_itens_media(nm), y = as.numeric(bs$out))
    }
    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    list(boxplot_data = boxplot_data, outliers_data = outliers_data)
  }
)

# -------------------------------
# ATITUDE PROFISSIONAL (DISCENTE) — Itens: PROPORÇÕES + MÉDIAS (já existia)
# -------------------------------
pr <- pr_get(
  pr, "/discente/atitudeprofissional/itens/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    cols <- intersect(colsAtProfissional, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    dados_longos <- itens %>%
      pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      filter(!is.na(valor)) %>%
      count(item, valor) %>%
      group_by(item) %>%
      mutate(total_item = sum(n), percentual = (n/total_item)*100) %>%
      ungroup()

    dados_longos %>%
      complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      mutate(
        item = .label_itens_auto(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      select(item, conceito, valor = percentual)
  }
)

pr <- pr_get(
  pr, "/discente/atitudeprofissional/itens/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    itens <- dados[, colsAtProfissional, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))
    data.frame(item = .label_itens_auto(names(medias)), media = as.numeric(medias), stringsAsFactors = FALSE)
  }
)

# ==========================================================
# ---------------------------- DOCENTES (Agregados)
# ==========================================================
pr <- pr_get(
  pr, "/docente/dimensoes/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    data.frame(
      dimensao = c("Avaliação da Turma","Autoavaliação da Ação Docente","Instalações Físicas"),
      media = c(
        mean(unlist(dados[, colsAvTurmaDoc]),     na.rm = TRUE),
        mean(unlist(dados[, colsAcaoDocenteDoc]), na.rm = TRUE),
        mean(unlist(dados[, colsInfraDoc]),       na.rm = TRUE)
      )
    )
  }
)

pr <- pr_get(
  pr, "/docente/dimensoes/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    cont_turma <- lapply(dados[, colsAvTurmaDoc],     table)
    cont_acao  <- lapply(dados[, colsAcaoDocenteDoc], table)
    cont_infra <- lapply(dados[, colsInfraDoc],       table)
    data.frame(
      dimensao = rep(c("Avaliação da Turma","Autoavaliação da Ação Docente","Instalações Físicas"), each = length(alternativas)),
      conceito = rep(conceitos, times = 3),
      valor = c(
        calculoPercent(alternativas, cont_turma),
        calculoPercent(alternativas, cont_acao),
        calculoPercent(alternativas, cont_infra)
      )
    )
  }
)

# -------------------------------
# ATIVIDADES (DOCENTE)
# -------------------------------
pr <- pr_get(
  pr, "/docente/atividades/percentual",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    if (!nrow(dados)) return(data.frame(atividade = character(), percentual = numeric()))
    intervalo <- dados %>% select(all_of(colsAtividadesDoc)) %>% mutate(across(everything(), as.character))
    intervalo[is.na(intervalo)] <- "0"; intervalo[intervalo == ""] <- "0"
    if ("4.1.1.P" %in% names(intervalo)) {
      intervalo$"4.1.1.P"[ intervalo$"4.1.1.P" != "0" & intervalo$"4.1.1.P" != "1" ] <- "1"
    }
    intervalo <- intervalo %>% mutate(across(everything(), as.numeric))
    cont <- colSums(intervalo == 1, na.rm = TRUE)
    data.frame(atividade = LETTERS[seq_along(cont)], percentual = (cont / nrow(dados))*100)
  }
)

# ==========================================================
# >>>>>>>>>>>> ENDPOINTS DOCENTE (Subdimensões) — ALINHADOS À BASE DISCENTE <<<<<<
# (mantidos para compatibilidade do dashboard atual)
# ==========================================================
pr <- pr_get(
  pr, "/docente/autoavaliacao/subdimensoes/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    cols_atp <- intersect(colsAtProfissional, names(dados))
    cols_ges <- intersect(colsGestaoDidatica, names(dados))
    cols_pro <- intersect(colsProcAvaliativo, names(dados))

    cont_atp <- if (length(cols_atp)) lapply(dados[, cols_atp, drop = FALSE], table) else list()
    cont_ges <- if (length(cols_ges)) lapply(dados[, cols_ges, drop = FALSE], table) else list()
    cont_pro <- if (length(cols_pro)) lapply(dados[, cols_pro, drop = FALSE], table) else list()

    df <- data.frame(
      subdimensao = rep(c("Atitude Profissional", "Gestão Didática", "Processo Avaliativo"), each = length(alternativas)),
      conceito    = rep(conceitos, times = 3),
      valor       = c(
        calculoPercent(alternativas, cont_atp),
        calculoPercent(alternativas, cont_ges),
        calculoPercent(alternativas, cont_pro)
      )
    )
    df$valor[is.nan(df$valor)] <- 0
    df
  }
)

pr <- pr_get(
  pr, "/docente/autoavaliacao/subdimensoes/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    atp <- intersect(colsAtProfissional, names(dados))
    ges <- intersect(colsGestaoDidatica, names(dados))
    pro <- intersect(colsProcAvaliativo, names(dados))

    bloco_media <- function(cols, rotulo) {
      if (!length(cols)) return(NULL)
      b <- dados[, cols, drop = FALSE]
      b[] <- lapply(b, function(v) suppressWarnings(as.numeric(v)))
      tibble(subdimensao = rotulo, media = mean(unlist(b), na.rm = TRUE))
    }

    res <- list(
      bloco_media(atp, "Atitude Profissional"),
      bloco_media(ges, "Gestão Didática"),
      bloco_media(pro, "Processo Avaliativo")
    )
    res <- Filter(Negate(is.null), res)
    if (!length(res)) return(data.frame(subdimensao = character(), media = numeric()))
    bind_rows(res)
  }
)

pr <- pr_get(
  pr, "/docente/autoavaliacao/subdimensoes/boxplot",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    long_21 <- valoresUnicos(dados, mediap211:mediap214) %>%
      pivot_longer(cols = -ID, names_to = "item", values_to = "media") %>%
      mutate(subdim = "Atitude Profissional")

    long_22 <- valoresUnicos(dados, mediap221:mediap228) %>%
      pivot_longer(cols = -ID, names_to = "item", values_to = "media") %>%
      mutate(subdim = "Gestão Didática")

    long_23 <- valoresUnicos(dados, mediap231:mediap234) %>%
      pivot_longer(cols = -ID, names_to = "item", values_to = "media") %>%
      mutate(subdim = "Processo Avaliativo")

    df <- bind_rows(long_21, long_22, long_23)

    stats_por_sd <- df %>%
      group_by(subdim) %>%
      summarise(stats = list(boxplot.stats(na.omit(media))), .groups = "drop")

    boxplot_data <- stats_por_sd %>%
      transmute(x = subdim, y = lapply(stats, function(s) s$stats))

    outliers <- stats_por_sd %>%
      filter(sapply(stats, function(s) length(s$out) > 0)) %>%
      transmute(x = subdim, outliers = lapply(stats, function(s) s$out)) %>%
      unnest(outliers) %>%
      rename(y = outliers)

    list(
      boxplot_data  = boxplot_data,
      outliers_data = outliers
    )
  }
)

# ==========================================================
# >>>>>>>>>>>> BASE DOCENTE — ITENS E SUBDIMENSÕES (usando base DOCENTE)
# ==========================================================
# Avaliação da Turma (DOCENTE) — Itens: médias e proporções
pr <- pr_get(
  pr, "/docente/avaliacaoturma/itens/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    itens <- dados[, colsAvTurmaDoc, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))
    data.frame(item = .label_itens_auto(names(medias)), media = as.numeric(medias), stringsAsFactors = FALSE)
  }
)

pr <- pr_get(
  pr, "/docente/avaliacaoturma/itens/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    itens <- dados[, colsAvTurmaDoc, drop = FALSE]
    dados_longos <- itens %>%
      pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      filter(!is.na(valor)) %>%
      count(item, valor) %>%
      group_by(item) %>%
      mutate(total_item = sum(n), percentual = (n/total_item)*100) %>%
      ungroup()
    dados_longos %>%
      complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      mutate(item = .label_itens_auto(item), conceito = conceitos[as.numeric(valor)]) %>%
      select(item, conceito, valor = percentual)
  }
)

# Autoavaliação da Ação Docente (DOCENTE) — Subdimensões: médias e proporções
pr <- pr_get(
  pr, "/docente_base/autoavaliacao/subdimensoes/medias",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    res <- lapply(names(subdim_map_doc), function(sd) {
      cols <- intersect(subdim_map_doc[[sd]], names(dados))
      if (!length(cols)) return(NULL)
      bloco <- dados[, cols, drop = FALSE]
      bloco[] <- lapply(bloco, function(v) suppressWarnings(as.numeric(v)))
      tibble(subdimensao = sd, media = mean(unlist(bloco), na.rm = TRUE))
    })
    res <- Filter(Negate(is.null), res)
    if (!length(res)) return(data.frame(subdimensao = character(), media = numeric()))
    bind_rows(res)
  }
)

pr <- pr_get(
  pr, "/docente_base/autoavaliacao/subdimensoes/proporcoes",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    out_list <- list()
    for (sd in names(subdim_map_doc)) {
      cols <- intersect(subdim_map_doc[[sd]], names(dados))
      if (!length(cols)) next
      dl <- dados[, cols, drop = FALSE] %>%
        pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
        filter(!is.na(valor))
      if (!nrow(dl)) next
      cont <- dl %>% count(valor) %>% mutate(total = sum(n), percentual = (n/total)*100)
      cont_comp <- tibble(valor = alternativas) %>%
        left_join(cont, by = "valor") %>%
        mutate(
          n = ifelse(is.na(n), 0, n),
          total = ifelse(is.na(total), 0, total),
          percentual = ifelse(is.na(percentual), 0, percentual),
          conceito = conceitos[as.numeric(valor)],
          subdimensao = sd
        ) %>%
        select(subdimensao, conceito, valor = percentual)
      out_list[[length(out_list)+1]] <- cont_comp
    }
    if (!length(out_list)) return(data.frame(subdimensao = character(), conceito = character(), valor = numeric()))
    bind_rows(out_list)
  }
)

# -------------------------------
# ATITUDE PROFISSIONAL (DOCENTE) — Itens: MÉDIAS, PROPORÇÕES, BOXPLOT
# -------------------------------
pr <- pr_get(
  pr, "/docente/atitudeprofissional/itens/medias",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))

    cols <- intersect(subdim_map_doc[["Atitude Profissional"]], names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), media = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))

    data.frame(
      item  = .label_itens_any(names(medias)),
      media = as.numeric(medias),
      stringsAsFactors = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/docente/atitudeprofissional/itens/proporcoes",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))

    cols <- intersect(subdim_map_doc[["Atitude Profissional"]], names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    dados_longos <- itens %>%
      pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      filter(!is.na(valor)) %>%
      count(item, valor) %>%
      group_by(item) %>%
      mutate(total_item = sum(n), percentual = (n/total_item)*100) %>%
      ungroup()

    dados_longos %>%
      complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      mutate(
        item = .label_itens_any(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      select(item, conceito, valor = percentual)
  }
)

# -------------------------------
# ATITUDE PROFISSIONAL (DOCENTE) — BOXPLOT por *média de turma/docente* por item
# -------------------------------
# -----------------------------------------------
# DOCENTE — ATITUDE PROFISSIONAL: BOXPLOT por item
# Distribuição das MÉDIAS por turma/docente (2.1.1 .. 2.1.4)
# -----------------------------------------------
pr <- pr_get(
  pr, "/discente/atitudeprofissional/itens/boxplot",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc
    
    # --- ALTERAÇÃO AQUI: Use as colunas de Atitude Profissional (2.1.1 a 2.1.4) ---
    itens <- valoresUnicos(dados, mediap211:mediap214) 
    # -------------------------------------------------------------------------

    box_df_list <- list(); out_df_list <- list()
    for (nm in names(itens)) {
      if (nm == "ID") next
      vec <- itens[[nm]]; vec <- vec[!is.na(vec)]
      if (!length(vec)) next
      
      bs <- boxplot.stats(vec)
      
      # Use .label_itens_media para formatar "mediap211" -> "2.1.1"
      lbl <- .label_itens_media(nm) 
      
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(bs$stats)))
      
      if (length(bs$out)) {
         # limita para não estourar payload
        outs <- if (length(bs$out) > 1500) sample(bs$out, 1500) else bs$out
        out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
      }
    }
    
    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    
    list(boxplot_data = boxplot_data, outliers_data = outliers_data)
  }
)
# -----------------------------------------------
pr <- pr_get(
  pr, "/docente/atitudeprofissional/itens/boxplot",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    if (!nrow(dados)) {
      return(list(
        boxplot_data  = data.frame(x = character(), y = I(list())),
        outliers_data = data.frame(x = character(), y = numeric())
      ))
    }

    names(dados) <- trimws(as.character(names(dados)))

    # 1) Quais colunas são os itens de Atitude Profissional (docente)?
    cols_map <- subdim_map_doc[["Atitude Profissional"]]
    cols_sd  <- intersect(cols_map, names(dados))
    # fallback por regex (se o mapeamento não pegou)
    if (!length(cols_sd)) {
      cols_sd <- grep("^D21[1-4]$", names(dados), value = TRUE)
    }
    if (!length(cols_sd)) {
      return(list(
        boxplot_data  = data.frame(x = character(), y = I(list())),
        outliers_data = data.frame(x = character(), y = numeric())
      ))
    }

    # 2) Chave de agrupamento (turma/docente)
    group_candidates <- c("ID_TURMA","COD_TURMA","TURMA","COD_DISCIPLINA","DISCIPLINA",
                          "ID_DOCENTE","DOCENTE","PROFESSOR","MATRICULA_DOCENTE",
                          "ID","ID_AVALIACAO")
    key <- group_candidates[group_candidates %in% names(dados)][1]
    if (is.na(key)) key <- NULL

    # 3) Transformar para numérico
    wide <- if (!is.null(key)) dados[, c(key, cols_sd), drop = FALSE] else dados[, cols_sd, drop = FALSE]
    wide[cols_sd] <- lapply(wide[cols_sd], function(v) suppressWarnings(as.numeric(v)))

    # 4) Médias por grupo (turma/docente) e por item
    long_medias <- if (!is.null(key)) {
      wide |>
        tidyr::pivot_longer(cols = tidyselect::all_of(cols_sd), names_to = "item_raw", values_to = "nota") |>
        dplyr::filter(!is.na(nota)) |>
        dplyr::group_by(.data[[key]], item_raw) |>
        dplyr::summarise(media = mean(nota, na.rm = TRUE), .groups = "drop")
    } else {
      wide |>
        tidyr::pivot_longer(cols = tidyselect::everything(), names_to = "item_raw", values_to = "media") |>
        dplyr::filter(!is.na(media))
    }

    # 5) Rótulos bonitos e ordem natural 2.1.1, 2.1.2, 2.1.3, 2.1.4
    long_medias$item <- .label_itens_any(long_medias$item_raw)
    order_key <- order(as.numeric(gsub("\\.", "", unique(long_medias$item))))
    item_order <- unique(long_medias$item)[order_key]

    # 6) Boxplot por item (sobre o vetor de MÉDIAS)
    box_df_list <- list(); out_df_list <- list()
    for (lbl in item_order) {
      vec <- long_medias$media[long_medias$item == lbl]
      vec <- vec[is.finite(vec)]
      if (!length(vec)) next

      bs <- boxplot.stats(vec)     # 5-number summary + outliers
      box_df_list[[length(box_df_list)+1]] <- data.frame(
        x = lbl,
        y = I(list(bs$stats))
      )
      if (length(bs$out)) {
        # limita para não estourar payload
        outs <- if (length(bs$out) > 1500) sample(bs$out, 1500) else bs$out
        out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
      }
    }

    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())

    list(boxplot_data = boxplot_data, outliers_data = outliers_data)
  }
)



# ================================
# GESTÃO DIDÁTICA (DISCENTE) — ITENS
# ================================
# médias por item
pr <- pr_get(
  pr, "/discente/gestaodidatica/itens/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    # usa as colunas de gestão didática da base discente
    cols <- intersect(colsGestaoDidatica, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), media = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))

    # rotula P221 -> 2.2.1 etc
    data.frame(
      item  = .label_itens_any(names(medias)),
      media = as.numeric(medias),
      stringsAsFactors = FALSE
    )
  }
)

# proporções por item
pr <- pr_get(
  pr, "/discente/gestaodidatica/itens/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    cols <- intersect(colsGestaoDidatica, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]

    dados_longos <- itens %>%
      tidyr::pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      dplyr::filter(!is.na(valor)) %>%
      dplyr::count(item, valor) %>%
      dplyr::group_by(item) %>%
      dplyr::mutate(total_item = sum(n), percentual = (n / total_item) * 100) %>%
      dplyr::ungroup()

    dados_longos %>%
      tidyr::complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      dplyr::mutate(
        item    = .label_itens_any(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      dplyr::select(item, conceito, valor = percentual)
  }
)

# ================================
# GESTÃO DIDÁTICA (DOCENTE) — ITENS
# ================================
# médias por item
pr <- pr_get(
  pr, "/docente/gestaodidatica/itens/medias",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))

    # pega as colunas mapeadas para "Gestão Didática" no docente
    cols <- intersect(subdim_map_doc[["Gestão Didática"]], names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), media = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))

    data.frame(
      item  = .label_itens_any(names(medias)),
      media = as.numeric(medias),
      stringsAsFactors = FALSE
    )
  }
)

# proporções por item
pr <- pr_get(
  pr, "/docente/gestaodidatica/itens/proporcoes",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))

    cols <- intersect(subdim_map_doc[["Gestão Didática"]], names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]

    dados_longos <- itens %>%
      tidyr::pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      dplyr::filter(!is.na(valor)) %>%
      dplyr::count(item, valor) %>%
      dplyr::group_by(item) %>%
      dplyr::mutate(total_item = sum(n), percentual = (n / total_item) * 100) %>%
      dplyr::ungroup()

    dados_longos %>%
      tidyr::complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      dplyr::mutate(
        item    = .label_itens_any(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      dplyr::select(item, conceito, valor = percentual)
  }
)

# boxplot docente (distribuição das MÉDIAS por item)
pr <- pr_get(
  pr, "/docente/gestaodidatica/itens/boxplot",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    if (!nrow(dados)) {
      return(list(
        boxplot_data  = data.frame(x = character(), y = I(list())),
        outliers_data = data.frame(x = character(), y = numeric())
      ))
    }

    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Gestão Didática"]], names(dados))
    if (!length(cols)) {
      return(list(
        boxplot_data  = data.frame(x = character(), y = I(list())),
        outliers_data = data.frame(x = character(), y = numeric())
      ))
    }

    # chave de agrupamento (igual do outro boxplot de docente)
    group_candidates <- c("ID_TURMA","COD_TURMA","TURMA","COD_DISCIPLINA","DISCIPLINA",
                          "ID_DOCENTE","DOCENTE","PROFESSOR","MATRICULA_DOCENTE",
                          "ID","ID_AVALIACAO")
    key <- group_candidates[group_candidates %in% names(dados)][1]
    if (is.na(key)) key <- NULL

    wide <- if (!is.null(key)) dados[, c(key, cols), drop = FALSE] else dados[, cols, drop = FALSE]
    wide[cols] <- lapply(wide[cols], function(v) suppressWarnings(as.numeric(v)))

    long_medias <- if (!is.null(key)) {
      wide |>
        tidyr::pivot_longer(cols = tidyselect::all_of(cols), names_to = "item_raw", values_to = "nota") |>
        dplyr::filter(!is.na(nota)) |>
        dplyr::group_by(.data[[key]], item_raw) |>
        dplyr::summarise(media = mean(nota, na.rm = TRUE), .groups = "drop")
    } else {
      wide |>
        tidyr::pivot_longer(cols = tidyselect::everything(), names_to = "item_raw", values_to = "media") |>
        dplyr::filter(!is.na(media))
    }

    long_medias$item <- .label_itens_any(long_medias$item_raw)
    item_order <- unique(long_medias$item)

    box_df_list <- list(); out_df_list <- list()
    for (lbl in item_order) {
      vec <- long_medias$media[long_medias$item == lbl]
      vec <- vec[is.finite(vec)]
      if (!length(vec)) next

      bs <- boxplot.stats(vec)
      box_df_list[[length(box_df_list)+1]] <- data.frame(
        x = lbl,
        y = I(list(bs$stats))
      )
      if (length(bs$out)) {
        outs <- if (length(bs$out) > 1500) sample(bs$out, 1500) else bs$out
        out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
      }
    }

    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())

    list(boxplot_data = boxplot_data, outliers_data = outliers_data)
  }
)

# ================================
# GESTÃO DIDÁTICA (DISCENTE) — BOXPLOT por item
# ================================
pr <- pr_get(
  pr, "/discente/gestaodidatica/itens/boxplot",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    # usa as médias por item da gestão didática do discente
    # (no teu dataset elas estão como mediap221:mediap228)
    itens <- valoresUnicos(dados, mediap221:mediap228)

    box_df_list <- list()
    out_df_list <- list()

    for (nm in names(itens)) {
      if (nm == "ID") next
      vec <- itens[[nm]]
      vec <- vec[!is.na(vec)]
      if (!length(vec)) next

      bs <- boxplot.stats(vec)

      # "mediap221" -> "2.2.1"
      lbl <- .label_itens_media(nm)

      box_df_list[[length(box_df_list) + 1]] <- data.frame(
        x = lbl,
        y = I(list(bs$stats))
      )

      if (length(bs$out)) {
        outs <- if (length(bs$out) > 1500) sample(bs$out, 1500) else bs$out
        out_df_list[[length(out_df_list) + 1]] <- data.frame(
          x = lbl,
          y = as.numeric(outs)
        )
      }
    }

    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())

    list(
      boxplot_data  = boxplot_data,
      outliers_data = outliers_data
    )
  }
)


# ================================
# PROCESSO AVALIATIVO (DISCENTE) — ITENS
# ================================
# médias por item
pr <- pr_get(
  pr, "/discente/processoavaliativo/itens/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    # colunas do processo avaliativo da base discente
    cols <- intersect(colsProcAvaliativo, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), media = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))

    data.frame(
      item  = .label_itens_any(names(medias)),
      media = as.numeric(medias),
      stringsAsFactors = FALSE
    )
  }
)

# proporções por item
pr <- pr_get(
  pr, "/discente/processoavaliativo/itens/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    cols <- intersect(colsProcAvaliativo, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]

    dados_longos <- itens %>%
      tidyr::pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      dplyr::filter(!is.na(valor)) %>%
      dplyr::count(item, valor) %>%
      dplyr::group_by(item) %>%
      dplyr::mutate(total_item = sum(n), percentual = (n / total_item) * 100) %>%
      dplyr::ungroup()

    dados_longos %>%
      tidyr::complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      dplyr::mutate(
        item    = .label_itens_any(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      dplyr::select(item, conceito, valor = percentual)
  }
)

# boxplot — distribuição das MÉDIAS das avaliações das turmas/docentes por item (DISCENTE)
pr <- pr_get(
  pr, "/discente/processoavaliativo/itens/boxplot",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    # supondo que as médias por item estejam como mediap231:mediap234 OU semelhante
    # se no teu main.R já tem o range certo, troca aqui:
    itens <- valoresUnicos(dados, mediap231:mediap234)

    box_df_list <- list()
    out_df_list <- list()

    for (nm in names(itens)) {
      if (nm == "ID") next
      vec <- itens[[nm]]
      vec <- vec[!is.na(vec)]
      if (!length(vec)) next

      bs  <- boxplot.stats(vec)
      lbl <- .label_itens_media(nm)

      box_df_list[[length(box_df_list)+1]] <- data.frame(
        x = lbl,
        y = I(list(bs$stats))
      )

      if (length(bs$out)) {
        outs <- if (length(bs$out) > 1500) sample(bs$out, 1500) else bs$out
        out_df_list[[length(out_df_list)+1]] <- data.frame(
          x = lbl,
          y = as.numeric(outs)
        )
      }
    }

    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())

    list(
      boxplot_data  = boxplot_data,
      outliers_data = outliers_data
    )
  }
)


# ================================
# PROCESSO AVALIATIVO (DOCENTE) — ITENS
# ================================
pr <- pr_get(
  pr, "/docente/processoavaliativo/itens/medias",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))

    cols <- intersect(subdim_map_doc[["Processo Avaliativo"]], names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), media = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))

    data.frame(
      item  = .label_itens_any(names(medias)),
      media = as.numeric(medias),
      stringsAsFactors = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/docente/processoavaliativo/itens/proporcoes",
  function(campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    campus <- normalize_param(campus); curso <- normalize_param(curso)

    dados <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))

    cols <- intersect(subdim_map_doc[["Processo Avaliativo"]], names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]

    dados_longos <- itens %>%
      tidyr::pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      dplyr::filter(!is.na(valor)) %>%
      dplyr::count(item, valor) %>%
      dplyr::group_by(item) %>%
      dplyr::mutate(total_item = sum(n), percentual = (n / total_item) * 100) %>%
      dplyr::ungroup()

    dados_longos %>%
      tidyr::complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      dplyr::mutate(
        item    = .label_itens_any(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      dplyr::select(item, conceito, valor = percentual)
  }
)

# ================================
# INSTALAÇÕES FÍSICAS (DISCENTE) — ITENS
# ================================
# 1) médias por item
pr <- pr_get(
  pr, "/discente/instalacoes/itens/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    cols <- intersect(colsInfra, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), media = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))

    data.frame(
      item  = .label_itens_any(names(medias)),
      media = as.numeric(medias),
      stringsAsFactors = FALSE
    )
  }
)

# 2) proporções por item
pr <- pr_get(
  pr, "/discente/instalacoes/itens/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    cols <- intersect(colsInfra, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]

    dados_longos <- itens %>%
      tidyr::pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      dplyr::filter(!is.na(valor)) %>%
      dplyr::count(item, valor) %>%
      dplyr::group_by(item) %>%
      dplyr::mutate(total_item = sum(n), percentual = (n / total_item) * 100) %>%
      dplyr::ungroup()

    dados_longos %>%
      tidyr::complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      dplyr::mutate(
        item    = .label_itens_any(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      dplyr::select(item, conceito, valor = percentual)
  }
)

# 3) boxplot — distribuição das MÉDIAS das avaliações das turmas/docentes por item (DISCENTE)
pr <- pr_get(
  pr, "/discente/instalacoes/itens/boxplot",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$disc

    # no seu /discente/dimensoes/boxplot você usa mediap311:mediap314
    # então vou seguir o mesmo range aqui:
    itens <- valoresUnicos(dados, mediap311:mediap314)

    box_df_list <- list()
    out_df_list <- list()

    for (nm in names(itens)) {
      if (nm == "ID") next
      vec <- itens[[nm]]
      vec <- vec[!is.na(vec)]
      if (!length(vec)) next

      bs  <- boxplot.stats(vec)
      lbl <- .label_itens_media(nm)   # "mediap311" -> "3.1.1"

      box_df_list[[length(box_df_list)+1]] <- data.frame(
        x = lbl,
        y = I(list(bs$stats))
      )

      if (length(bs$out)) {
        outs <- if (length(bs$out) > 1500) sample(bs$out, 1500) else bs$out
        out_df_list[[length(out_df_list)+1]] <- data.frame(
          x = lbl,
          y = as.numeric(outs)
        )
      }
    }

    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())

    list(
      boxplot_data  = boxplot_data,
      outliers_data = outliers_data
    )
  }
)

# ================================
# INSTALAÇÕES FÍSICAS (DOCENTE) — ITENS
# ================================
# 4) médias por item
pr <- pr_get(
  pr, "/docente/instalacoes/itens/medias",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc

    cols <- intersect(colsInfraDoc, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), media = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]
    itens[] <- lapply(itens, function(v) suppressWarnings(as.numeric(v)))
    medias <- sapply(itens, function(col) mean(col, na.rm = TRUE))

    data.frame(
      item  = .label_itens_any(names(medias)),
      media = as.numeric(medias),
      stringsAsFactors = FALSE
    )
  }
)

# 5) proporções por item
pr <- pr_get(
  pr, "/docente/instalacoes/itens/proporcoes",
  function(campus = "all", curso = "all") {
    campus <- normalize_param(campus); curso <- normalize_param(curso)
    dados  <- filter_data(base_discente_global, base_docente_global, campus, curso)$doc

    cols <- intersect(colsInfraDoc, names(dados))
    if (!length(cols)) {
      return(data.frame(item = character(), conceito = character(), valor = numeric()))
    }

    itens <- dados[, cols, drop = FALSE]

    dados_longos <- itens %>%
      tidyr::pivot_longer(everything(), names_to = "item", values_to = "valor") %>%
      dplyr::filter(!is.na(valor)) %>%
      dplyr::count(item, valor) %>%
      dplyr::group_by(item) %>%
      dplyr::mutate(total_item = sum(n), percentual = (n / total_item) * 100) %>%
      dplyr::ungroup()

    dados_longos %>%
      tidyr::complete(item, valor = alternativas, fill = list(n = 0, total_item = 0, percentual = 0)) %>%
      dplyr::mutate(
        item    = .label_itens_any(item),
        conceito = conceitos[as.numeric(valor)]
      ) %>%
      dplyr::select(item, conceito, valor = percentual)
  }
)


# --- 6. Iniciar o Servidor ---
pr$run(host = HOST, port = PORT)
# nolint end