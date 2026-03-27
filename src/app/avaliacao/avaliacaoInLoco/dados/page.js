'use client';

import { useState, useEffect } from 'react';
import AvaliacaoInLocoFilters from '../components/AvaliacaoInLocoFilters';
import LoadingOverlay from '../../avalia/components/LoadingOverlay';
import MediaDimensoesChart from '../components/MediaDimensoesChart';
import GraficoEvolucaoLineChart from '../components/GraficoEvolucaoLineChart';
import GraficoEvolucaoD123LineChart from '../components/GraficoEvolucaoD123LineChart';
import QuantidadeCursosAvaliadosChart from '../components/QuantidadeCursosAvaliadosChart';
import MediaDimensaoAnualChart from '../components/MediaDimensaoAnualChart';
import styles from '../../../../styles/dados.module.css';

function buildFiltersUrl(filters = {}) {
  const qs = new URLSearchParams();

  if (filters.ano) qs.set('ano', filters.ano);
  if (filters.undAcad) qs.set('undAcad', filters.undAcad);
  if (filters.modalidade) qs.set('modalidade', filters.modalidade);
  if (filters.campus) qs.set('campus', filters.campus);

  const query = qs.toString();
  return query
    ? `/api/avaliacao-in-loco/filters?${query}`
    : '/api/avaliacao-in-loco/filters';
}

function buildMediaDimensoesUrl(filters = {}) {
  const qs = new URLSearchParams();

  if (filters.ano) qs.set('ano', filters.ano);
  if (filters.undAcad) qs.set('undAcad', filters.undAcad);
  if (filters.modalidade) qs.set('modalidade', filters.modalidade);
  if (filters.campus) qs.set('campus', filters.campus);
  if (filters.curso) qs.set('curso', filters.curso);

  const query = qs.toString();
  return query
    ? `/api/avaliacao-in-loco/media-dimensoes?${query}`
    : '/api/avaliacao-in-loco/media-dimensoes';
}

