# nolint start

# ===================================================================
# PONTO DE ENTRADA DA API (Versão Sincronizada: Boxplot = Tabela)
# ===================================================================

# --- 0. Opções globais ---
options(stringsAsFactors = FALSE)

# --- 1. Carga de Pacotes e Módulos ---
suppressPackageStartupMessages({
  library(plumber)
  library(dplyr)
  library(jsonlite)
  library(tidyr)
  library(tibble)
})

# Porta/host para PaaS
PORT <- as.integer(Sys.getenv("PORT", "7860"))
HOST <- Sys.getenv("HOST", "0.0.0.0")

# -------------------------------------------------------------------
# FIX DEFINITIVO DOS WARNINGS DO readxl
# -------------------------------------------------------------------
read_excel <- function(path, sheet = NULL, ..., col_types = "text", guess_max = 10000) {
  readxl::read_excel(path = path, sheet = sheet, col_types = col_types, guess_max = guess_max, ...)
}
read_xlsx <- function(path, sheet = NULL, ..., col_types = "text", guess_max = 10000) {
  readxl::read_xlsx(path = path, sheet = sheet, col_types = col_types, guess_max = guess_max, ...)
}
read_xls <- function(path, sheet = NULL, ..., col_types = "text", guess_max = 10000) {
  readxl::read_xls(path = path, sheet = sheet, col_types = col_types, guess_max = guess_max, ...)
}

# (opcional) garantir working dir para o source("R/main.R")
suppressWarnings({
  f <- tryCatch(normalizePath(sys.frames()[[1]]$ofile), error = function(e) NULL)
  if (!is.null(f)) setwd(dirname(f))
})

# Carrega configs e utilitários
source("R/main.R")

# Padroniza alternativas
alternativas <- suppressWarnings(as.integer(alternativas))

# ===================================================================
# HELPERS GERAIS & CORREÇÕES ESTATÍSTICAS
# ===================================================================

normalize_param <- function(x) {
  if (is.null(x)) return("all")
  x_chr <- trimws(as.character(x))
  if (tolower(x_chr) %in% c("", "all", "todos", "todas", "todo", "qualquer", "none", "null", "undefined")) {
    return("all")
  }
  x_chr
}

normalize_ano <- function(ano) {
  ano_chr <- trimws(as.character(ano %||% ""))
  if (!nzchar(ano_chr)) stop("Parâmetro 'ano' é obrigatório.")

  # aceita tanto 2024-4 quanto 2024.4
  ano_chr <- gsub("\\.", "-", ano_chr)

  if (!exists("bases_avalia") || is.null(bases_avalia[[ano_chr]])) {
    stop(sprintf("Ano/período inválido: %s", ano_chr))
  }
  ano_chr
}

`%||%` <- function(a, b) if (is.null(a)) b else a

.assert_subdim_map_doc <- function() {
  if (!exists("subdim_map_doc")) {
    stop("subdim_map_doc não encontrado. Defina em R/1_config.R.")
  }
  if (!is.list(subdim_map_doc) || is.null(names(subdim_map_doc))) {
    stop("subdim_map_doc deve ser uma lista nomeada.")
  }
}

