FROM rocker/r-ver:4.4.1

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev libssl-dev libxml2-dev \
    libfontconfig1-dev libfreetype6-dev libpng-dev libtiff5-dev libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

ENV CRAN=https://packagemanager.posit.co/cran/__linux__/jammy/latest
RUN R -e "options(repos='$CRAN'); install.packages(c( \
  'plumber','jsonlite','dplyr','tidyr','tidyselect','readr','stringr', \
  'readxl','openxlsx','reshape2','ggplot2' \
), Ncpus=4)"

WORKDIR /app
COPY . /app

ENV PORT=7860
EXPOSE 7860

CMD ["Rscript", "run.R"]