export default function AvaliacaoInLocoDadosPage() {
  const [activeSubmenu, setActiveSubmenu] = useState('media');
  const tabs = [
    { key: 'media', label: 'Média' },
    { key: 'grafico-evolucao', label: 'Gráfico-Evolução' },
  ];

  const [selectedFilters, setSelectedFilters] = useState({
    ano: '',
    undAcad: '',
    modalidade: '',
    campus: '',
    curso: '',
  });

  const [filtersOptions, setFiltersOptions] = useState({
    anos: [],
    undAcad: [],
    modalidades: [],
    campi: [],
    cursos: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingCampus, setLoadingCampus] = useState(false);
  const [loadingCurso, setLoadingCurso] = useState(false);
  const [mediaDimensoes, setMediaDimensoes] = useState({
    labels: [],
    d1: [],
    d2: [],
    d3: [],
  });
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [graficoEvolucaoData, setGraficoEvolucaoData] = useState({
    anos: [],
    series: {},
    quantidadeCursosAvaliados: { anos: [], valores: [] },
    mediaDimensaoAnual: { anos: [], d1: [], d2: [], d3: [] },
  });
  const [loadingEvolucao, setLoadingEvolucao] = useState(false);

  const allFiltersSelected =
    Boolean(selectedFilters.ano) &&
    Boolean(selectedFilters.undAcad) &&
    Boolean(selectedFilters.modalidade) &&
    Boolean(selectedFilters.campus) &&
    Boolean(selectedFilters.curso);

  // Carregar opções iniciais
  useEffect(() => {
    const loadInitialFilters = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/avaliacao-in-loco/filters');
        const data = await response.json();
        setFiltersOptions({
          anos: data?.anos ?? [],
          undAcad: data?.undAcad ?? [],
          modalidades: data?.modalidades ?? [],
          campi: [],
          cursos: [],
        });
      } catch (error) {
        console.error('Erro ao carregar filtros iniciais:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialFilters();
  }, []);

  // Carregar UND-ACAD e Modalidade conforme ano/unidade
  useEffect(() => {
    if (!selectedFilters.ano) {
      return;
    }

    const loadUndAcadAndModalidades = async () => {
      try {
        const response = await fetch(
          buildFiltersUrl({
            ano: selectedFilters.ano,
            undAcad: selectedFilters.undAcad,
          })
        );
        const data = await response.json();

        setFiltersOptions((prev) => ({
          ...prev,
          undAcad: data?.undAcad ?? [],
          modalidades: data?.modalidades ?? [],
        }));
      } catch (error) {
        console.error('Erro ao carregar unidade/modalidade:', error);
      }
    };

    loadUndAcadAndModalidades();
  }, [selectedFilters.ano, selectedFilters.undAcad]);

  // Carregar campi ao selecionar ano, unidade acadêmica e modalidade
  useEffect(() => {
    if (!selectedFilters.ano || !selectedFilters.undAcad || !selectedFilters.modalidade) {
      setFiltersOptions((prev) => ({
        ...prev,
        campi: [],
        cursos: [],
      }));
      return;
    }

    const loadCampus = async () => {
      try {
        setLoadingCampus(true);
        const response = await fetch(
          buildFiltersUrl({
            ano: selectedFilters.ano,
            undAcad: selectedFilters.undAcad,
            modalidade: selectedFilters.modalidade,
          })
        );
        const data = await response.json();

        setFiltersOptions((prev) => ({
          ...prev,
          campi: data?.campi ?? [],
          cursos: [],
        }));
      } catch (error) {
        console.error('Erro ao carregar campi:', error);
      } finally {
        setLoadingCampus(false);
      }
    };

    loadCampus();
  }, [selectedFilters.ano, selectedFilters.undAcad, selectedFilters.modalidade]);

  // Carregar cursos ao selecionar campus
  useEffect(() => {
    if (!selectedFilters.ano || !selectedFilters.undAcad || !selectedFilters.modalidade || !selectedFilters.campus) {
      setFiltersOptions((prev) => ({
        ...prev,
        cursos: [],
      }));
      return;
    }

    const loadCursos = async () => {
      try {
        setLoadingCurso(true);
        const response = await fetch(
          buildFiltersUrl({
            ano: selectedFilters.ano,
            undAcad: selectedFilters.undAcad,
            modalidade: selectedFilters.modalidade,
            campus: selectedFilters.campus,
          })
        );
        const data = await response.json();

        setFiltersOptions((prev) => ({
          ...prev,
          cursos: data?.cursos ?? [],
        }));
      } catch (error) {
        console.error('Erro ao carregar cursos:', error);
      } finally {
        setLoadingCurso(false);
      }
    };

    loadCursos();
  }, [selectedFilters.ano, selectedFilters.undAcad, selectedFilters.modalidade, selectedFilters.campus]);

  useEffect(() => {
    if (!allFiltersSelected) {
      setMediaDimensoes({ labels: [], d1: [], d2: [], d3: [] });
      return;
    }

    const loadMediaDimensoes = async () => {
      try {
        setLoadingMedia(true);
        const response = await fetch(buildMediaDimensoesUrl(selectedFilters));
        const data = await response.json();
        setMediaDimensoes({
          labels: data?.unidades ?? [],
          d1: data?.mediasPorDimensao?.d1 ?? [],
          d2: data?.mediasPorDimensao?.d2 ?? [],
          d3: data?.mediasPorDimensao?.d3 ?? [],
        });
      } catch (error) {
        console.error('Erro ao carregar média das dimensões:', error);
        setMediaDimensoes({ labels: [], d1: [], d2: [], d3: [] });
      } finally {
        setLoadingMedia(false);
      }
    };

    loadMediaDimensoes();
  }, [selectedFilters, allFiltersSelected]);

  useEffect(() => {
    const loadGraficoEvolucao = async () => {
      try {
        setLoadingEvolucao(true);
        const response = await fetch('/api/avaliacao-in-loco/grafico-evolucao');
        const data = await response.json();
        setGraficoEvolucaoData({
          anos: data?.anos ?? [],
          series: data?.series ?? {},
          quantidadeCursosAvaliados: data?.quantidadeCursosAvaliados ?? {
            anos: [],
            valores: [],
          },
          mediaDimensaoAnual: data?.mediaDimensaoAnual ?? {
            anos: [],
            d1: [],
            d2: [],
            d3: [],
          },
        });
      } catch (error) {
        console.error('Erro ao carregar gráfico de evolução:', error);
        setGraficoEvolucaoData({
          anos: [],
          series: {},
          quantidadeCursosAvaliados: { anos: [], valores: [] },
          mediaDimensaoAnual: { anos: [], d1: [], d2: [], d3: [] },
        });
      } finally {
        setLoadingEvolucao(false);
      }
    };

    loadGraficoEvolucao();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    if (name === 'ano') {
      setSelectedFilters({
        ano: value,
        undAcad: '',
        modalidade: '',
        campus: '',
        curso: '',
      });
      setFiltersOptions((prev) => ({
        ...prev,
        campi: [],
        cursos: [],
      }));
      return;
    }

    if (name === 'undAcad') {
      setSelectedFilters((prev) => ({
        ...prev,
        undAcad: value,
        modalidade: '',
        campus: '',
        curso: '',
      }));
      setFiltersOptions((prev) => ({
        ...prev,
        campi: [],
        cursos: [],
      }));
      return;
    }

    if (name === 'modalidade') {
      setSelectedFilters((prev) => ({
        ...prev,
        modalidade: value,
        campus: '',
        curso: '',
      }));
      setFiltersOptions((prev) => ({
        ...prev,
        campi: [],
        cursos: [],
      }));
      return;
    }

    if (name === 'campus') {
      setSelectedFilters((prev) => ({
        ...prev,
        campus: value,
        curso: '',
      }));
      setFiltersOptions((prev) => ({
        ...prev,
        cursos: [],
      }));
      return;
    }

    setSelectedFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const labelOrTodos = (value, fallback) => (value && value !== 'todos' ? value : fallback);

  const mediaChartTitle = `Média das dimensões no ano ${labelOrTodos(
    selectedFilters.ano,
    'Todos os anos'
  )}, unidade acadêmica ${labelOrTodos(
    selectedFilters.undAcad,
    'Todas as unidades'
  )}, modalidade ${labelOrTodos(
    selectedFilters.modalidade,
    'Todas as modalidades'
  )}, campi ${labelOrTodos(selectedFilters.campus, 'Todos os campi')}, e curso ${labelOrTodos(
    selectedFilters.curso,
    'Todos os cursos'
  )}`;

  return (
    <>
      {isLoading && (
        <LoadingOverlay isFullScreen={true} message="Carregando dados..." />
      )}

      <div className={styles.mainContent}>
        {activeSubmenu === 'media' && (
          <AvaliacaoInLocoFilters
            filters={filtersOptions}
            selectedFilters={selectedFilters}
            onFilterChange={handleFilterChange}
            loadingCampus={loadingCampus}
            loadingCurso={loadingCurso}
          />
        )}

        <div className={styles.tabsContainer}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={activeSubmenu === tab.key ? styles.activeTab : styles.tab}
              onClick={() => setActiveSubmenu(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.chartDisplayArea}>
          {activeSubmenu === 'media' && (
            <section className="inloco-chart-section">
              {!allFiltersSelected ? (
                <p className="inloco-status-message">
                  Selecione todos os filtros para visualizar o gráfico de média das dimensões.
                </p>
              ) : loadingMedia ? (
                <p className="inloco-status-message">
                  Carregando média das dimensões...
                </p>
              ) : !mediaDimensoes.labels.length ? (
                <p className="inloco-status-message">
                  Não há dados para os filtros selecionados.
                </p>
              ) : (
                <MediaDimensoesChart data={mediaDimensoes} title={mediaChartTitle} />
              )}
            </section>
          )}

          {activeSubmenu === 'grafico-evolucao' && (
            <section className="inloco-chart-section">
              {loadingEvolucao ? (
                <p className="inloco-status-message">
                  Carregando gráfico de evolução...
                </p>
              ) : !graficoEvolucaoData.anos?.length ? (
                <p className="inloco-status-message">
                  Não há dados para o gráfico de evolução.
                </p>
              ) : (
                <>
                  <GraficoEvolucaoLineChart data={graficoEvolucaoData} />
                  <div className="inloco-chart-spacing">
                    <GraficoEvolucaoD123LineChart data={graficoEvolucaoData} />
                  </div>
                  <div className="inloco-chart-spacing">
                    <QuantidadeCursosAvaliadosChart
                      data={graficoEvolucaoData?.quantidadeCursosAvaliados}
                    />
                  </div>
                  <div className="inloco-chart-spacing">
                    <MediaDimensaoAnualChart
                      data={graficoEvolucaoData?.mediaDimensaoAnual}
                    />
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