.label_itens_auto  <- function(cols) gsub("^P(\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)
.label_itens_media <- function(cols) gsub("^mediap(\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)

.label_itens_any <- function(cols) {
  cols <- as.character(cols)
  cols <- gsub("^mediap(\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)
  cols <- gsub("^[PD](\\d)(\\d)(\\d)$", "\\1.\\2.\\3", cols)
  cols
}

.to_num <- function(x) {
  x <- trimws(as.character(x))
  x <- chartr(",", ".", x)
  suppressWarnings(as.numeric(x))
}

.to_num_mediap <- function(x) {
  v <- .to_num(x)
  v[!is.finite(v)] <- NA_real_
  v[v <= 0] <- NA_real_
  v
}

.get_vals_unique_logic <- function(df, cols) {
  cols <- intersect(cols, names(df))
  if (!length(cols)) return(numeric(0))

  vars <- cols
  if ("ID" %in% names(df)) {
    vars <- c("ID", vars)
  }

  tmp <- df[, vars, drop = FALSE]
  tmp <- unique(tmp)

  if ("ID" %in% names(tmp)) tmp$ID <- NULL

  vals <- unlist(tmp, use.names = FALSE)
  vals <- .to_num_mediap(vals)
  vals <- vals[is.finite(vals)]
  return(vals)
}

.get_vals_raw_table_logic <- function(df, cols) {
  cols <- intersect(cols, names(df))
  if (!length(cols)) return(numeric(0))

  vals <- unlist(df[, cols, drop = FALSE], use.names = FALSE)
  vals <- .to_num_mediap(vals)
  vals <- vals[is.finite(vals)]
  return(vals)
}

.calc_stats_summary_exact <- function(v) {
  if (!length(v)) return(rep(NA_real_, 6))
  s <- summary(v)
  res <- c(s["Min."], s["1st Qu."], s["Median"], s["Mean"], s["3rd Qu."], s["Max."])
  return(round(as.numeric(res), 2))
}

.sample_out <- function(x, max_out = 50) {
  x <- suppressWarnings(as.numeric(x))
  x <- x[is.finite(x)]
  if (!length(x)) return(numeric(0))
  if (length(x) > max_out) sample(x, max_out) else x
}

# monta outliers_data sem quebrar quando não houver outliers
.mk_out_df <- function(lbl, vals) {
  vals <- suppressWarnings(as.numeric(vals))
  vals <- round(vals, 2)
  vals <- vals[is.finite(vals)]

  if (!length(vals)) {
    return(data.frame(
      x = character(),
      y = numeric(),
      stringsAsFactors = FALSE
    ))
  }

  data.frame(
    x = rep(lbl, length(vals)),
    y = vals,
    stringsAsFactors = FALSE
  )
}

.normalize_box_stats <- function(stats_vec) {
  s <- as.numeric(stats_vec)
  if (length(s) < 5 || any(!is.finite(s))) return(s)
  wmin <- s[1]; q1 <- s[2]; med <- s[3]; q3 <- s[4]; wmax <- s[5]

  if (wmin > wmax) { tmp <- wmin; wmin <- wmax; wmax <- tmp }
  if (q1 > q3)     { tmp <- q1;  q1  <- q3;  q3  <- tmp }
  if (med < q1) med <- q1
  if (med > q3) med <- q3
  if (wmin > q1) wmin <- q1
  if (wmax < q3) wmax <- q3

  clamp <- function(v) max(1.0, min(4.0, v))
  wmin <- clamp(wmin); q1 <- clamp(q1); med <- clamp(med); q3 <- clamp(q3); wmax <- clamp(wmax)

  q1   <- max(q1, wmin)
  med  <- max(med, q1)
  q3   <- max(q3, med)
  wmax <- max(wmax, q3)

  c(wmin, q1, med, q3, wmax)
}

.calc_box_safe <- function(v) {
  v <- .to_num_mediap(v)
  v <- v[is.finite(v)]
  if (!length(v)) return(list(stats = rep(NA_real_, 5), out = numeric(0)))
  v <- round(v, 2)
  bs <- boxplot.stats(v)
  bs$stats <- .normalize_box_stats(bs$stats)
  bs
}

.calc_stats6_pdf <- function(v) {
  v <- .to_num_mediap(v)
  v <- v[is.finite(v)]
  if (!length(v)) return(rep(NA_real_, 6))
  v <- round(v, 2)
  five <- fivenum(v, na.rm = TRUE)
  c(five[1], five[2], five[3], mean(v, na.rm = TRUE), five[4], five[5])
}

.fast_int_1toN <- function(x, N) {
  x <- suppressWarnings(as.integer(x))
  x <- x[!is.na(x) & x >= 1L & x <= N]
  x
}

.tabulate_pct <- function(x_int, N) {
  if (!length(x_int)) return(rep(0, N))
  tab <- tabulate(x_int, nbins = N)
  tot <- sum(tab)
  if (!tot) return(rep(0, N))
  (tab / tot) * 100
}

.props_by_item_fast <- function(df, cols, label_map = NULL, label_fun = NULL) {
  cols <- intersect(as.character(cols), names(df))
  if (!length(cols)) {
    return(data.frame(item = character(), conceito = character(), valor = numeric(), stringsAsFactors = FALSE))
  }
  out <- vector("list", length(cols) * ALT_N)
  idx <- 1L
  for (cl in cols) {
    v <- .fast_int_1toN(df[[cl]], ALT_N)
    pct <- .tabulate_pct(v, ALT_N)
    item_lbl <- if (!is.null(label_map) && !is.null(label_map[[cl]])) {
      unname(label_map[[cl]])
    } else if (!is.null(label_fun)) {
      label_fun(cl)
    } else {
      cl
    }
    out[(idx):(idx + ALT_N - 1L)] <- lapply(seq_len(ALT_N), function(j) {
      list(item = item_lbl, conceito = CONCEITOS_ALT[j], valor = pct[j])
    })
    idx <- idx + ALT_N
  }
  as.data.frame(do.call(rbind, lapply(out, as.data.frame)), stringsAsFactors = FALSE)
}

.means_by_item_fast <- function(df, cols, label_map = NULL, label_fun = NULL) {
  cols <- intersect(as.character(cols), names(df))
  if (!length(cols)) return(data.frame(item = character(), media = numeric(), stringsAsFactors = FALSE))
  m <- df[, cols, drop = FALSE]
  m[] <- lapply(m, function(v) suppressWarnings(as.numeric(v)))
  medias <- colMeans(m, na.rm = TRUE)
  items <- if (!is.null(label_map)) unname(label_map[cols]) else if (!is.null(label_fun)) vapply(cols, label_fun, "") else cols
  data.frame(item = items, media = as.numeric(medias), stringsAsFactors = FALSE)
}

.mean_cells_fast <- function(df, cols) {
  cols <- intersect(as.character(cols), names(df))
  if (!length(cols)) return(NA_real_)
  m <- df[, cols, drop = FALSE]
  m[] <- lapply(m, function(v) suppressWarnings(as.numeric(v)))
  x <- as.matrix(m)
  s <- sum(x, na.rm = TRUE)
  n <- sum(!is.na(x))
  if (!n) NA_real_ else (s / n)
}

.row_means_fast <- function(df, cols) {
  cols <- intersect(as.character(cols), names(df))
  if (!length(cols) || !nrow(df)) return(numeric(0))
  m <- df[, cols, drop = FALSE]
  m[] <- lapply(m, function(v) suppressWarnings(as.numeric(v)))
  x <- as.matrix(m)
  cnt <- rowSums(!is.na(x))
  x[is.na(x)] <- 0
  rm <- rowSums(x) / pmax(1, cnt)
  rm[cnt == 0] <- NA_real_
  rm
}

.pick_turma_key <- function(df) {
  nms <- names(df)
  .find_col <- function(cands) {
    for (k in cands) if (k %in% nms) return(k)
    up <- toupper(nms)
    for (k in cands) {
      kk <- toupper(k)
      hit <- which(up == kk)
      if (length(hit)) return(nms[hit[1]])
    }
    NA_character_
  }
  disc_col <- .find_col(c("DISCIPLINA", "COD_DISCIPLINA", "NOME_DISCIPLINA", "COMPONENTE_CURRICULAR", "COMPONENTE", "TURMA"))
  doc_col <- .find_col(c("DOCENTE", "PROFESSOR", "NOME_DOCENTE", "DOCENTE_NOME"))
  n <- nrow(df)
  if (!n) return(character(0))
  if (!is.na(disc_col) && !is.na(doc_col)) {
    disc <- trimws(as.character(df[[disc_col]]))
    doc  <- trimws(as.character(df[[doc_col]]))
    disc_ok <- !is.na(disc) & disc != ""
    doc_ok  <- !is.na(doc)  & doc  != ""
    key <- rep("", n)
    key[disc_ok & doc_ok]  <- paste(disc[disc_ok & doc_ok], doc[disc_ok & doc_ok], sep = " | ")
    key[disc_ok & !doc_ok] <- disc[disc_ok & !doc_ok]
    key[!disc_ok & doc_ok] <- doc[!disc_ok & doc_ok]
    bad <- is.na(key) | trimws(key) == ""
    if (any(bad)) key[bad] <- as.character(which(bad))
    return(key)
  }
  if (!is.na(disc_col)) return(trimws(as.character(df[[disc_col]])))
  if (!is.na(doc_col))  return(trimws(as.character(df[[doc_col]])))
  as.character(seq_len(n))
}

.props_by_subdim_fast <- function(df, subdim_map) {
  .assert_subdim_map_doc()
  out_list <- list()
  df_names <- names(df)
  for (sd in names(subdim_map)) {
    cols <- intersect(subdim_map[[sd]], df_names)
    if (!length(cols)) next
    v <- unlist(df[, cols, drop = FALSE], use.names = FALSE)
    v <- .fast_int_1toN(v, ALT_N)
    pct <- .tabulate_pct(v, ALT_N)
    out_list[[length(out_list) + 1L]] <- data.frame(
      subdimensao = sd,
      conceito = CONCEITOS_ALT,
      valor = pct,
      stringsAsFactors = FALSE
    )
  }
  if (!length(out_list)) {
    return(data.frame(subdimensao = character(), conceito = character(), valor = numeric(), stringsAsFactors = FALSE))
  }
  do.call(rbind, out_list)
}

.means_by_subdim_fast <- function(df, subdim_map) {
  .assert_subdim_map_doc()
  out_list <- list()
  df_names <- names(df)
  for (sd in names(subdim_map)) {
    cols <- intersect(subdim_map[[sd]], df_names)
    if (!length(cols)) next
    out_list[[length(out_list) + 1L]] <- tibble(
      subdimensao = sd,
      media = .mean_cells_fast(df, cols)
    )
  }
  if (!length(out_list)) return(data.frame(subdimensao = character(), media = numeric()))
  bind_rows(out_list)
}

.coerce_numeric_cols <- function(df, cols) {
  cols <- intersect(as.character(cols), names(df))
  if (!length(cols)) return(df)
  for (cl in cols) {
    v <- df[[cl]]
    if (is.factor(v)) v <- as.character(v)
    v <- trimws(as.character(v))
    v <- chartr(",", ".", v)
    df[[cl]] <- suppressWarnings(as.numeric(v))
  }
  df
}

disc_numeric_cols <- unique(c(
  colsAutoAvDisc, colsAcaoDocente, colsInfra,
  colsAtProfissional, colsGestaoDidatica, colsProcAvaliativo,
  colsAtividadesDisc,
  paste0("mediap", 111:117), paste0("mediap", 211:234), paste0("mediap", 311:314)
))

doc_numeric_cols <- unique(c(
  colsAvTurmaDoc, colsAcaoDocenteDoc, colsInfraDoc,
  colsAtProfissionalDoc, colsGestaoDidaticaDoc, colsProcAvaliativoDoc,
  colsAtividadesDoc
))

.load_data_by_year <- function(ano) {
  ano <- normalize_ano(ano)

  if (exists("get_base_config")) {
    cfg <- get_base_config(ano)
  } else {
    cfg <- bases_avalia[[ano]]
  }

  disc <- read_excel(cfg$dataSource, sheet = cfg$sheetDiscente)
  doc  <- read_excel(cfg$dataSource, sheet = cfg$sheetDocente)

  names(disc) <- trimws(as.character(names(disc)))
  names(doc)  <- trimws(as.character(names(doc)))

  disc <- .coerce_numeric_cols(disc, disc_numeric_cols)
  doc  <- .coerce_numeric_cols(doc,  doc_numeric_cols)

  list(discente = disc, docente = doc)
}

.get_dataset_meta <- function(ano) {
  all_data <- .load_data_by_year(ano)
  base_discente <- all_data$discente
  base_docente  <- all_data$docente

  list(
    disc = base_discente,
    doc = base_docente,
    DISC_MEDIAP_AUTO  = intersect(paste0("mediap", 111:117), names(base_discente)),
    DISC_MEDIAP_ATP   = intersect(paste0("mediap", 211:214), names(base_discente)),
    DISC_MEDIAP_GES   = intersect(paste0("mediap", 221:228), names(base_discente)),
    DISC_MEDIAP_PRO   = intersect(paste0("mediap", 231:234), names(base_discente)),
    DISC_MEDIAP_INFRA = intersect(paste0("mediap", 311:314), names(base_discente)),
    DISC_MEDIAP_ACAO  = intersect(paste0("mediap", 211:234), names(base_discente)),
    DOC_MEDIAP_ATP    = intersect(paste0("mediap", 211:214), names(base_docente))
  )
}

LABEL_AUTO_ITEMS <- setNames(.label_itens_auto(colsAutoAvDisc), colsAutoAvDisc)
ALT_VEC <- as.integer(alternativas)
ALT_N <- length(ALT_VEC)
CONCEITOS_ALT <- conceitos[ALT_VEC]

.filter_cache <- new.env(parent = emptyenv())
.filter_cache_order <- character(0)
.filter_cache_max <- 64

.cache_key <- function(ano, campus, curso) paste0("a=", ano, "|c=", campus, "|k=", curso)

.cache_put <- function(key, value) {
  if (!exists(key, envir = .filter_cache, inherits = FALSE)) {
    .filter_cache_order <<- c(.filter_cache_order, key)
    if (length(.filter_cache_order) > .filter_cache_max) {
      drop <- .filter_cache_order[1]
      .filter_cache_order <<- .filter_cache_order[-1]
      rm(list = drop, envir = .filter_cache)
    }
  }
  assign(key, value, envir = .filter_cache)
}

cached_filter_data <- function(ano, campus, curso) {
  ano <- normalize_ano(ano)
  key <- .cache_key(ano, campus, curso)

  if (exists(key, envir = .filter_cache, inherits = FALSE)) {
    return(get(key, envir = .filter_cache, inherits = FALSE))
  }

  meta <- .get_dataset_meta(ano)
  ans <- filter_data(meta$disc, meta$doc, campus, curso)

  names(ans$disc) <- trimws(as.character(names(ans$disc)))
  names(ans$doc)  <- trimws(as.character(names(ans$doc)))

  ans$.__meta__ <- list(
    DISC_MEDIAP_AUTO  = meta$DISC_MEDIAP_AUTO,
    DISC_MEDIAP_ATP   = meta$DISC_MEDIAP_ATP,
    DISC_MEDIAP_GES   = meta$DISC_MEDIAP_GES,
    DISC_MEDIAP_PRO   = meta$DISC_MEDIAP_PRO,
    DISC_MEDIAP_INFRA = meta$DISC_MEDIAP_INFRA,
    DISC_MEDIAP_ACAO  = meta$DISC_MEDIAP_ACAO,
    DOC_MEDIAP_ATP    = meta$DOC_MEDIAP_ATP
  )

  .cache_put(key, ans)
  ans
}

                .find_col_ci <- function(df, candidates) {
  nms <- names(df)
  up  <- toupper(nms)

  for (cand in candidates) {
    hit <- which(up == toupper(cand))
    if (length(hit)) return(nms[hit[1]])
  }

  NA_character_
}

.empty_ranking_df <- function(nome_col) {
  out <- data.frame(
    ranking = integer(),
    discentes = integer(),
    docentes = integer(),
    total_participantes = integer(),
    stringsAsFactors = FALSE
  )
  out[[nome_col]] <- character()
  out[, c("ranking", nome_col, "discentes", "docentes", "total_participantes"), drop = FALSE]
}

.count_unique_by_group <- function(df, group_candidates, id_candidates, value_name) {
  group_col <- .find_col_ci(df, group_candidates)

  if (is.na(group_col) || !is.data.frame(df) || !nrow(df)) {
    out <- data.frame(grupo = character(), stringsAsFactors = FALSE)
    out[[value_name]] <- integer()
    return(out)
  }

  id_col <- .find_col_ci(df, id_candidates)

  grupo <- trimws(as.character(df[[group_col]]))
  pessoa <- if (!is.na(id_col)) {
    trimws(as.character(df[[id_col]]))
  } else {
    as.character(seq_len(nrow(df)))
  }

  tmp <- data.frame(
    grupo = grupo,
    pessoa = pessoa,
    stringsAsFactors = FALSE
  )

  tmp <- tmp[!is.na(tmp$grupo) & tmp$grupo != "", , drop = FALSE]
  if (!nrow(tmp)) {
    out <- data.frame(grupo = character(), stringsAsFactors = FALSE)
    out[[value_name]] <- integer()
    return(out)
  }

  bad_pessoa <- is.na(tmp$pessoa) | tmp$pessoa == ""
  if (any(bad_pessoa)) {
    tmp$pessoa[bad_pessoa] <- paste0("row_", which(bad_pessoa))
  }

  tmp <- unique(tmp)

  out <- tmp %>%
    dplyr::count(grupo, name = value_name)

  out <- out[order(-out[[value_name]], out$grupo), , drop = FALSE]
  out
}

.build_ranking_participantes <- function(disc, doc, group_candidates, output_name) {
  disc_counts <- .count_unique_by_group(
    disc,
    group_candidates = group_candidates,
    id_candidates = c("MATRICULA", "DISCENTE", "ALUNO", "ID"),
    value_name = "discentes"
  )

  doc_counts <- .count_unique_by_group(
    doc,
    group_candidates = group_candidates,
    id_candidates = c("SIAPE", "DOCENTE", "PROFESSOR", "ID"),
    value_name = "docentes"
  )

  rk <- dplyr::full_join(disc_counts, doc_counts, by = "grupo")

  if (!nrow(rk)) {
    return(.empty_ranking_df(output_name))
  }

  rk$discentes[is.na(rk$discentes)] <- 0L
  rk$docentes[is.na(rk$docentes)] <- 0L

  rk$discentes <- as.integer(rk$discentes)
  rk$docentes  <- as.integer(rk$docentes)
  rk$total_participantes <- rk$discentes + rk$docentes

  rk <- rk[order(-rk$total_participantes, -rk$discentes, -rk$docentes, rk$grupo), , drop = FALSE]
  rk$ranking <- seq_len(nrow(rk))

  out <- data.frame(
    ranking = rk$ranking,
    nome_tmp = rk$grupo,
    discentes = rk$discentes,
    docentes = rk$docentes,
    total_participantes = rk$total_participantes,
    stringsAsFactors = FALSE
  )

  names(out)[2] <- output_name
  out
}

cat(">> API pronta para iniciar com múltiplos anos.\n")

# ===================================================================
# DEFINIÇÃO DOS ENDPOINTS
# ===================================================================

pr <- pr()

pr <- pr_filter(pr, "cors", function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  if (req$REQUEST_METHOD == "OPTIONS") { res$status <- 200; return(list()) }
  plumber::forward()
})

pr <- pr_get(pr, "/", function() list(api_status = "Online", message = "Bem-vindo à API do Dashboard AVALIA."))
pr <- pr_get(pr, "/health", function() list(status = "OK", time = as.character(Sys.time())))

pr <- pr_get(pr, "/filters", function(ano = NULL, campus = "all", curso = "all") {
  anos_disponiveis <- if (exists("bases_avalia")) sort(names(bases_avalia)) else character()

  if (is.null(ano) || !nzchar(trimws(as.character(ano)))) {
    return(list(
      anos = anos_disponiveis,
      campus = character(),
      cursos = character()
    ))
  }

  ano <- normalize_ano(ano)
  campus_norm <- normalize_param(campus)
  curso_norm  <- normalize_param(curso)

  meta <- .get_dataset_meta(ano)

  # base completa do ano
  disc <- meta$disc
  doc  <- meta$doc

  # combina bases para extrair filtros relacionados
  base_filtros <- bind_rows(
    disc %>% dplyr::select(any_of(c("CAMPUS", "CURSO"))),
    doc  %>% dplyr::select(any_of(c("CAMPUS", "CURSO")))
  )

  if (!"CAMPUS" %in% names(base_filtros)) base_filtros$CAMPUS <- character()
  if (!"CURSO" %in% names(base_filtros)) base_filtros$CURSO <- character()

  base_filtros$CAMPUS <- trimws(as.character(base_filtros$CAMPUS))
  base_filtros$CURSO  <- trimws(as.character(base_filtros$CURSO))

  base_filtros <- base_filtros %>%
    dplyr::filter(!is.na(CAMPUS), CAMPUS != "", !is.na(CURSO), CURSO != "")

  # se escolheu campus, refina cursos
  if (campus_norm != "all") {
    base_filtros <- base_filtros %>%
      dplyr::filter(CAMPUS == campus_norm)
  }

  # se escolheu curso, refina campi
  if (curso_norm != "all") {
    base_filtros <- base_filtros %>%
      dplyr::filter(CURSO == curso_norm)
  }

  list(
    anos = anos_disponiveis,
    campus = sort(unique(base_filtros$CAMPUS)),
    cursos = sort(unique(base_filtros$CURSO))
  )
})

.rank_campus_global <- function(disc, disc_mediap_auto, disc_mediap_acao, disc_mediap_infra) {
  if (!is.data.frame(disc) || !nrow(disc) || !("CAMPUS" %in% names(disc))) {
    return(list(best = NULL, worst = NULL))
  }

  cols_all <- unique(c(disc_mediap_auto, disc_mediap_acao, disc_mediap_infra))
  cols_all <- intersect(cols_all, names(disc))
  if (!length(cols_all)) return(list(best = NULL, worst = NULL))

  rm <- .row_means_fast(disc, cols_all)

  tmp <- tibble::tibble(
    CAMPUS = trimws(as.character(disc$CAMPUS)),
    row_mean = rm
  ) %>%
    dplyr::filter(!is.na(CAMPUS), CAMPUS != "", is.finite(row_mean))

  if (!nrow(tmp)) return(list(best = NULL, worst = NULL))

  campus_means <- tmp %>%
    dplyr::group_by(CAMPUS) %>%
    dplyr::summarise(
      media_geral = mean(row_mean, na.rm = TRUE),
      n = dplyr::n(),
      .groups = "drop"
    )

  best  <- campus_means %>% dplyr::arrange(dplyr::desc(media_geral), CAMPUS) %>% dplyr::slice(1)
  worst <- campus_means %>% dplyr::arrange(media_geral, CAMPUS) %>% dplyr::slice(1)

  list(
    best = list(
      CAMPUS = best$CAMPUS[[1]],
      media_geral = round(best$media_geral[[1]], 2)
    ),
    worst = list(
      CAMPUS = worst$CAMPUS[[1]],
      media_geral = round(worst$media_geral[[1]], 2)
    )
  )
}

pr <- pr_get(
  pr, "/discente/geral/summary",
  function(ano, campus = "all", curso = "all") {
    ano         <- normalize_ano(ano)
    campus_norm <- normalize_param(campus)
    curso_norm  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus_norm, curso_norm)
    disc <- dados_filtrados$disc
    meta <- dados_filtrados$.__meta__

    n_unique_safe <- function(x) {
      x <- trimws(as.character(x))
      x <- x[!is.na(x) & x != ""]
      length(unique(x))
    }

    n_docente  <- if ("DOCENTE"    %in% names(disc)) n_unique_safe(disc$DOCENTE)    else NA_integer_
    n_discente <- if ("MATRICULA"  %in% names(disc)) n_unique_safe(disc$MATRICULA)  else NA_integer_
    n_turmas   <- if ("DISCIPLINA" %in% names(disc)) n_unique_safe(disc$DISCIPLINA) else NA_integer_

    rk <- .rank_campus_global(
      disc,
      meta$DISC_MEDIAP_AUTO,
      meta$DISC_MEDIAP_ACAO,
      meta$DISC_MEDIAP_INFRA
    )

    list(
      n_discente = n_discente, n_docente = n_docente, n_turmas = n_turmas,
      nDiscente = n_discente, nDocente = n_docente, nTurmas = n_turmas,
      total_respondentes = n_discente,
      campus_melhor_avaliado = rk$best,
      campus_pior_avaliado   = rk$worst,
      melhor_campus_global = rk$best,
      pior_campus_global   = rk$worst
    )
  }
)

pr <- pr_get(
  pr, "/discente/dimensoes/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    data.frame(
      dimensao = c("Autoavaliação Discente", "Ação Docente", "Instalações Físicas"),
      media = c(
        .mean_cells_fast(dados, colsAutoAvDisc),
        .mean_cells_fast(dados, colsAcaoDocente),
        .mean_cells_fast(dados, colsInfra)
      ),
      stringsAsFactors = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/discente/dimensoes/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    if (!nrow(dados)) {
      return(data.frame(dimensao = character(), conceito = character(), valor = numeric(), stringsAsFactors = FALSE))
    }
    cont_disc  <- lapply(dados[, intersect(colsAutoAvDisc, names(dados)), drop = FALSE], table)
    cont_doc   <- lapply(dados[, intersect(colsAcaoDocente, names(dados)), drop = FALSE], table)
    cont_infra <- lapply(dados[, intersect(colsInfra, names(dados)), drop = FALSE], table)
    data.frame(
      dimensao = rep(c("Autoavaliação Discente","Ação Docente","Instalações Físicas"), each = length(alternativas)),
      conceito = rep(conceitos, times = 3),
      valor = c(
        calculoPercent(alternativas, cont_disc),
        calculoPercent(alternativas, cont_doc),
        calculoPercent(alternativas, cont_infra)
      ),
      stringsAsFactors = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/discente/dimensoes/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados  <- dados_filtrados$disc
    meta   <- dados_filtrados$.__meta__

    if (!nrow(dados)) {
      return(list(
        tabela2       = data.frame(),
        tabela2_raw   = data.frame(),
        boxplot_data  = data.frame(x = character(), y = I(list())),
        outliers_data = data.frame(x = character(), y = numeric())
      ))
    }

    v_auto_u  <- .get_vals_unique_logic(dados, meta$DISC_MEDIAP_AUTO)
    v_acao_u  <- .get_vals_unique_logic(dados, meta$DISC_MEDIAP_ACAO)
    v_infra_u <- .get_vals_unique_logic(dados, meta$DISC_MEDIAP_INFRA)

    s6_auto_u  <- .calc_stats_summary_exact(v_auto_u)
    s6_acao_u  <- .calc_stats_summary_exact(v_acao_u)
    s6_infra_u <- .calc_stats_summary_exact(v_infra_u)

    tabela2 <- data.frame(
      Estatística = c("Min", "1º Q.", "Mediana", "Média", "3º Q.", "Max"),
      `Autoavaliação Discente` = s6_auto_u,
      `Ação Docente`           = s6_acao_u,
      `Instalações Físicas`    = s6_infra_u,
      check.names = FALSE
    )

    stA <- .calc_box_safe(v_auto_u)
    stD <- .calc_box_safe(v_acao_u)
    stI <- .calc_box_safe(v_infra_u)

    boxplot_data <- data.frame(
      x = c("Autoavaliação Discente", "Ação Docente", "Instalações Físicas"),
      y = I(list(round(stA$stats, 2), round(stD$stats, 2), round(stI$stats, 2)))
    )

    outliers_data <- rbind(
      .mk_out_df("Autoavaliação Discente", .sample_out(stA$out, 200)),
      .mk_out_df("Ação Docente", .sample_out(stD$out, 200)),
      .mk_out_df("Instalações Físicas", .sample_out(stI$out, 200))
    )

    v_auto_r  <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_AUTO)
    v_acao_r  <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_ACAO)
    v_infra_r <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_INFRA)

    s6_auto_r  <- .calc_stats_summary_exact(v_auto_r)
    s6_acao_r  <- .calc_stats_summary_exact(v_acao_r)
    s6_infra_r <- .calc_stats_summary_exact(v_infra_r)

    tabela2_raw <- data.frame(
      Estatística = c("Min", "1º Q.", "Mediana", "Média", "3º Q.", "Max"),
      `Autoavaliação Discente` = s6_auto_r,
      `Ação Docente`           = s6_acao_r,
      `Instalações Físicas`    = s6_infra_r,
      check.names = FALSE
    )

    list(
      tabela2       = tabela2,
      tabela2_raw   = tabela2_raw,
      boxplot_data  = boxplot_data,
      outliers_data = outliers_data
    )
  }
)

pr <- pr_get(
  pr, "/discente/acaodocente/subdimensoes/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$disc

    data.frame(
      subdimensao = c("Atitude Profissional", "Gestão Didática", "Processo Avaliativo"),
      media = c(
        .mean_cells_fast(dados, colsAtProfissional),
        .mean_cells_fast(dados, colsGestaoDidatica),
        .mean_cells_fast(dados, colsProcAvaliativo)
      ),
      stringsAsFactors = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/discente/acaodocente/subdimensoes/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados  <- dados_filtrados$disc
    meta   <- dados_filtrados$.__meta__

    if (!nrow(dados)) {
      return(list(
        tabela2       = data.frame(),
        boxplot_data  = data.frame(x = character(), y = I(list())),
        outliers_data = data.frame(x = character(), y = numeric())
      ))
    }

    v_atp <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_ATP)
    v_ges <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_GES)
    v_pro <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_PRO)

    s6_atp <- .calc_stats_summary_exact(v_atp)
    s6_ges <- .calc_stats_summary_exact(v_ges)
    s6_pro <- .calc_stats_summary_exact(v_pro)

    tabela2 <- data.frame(
      Estatística = c("Min", "1º Q.", "Mediana", "Média", "3º Q.", "Max"),
      `Atitude Profissional` = s6_atp,
      `Gestão Didática`      = s6_ges,
      `Processo Avaliativo`  = s6_pro,
      check.names = FALSE
    )

    st1 <- .calc_box_safe(v_atp)
    st2 <- .calc_box_safe(v_ges)
    st3 <- .calc_box_safe(v_pro)

    boxplot_data <- data.frame(
      x = c("Atitude Profissional", "Gestão Didática", "Processo Avaliativo"),
      y = I(list(round(st1$stats, 2), round(st2$stats, 2), round(st3$stats, 2)))
    )

    outliers_data <- rbind(
      .mk_out_df("Atitude Profissional", .sample_out(st1$out, 200)),
      .mk_out_df("Gestão Didática", .sample_out(st2$out, 200)),
      .mk_out_df("Processo Avaliativo", .sample_out(st3$out, 200))
    )

    list(
      tabela2       = tabela2,
      boxplot_data  = boxplot_data,
      outliers_data = outliers_data
    )
  }
)

pr <- pr_get(
  pr, "/discente/acaodocente/subdimensoes/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    if (!nrow(dados)) {
      return(data.frame(subdimensao = character(), conceito = character(), valor = numeric(), stringsAsFactors = FALSE))
    }
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
      ),
      stringsAsFactors = FALSE
    )
    df$valor[is.nan(df$valor)] <- 0
    df
  }
)

pr <- pr_get(
  pr, "/discente/atividades/percentual",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
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

pr <- pr_get(
  pr, "/discente/autoavaliacao/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    .props_by_item_fast(dados, colsAutoAvDisc, label_map = LABEL_AUTO_ITEMS)
  }
)

pr <- pr_get(
  pr, "/discente/autoavaliacao/itens/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    .means_by_item_fast(dados, colsAutoAvDisc, label_map = LABEL_AUTO_ITEMS)
  }
)

pr <- pr_get(
  pr, "/discente/autoavaliacao/itens/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados  <- dados_filtrados$disc
    meta   <- dados_filtrados$.__meta__
    cols <- intersect(meta$DISC_MEDIAP_AUTO, names(dados))
    box_df_list  <- list(); out_df_list  <- list(); tab_df_list  <- list()
    for (nm in cols) {
      v <- .to_num_mediap(dados[[nm]])
      v <- v[is.finite(v)]
      if (!length(v)) next
      s6 <- .calc_stats6_pdf(v)
      y5 <- .normalize_box_stats(c(s6[1], s6[2], s6[3], s6[5], s6[6]))
      lbl <- .label_itens_media(nm)
      tab_df_list[[length(tab_df_list)+1]] <- data.frame(
        item = lbl, Min = round(s6[1],2), Q1 = round(s6[2],2), Mediana = round(s6[3],2),
        Media = round(s6[4],2), Q3 = round(s6[5],2), Max = round(s6[6],2), stringsAsFactors = FALSE
      )
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(round(y5, 2))))
      st <- .calc_box_safe(v)
      outs <- round(.sample_out(st$out, max_out = 1500), 2)
      if (length(outs)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
    }
    boxplot_data  <- if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list()))
    outliers_data <- if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    tabela_items  <- if (length(tab_df_list)) do.call(rbind, tab_df_list) else data.frame()
    list(tabela_items = tabela_items, boxplot_data = boxplot_data, outliers_data = outliers_data)
  }
)

pr <- pr_get(
  pr, "/discente/atitudeprofissional/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    .props_by_item_fast(dados, colsAtProfissional, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/atitudeprofissional/itens/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    .means_by_item_fast(dados, colsAtProfissional, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/atitudeprofissional/itens/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados <- dados_filtrados$disc
    meta  <- dados_filtrados$.__meta__
    cols  <- intersect(meta$DISC_MEDIAP_ATP, names(dados))
    box_df_list <- list(); out_df_list <- list(); tab_df_list <- list()
    for (nm in cols) {
      v <- .to_num_mediap(dados[[nm]])
      v <- v[is.finite(v)]
      if (!length(v)) next
      s6 <- .calc_stats6_pdf(v)
      y5 <- .normalize_box_stats(c(s6[1], s6[2], s6[3], s6[5], s6[6]))
      lbl <- .label_itens_media(nm)
      tab_df_list[[length(tab_df_list)+1]] <- data.frame(
        item = lbl, Min = round(s6[1],2), Q1 = round(s6[2],2), Mediana = round(s6[3],2),
        Media = round(s6[4],2), Q3 = round(s6[5],2), Max = round(s6[6],2), stringsAsFactors = FALSE
      )
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(round(y5,2))))
      st <- .calc_box_safe(v)
      outs <- round(.sample_out(st$out, max_out = 1500), 2)
      if (length(outs)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
    }
    list(
      tabela_items  = if (length(tab_df_list)) do.call(rbind, tab_df_list) else data.frame(),
      boxplot_data  = if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list())),
      outliers_data = if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    )
  }
)

pr <- pr_get(
  pr, "/docente/dimensoes/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    data.frame(
      dimensao = c("Avaliação da Turma","Autoavaliação da Ação Docente","Instalações Físicas"),
      media = c(
        .mean_cells_fast(dados, colsAvTurmaDoc),
        .mean_cells_fast(dados, colsAcaoDocenteDoc),
        .mean_cells_fast(dados, colsInfraDoc)
      ),
      stringsAsFactors = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/docente/dimensoes/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    if (!nrow(dados)) {
      return(data.frame(dimensao = character(), conceito = character(), valor = numeric(), stringsAsFactors = FALSE))
    }
    cont_turma <- lapply(dados[, intersect(colsAvTurmaDoc, names(dados)), drop = FALSE], table)
    cont_acao  <- lapply(dados[, intersect(colsAcaoDocenteDoc, names(dados)), drop = FALSE], table)
    cont_infra <- lapply(dados[, intersect(colsInfraDoc, names(dados)), drop = FALSE], table)
    data.frame(
      dimensao = rep(c("Avaliação da Turma","Autoavaliação da Ação Docente","Instalações Físicas"), each = length(alternativas)),
      conceito = rep(conceitos, times = 3),
      valor = c(
        calculoPercent(alternativas, cont_turma),
        calculoPercent(alternativas, cont_acao),
        calculoPercent(alternativas, cont_infra)
      ),
      stringsAsFactors = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/docente/avaliacaoturma/dimensoes/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)

    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados <- dados_filtrados$disc
    meta  <- dados_filtrados$.__meta__

    if (!nrow(dados)) {
      return(list(
        tabela2       = data.frame(),
        tabela2_raw   = data.frame(),
        boxplot_data  = data.frame(x = character(), y = I(list())),
        outliers_data = data.frame(x = character(), y = numeric())
      ))
    }

    v_auto_u  <- .get_vals_unique_logic(dados, meta$DISC_MEDIAP_AUTO)
    v_acao_u  <- .get_vals_unique_logic(dados, meta$DISC_MEDIAP_ACAO)
    v_infra_u <- .get_vals_unique_logic(dados, meta$DISC_MEDIAP_INFRA)

    tabela2 <- data.frame(
      Estatística = c("Min", "1º Q.", "Mediana", "Média", "3º Q.", "Max"),
      `Autoavaliação Discente` = .calc_stats_summary_exact(v_auto_u),
      `Ação Docente`           = .calc_stats_summary_exact(v_acao_u),
      `Instalações Físicas`    = .calc_stats_summary_exact(v_infra_u),
      check.names = FALSE
    )

    stA <- .calc_box_safe(v_auto_u)
    stD <- .calc_box_safe(v_acao_u)
    stI <- .calc_box_safe(v_infra_u)

    boxplot_data <- data.frame(
      x = c("Autoavaliação Discente", "Ação Docente", "Instalações Físicas"),
      y = I(list(round(stA$stats, 2), round(stD$stats, 2), round(stI$stats, 2)))
    )

    outliers_data <- rbind(
      .mk_out_df("Autoavaliação Discente", .sample_out(stA$out, 200)),
      .mk_out_df("Ação Docente", .sample_out(stD$out, 200)),
      .mk_out_df("Instalações Físicas", .sample_out(stI$out, 200))
    )

    tabela2_raw <- data.frame(
      Estatística = c("Min", "1º Q.", "Mediana", "Média", "3º Q.", "Max"),
      `Autoavaliação Discente` = .calc_stats_summary_exact(.get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_AUTO)),
      `Ação Docente`           = .calc_stats_summary_exact(.get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_ACAO)),
      `Instalações Físicas`    = .calc_stats_summary_exact(.get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_INFRA)),
      check.names = FALSE
    )

    list(
      tabela2       = tabela2,
      tabela2_raw   = tabela2_raw,
      boxplot_data  = boxplot_data,
      outliers_data = outliers_data
    )
  }
)

pr <- pr_get(
  pr, "/docente/avaliacaoturma/dimensoes/descritivas",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados <- dados_filtrados$disc
    meta  <- dados_filtrados$.__meta__

    if (!nrow(dados)) {
      return(data.frame(
        Estatística = c("Min", "1º Q.", "Mediana", "Média", "3º Q.", "Max"),
        `Autoavaliação Discente` = NA_real_,
        `Ação Docente` = NA_real_,
        `Instalações Físicas` = NA_real_,
        check.names = FALSE
      ))
    }

    v_auto  <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_AUTO)
    v_acao  <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_ACAO)
    v_infra <- .get_vals_raw_table_logic(dados, meta$DISC_MEDIAP_INFRA)

    s6_auto  <- .calc_stats_summary_exact(v_auto)
    s6_acao  <- .calc_stats_summary_exact(v_acao)
    s6_infra <- .calc_stats_summary_exact(v_infra)

    data.frame(
      Estatística = c("Min", "1º Q.", "Mediana", "Média", "3º Q.", "Max"),
      `Autoavaliação Discente` = s6_auto,
      `Ação Docente`           = s6_acao,
      `Instalações Físicas`    = s6_infra,
      check.names = FALSE
    )
  }
)

pr <- pr_get(
  pr, "/docente/dimensoes/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$doc
    cols_turma <- intersect(colsAvTurmaDoc, names(dados))
    cols_acao  <- intersect(colsAcaoDocenteDoc, names(dados))
    cols_infra <- intersect(colsInfraDoc, names(dados))

    v_turma <- if (length(cols_turma)) unlist(dados[, cols_turma, drop = FALSE], use.names = FALSE) else numeric(0)
    v_acao  <- if (length(cols_acao))  unlist(dados[, cols_acao,  drop = FALSE], use.names = FALSE) else numeric(0)
    v_infra <- if (length(cols_infra)) unlist(dados[, cols_infra, drop = FALSE], use.names = FALSE) else numeric(0)

    s_turma <- .calc_box_safe(v_turma)
    s_acao  <- .calc_box_safe(v_acao)
    s_infra <- .calc_box_safe(v_infra)

    boxplot_data <- data.frame(
      x = c("Avaliação da Turma", "Autoavaliação da Ação Docente", "Instalações Físicas"),
      y = I(list(round(s_turma$stats, 2), round(s_acao$stats, 2), round(s_infra$stats, 2)))
    )
    outliers_data <- rbind(
      .mk_out_df("Avaliação da Turma", .sample_out(s_turma$out, 200)),
      .mk_out_df("Autoavaliação da Ação Docente", .sample_out(s_acao$out, 200)),
      .mk_out_df("Instalações Físicas", .sample_out(s_infra$out, 200))
    )
    list(boxplot_data  = boxplot_data, outliers_data = outliers_data)
  }
)

pr <- pr_get(
  pr, "/docente/atividades/percentual",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
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

pr <- pr_get(
  pr, "/docente/autoavaliacao/subdimensoes/proporcoes",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    if (!nrow(dados)) {
      return(data.frame(subdimensao = character(), conceito = character(), valor = numeric(), stringsAsFactors = FALSE))
    }
    targets <- c("Atitude Profissional", "Gestão Didática", "Processo Avaliativo")
    submap <- subdim_map_doc
    if (!is.null(names(submap))) {
      hit <- intersect(targets, names(submap))
      if (length(hit)) submap <- submap[hit]
    }
    .props_by_subdim_fast(dados, submap)
  }
)

pr <- pr_get(
  pr, "/docente/autoavaliacao/subdimensoes/medias",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    if (!nrow(dados)) return(data.frame(subdimensao = character(), media = numeric()))
    targets <- c("Atitude Profissional", "Gestão Didática", "Processo Avaliativo")
    submap <- subdim_map_doc
    if (!is.null(names(submap))) {
      hit <- intersect(targets, names(submap))
      if (length(hit)) submap <- submap[hit]
    }
    .means_by_subdim_fast(dados, submap)
  }
)

pr <- pr_get(
  pr, "/docente/autoavaliacao/subdimensoes/boxplot",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    if (!nrow(dados)) {
      return(list(boxplot_data = data.frame(x = character(), y = I(list())), outliers_data = data.frame(x = character(), y = numeric())))
    }
    targets <- c("Atitude Profissional", "Gestão Didática", "Processo Avaliativo")
    submap <- subdim_map_doc
    if (!is.null(names(submap))) {
      hit <- intersect(targets, names(submap))
      if (length(hit)) submap <- submap[hit]
    }
    box_df_list <- list(); out_df_list <- list()
    for (sd in names(submap)) {
      cols <- intersect(as.character(submap[[sd]]), names(dados))
      if (!length(cols)) next
      rm <- .row_means_fast(dados, cols)
      rm <- rm[is.finite(rm)]
      if (!length(rm)) next
      st <- .calc_box_safe(rm)
      box_df_list[[length(box_df_list) + 1L]] <- data.frame(x = sd, y = I(list(round(st$stats, 2))))
      outs <- round(.sample_out(st$out, max_out = 200), 2)
      if (length(outs)) out_df_list[[length(out_df_list) + 1L]] <- data.frame(x = sd, y = as.numeric(outs))
    }
    list(
      boxplot_data  = if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list())),
      outliers_data = if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    )
  }
)

pr <- pr_get(
  pr, "/docente/avaliacaoturma/itens/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    .means_by_item_fast(dados, colsAvTurmaDoc, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/avaliacaoturma/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    .props_by_item_fast(dados, colsAvTurmaDoc, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente_base/autoavaliacao/subdimensoes/medias",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    .means_by_subdim_fast(dados, subdim_map_doc)
  }
)

pr <- pr_get(
  pr, "/docente_base/autoavaliacao/subdimensoes/proporcoes",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    .props_by_subdim_fast(dados, subdim_map_doc)
  }
)

pr <- pr_get(
  pr, "/docente/atitudeprofissional/itens/medias",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Atitude Profissional"]], names(dados))
    if (!length(cols)) return(data.frame(item = character(), media = numeric()))
    .means_by_item_fast(dados, cols, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/atitudeprofissional/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Atitude Profissional"]], names(dados))
    if (!length(cols)) return(data.frame(item = character(), conceito = character(), valor = numeric()))
    .props_by_item_fast(dados, cols, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/atitudeprofissional/itens/boxplot",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    if (!nrow(dados)) {
      return(list(boxplot_data = data.frame(x = character(), y = I(list())), outliers_data = data.frame(x = character(), y = numeric())))
    }
    names(dados) <- trimws(as.character(names(dados)))
    cols_sd <- intersect(subdim_map_doc[["Atitude Profissional"]], names(dados))
    if (!length(cols_sd)) cols_sd <- grep("^D21[1-4]$", names(dados), value = TRUE)
    if (!length(cols_sd)) {
      return(list(boxplot_data = data.frame(x = character(), y = I(list())), outliers_data = data.frame(x = character(), y = numeric())))
    }
    box_df_list <- list(); out_df_list <- list()
    for (nm in cols_sd) {
      s <- .calc_box_safe(dados[[nm]])
      lbl <- .label_itens_any(nm)
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(round(s$stats, 2))))
      outs <- round(.sample_out(s$out, max_out = 1500), 2)
      if (length(outs)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
    }
    list(
      boxplot_data = if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list())),
      outliers_data = if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    )
  }
)

pr <- pr_get(
  pr, "/discente/gestaodidatica/itens/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    .means_by_item_fast(dados, colsGestaoDidatica, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/gestaodidatica/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$disc
    .props_by_item_fast(dados, colsGestaoDidatica, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/gestaodidatica/itens/medias",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Gestão Didática"]], names(dados))
    if (!length(cols)) return(data.frame(item = character(), media = numeric()))
    .means_by_item_fast(dados, cols, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/gestaodidatica/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Gestão Didática"]], names(dados))
    if (!length(cols)) return(data.frame(item = character(), conceito = character(), valor = numeric()))
    .props_by_item_fast(dados, cols, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/gestaodidatica/itens/boxplot",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    if (!nrow(dados)) {
      return(list(boxplot_data = data.frame(x = character(), y = I(list())), outliers_data = data.frame(x = character(), y = numeric())))
    }
    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Gestão Didática"]], names(dados))
    if (!length(cols)) {
      return(list(boxplot_data = data.frame(x = character(), y = I(list())), outliers_data = data.frame(x = character(), y = numeric())))
    }
    box_df_list <- list(); out_df_list <- list()
    for (nm in cols) {
      s <- .calc_box_safe(dados[[nm]])
      lbl <- .label_itens_any(nm)
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(round(s$stats, 2))))
      outs <- round(.sample_out(s$out, max_out = 1500), 2)
      if (length(outs)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
    }
    list(
      boxplot_data  = if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list())),
      outliers_data = if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    )
  }
)

pr <- pr_get(
  pr, "/discente/gestaodidatica/itens/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados <- dados_filtrados$disc
    meta  <- dados_filtrados$.__meta__
    cols <- intersect(meta$DISC_MEDIAP_GES, names(dados))
    box_df_list <- list(); out_df_list <- list(); tab_df_list <- list()
    for (nm in cols) {
      v <- .to_num_mediap(dados[[nm]])
      v <- v[is.finite(v)]
      if (!length(v)) next
      s6 <- .calc_stats6_pdf(v)
      y5 <- .normalize_box_stats(c(s6[1], s6[2], s6[3], s6[5], s6[6]))
      lbl <- .label_itens_media(nm)
      tab_df_list[[length(tab_df_list)+1]] <- data.frame(
        item = lbl, Min = round(s6[1],2), Q1 = round(s6[2],2), Mediana = round(s6[3],2),
        Media = round(s6[4],2), Q3 = round(s6[5],2), Max = round(s6[6],2), stringsAsFactors = FALSE
      )
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(round(y5,2))))
      st <- .calc_box_safe(v)
      outs <- round(.sample_out(st$out, max_out = 1500), 2)
      if (length(outs)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
    }
    list(
      tabela_items  = if (length(tab_df_list)) do.call(rbind, tab_df_list) else data.frame(),
      boxplot_data  = if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list())),
      outliers_data = if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    )
  }
)

pr <- pr_get(
  pr, "/discente/processoavaliativo/itens/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$disc
    .means_by_item_fast(dados, colsProcAvaliativo, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/processoavaliativo/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$disc
    .props_by_item_fast(dados, colsProcAvaliativo, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/processoavaliativo/itens/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados <- dados_filtrados$disc
    meta  <- dados_filtrados$.__meta__
    cols <- intersect(meta$DISC_MEDIAP_PRO, names(dados))
    box_df_list <- list(); out_df_list <- list(); tab_df_list <- list()
    for (nm in cols) {
      v <- .to_num_mediap(dados[[nm]])
      v <- v[is.finite(v)]
      if (!length(v)) next
      s6 <- .calc_stats6_pdf(v)
      y5 <- .normalize_box_stats(c(s6[1], s6[2], s6[3], s6[5], s6[6]))
      lbl <- .label_itens_media(nm)
      tab_df_list[[length(tab_df_list)+1]] <- data.frame(
        item = lbl, Min = round(s6[1],2), Q1 = round(s6[2],2), Mediana = round(s6[3],2),
        Media = round(s6[4],2), Q3 = round(s6[5],2), Max = round(s6[6],2), stringsAsFactors = FALSE
      )
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(round(y5,2))))
      st <- .calc_box_safe(v)
      outs <- round(.sample_out(st$out, max_out = 1500), 2)
      if (length(outs)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
    }
    list(
      tabela_items  = if (length(tab_df_list)) do.call(rbind, tab_df_list) else data.frame(),
      boxplot_data  = if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list())),
      outliers_data = if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    )
  }
)

pr <- pr_get(
  pr, "/docente/processoavaliativo/itens/medias",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Processo Avaliativo"]], names(dados))
    if (!length(cols)) return(data.frame(item = character(), media = numeric()))
    .means_by_item_fast(dados, cols, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/processoavaliativo/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    .assert_subdim_map_doc()
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados <- cached_filter_data(ano, campus, curso)$doc
    names(dados) <- trimws(as.character(names(dados)))
    cols <- intersect(subdim_map_doc[["Processo Avaliativo"]], names(dados))
    if (!length(cols)) return(data.frame(item = character(), conceito = character(), valor = numeric()))
    .props_by_item_fast(dados, cols, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/instalacoes/itens/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$disc
    .means_by_item_fast(dados, colsInfra, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/instalacoes/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$disc
    .props_by_item_fast(dados, colsInfra, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/discente/instalacoes/itens/boxplot",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados_filtrados <- cached_filter_data(ano, campus, curso)
    dados <- dados_filtrados$disc
    meta  <- dados_filtrados$.__meta__
    cols  <- intersect(meta$DISC_MEDIAP_INFRA, names(dados))
    box_df_list <- list(); out_df_list <- list(); tab_df_list <- list()
    for (nm in cols) {
      v <- .to_num_mediap(dados[[nm]])
      v <- v[is.finite(v)]
      if (!length(v)) next
      s6 <- .calc_stats6_pdf(v)
      y5 <- .normalize_box_stats(c(s6[1], s6[2], s6[3], s6[5], s6[6]))
      lbl <- .label_itens_media(nm)
      tab_df_list[[length(tab_df_list)+1]] <- data.frame(
        item = lbl, Min = round(s6[1],2), Q1 = round(s6[2],2), Mediana = round(s6[3],2),
        Media = round(s6[4],2), Q3 = round(s6[5],2), Max = round(s6[6],2), stringsAsFactors = FALSE
      )
      box_df_list[[length(box_df_list)+1]] <- data.frame(x = lbl, y = I(list(round(y5,2))))
      st <- .calc_box_safe(v)
      outs <- round(.sample_out(st$out, max_out = 1500), 2)
      if (length(outs)) out_df_list[[length(out_df_list)+1]] <- data.frame(x = lbl, y = as.numeric(outs))
    }
    list(
      tabela_items  = if (length(tab_df_list)) do.call(rbind, tab_df_list) else data.frame(),
      boxplot_data  = if (length(box_df_list)) do.call(rbind, box_df_list) else data.frame(x = character(), y = I(list())),
      outliers_data = if (length(out_df_list)) do.call(rbind, out_df_list) else data.frame(x = character(), y = numeric())
    )
  }
)

pr <- pr_get(
  pr, "/docente/instalacoes/itens/medias",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$doc
    .means_by_item_fast(dados, colsInfraDoc, label_fun = .label_itens_any)
  }
)

pr <- pr_get(
  pr, "/docente/instalacoes/itens/proporcoes",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)
    dados  <- cached_filter_data(ano, campus, curso)$doc
    .props_by_item_fast(dados, colsInfraDoc, label_fun = .label_itens_any)
  }
)

    pr <- pr_get(
  pr, "/participantes/ranking/cursos",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)

    dados <- cached_filter_data(ano, campus, curso)

    .build_ranking_participantes(
      disc = dados$disc,
      doc = dados$doc,
      group_candidates = c("CURSO"),
      output_name = "curso"
    )
  }
)

pr <- pr_get(
  pr, "/participantes/ranking/campi",
  function(ano, campus = "all", curso = "all") {
    ano    <- normalize_ano(ano)
    campus <- normalize_param(campus)
    curso  <- normalize_param(curso)

    dados <- cached_filter_data(ano, campus, curso)

    .build_ranking_participantes(
      disc = dados$disc,
      doc = dados$doc,
      group_candidates = c("CAMPUS"),
      output_name = "campus"
    )
  }
)

pr$run(host = HOST, port = PORT)

# nolint end