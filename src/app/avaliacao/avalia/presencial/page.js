import Header from '../components/Header';
import DiscenteDashboardClient from './DiscenteDashboardClient';

export const dynamic = 'force-dynamic';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'https://sayydaviid-avalia-backend.hf.space';

async function getInitialData() {
  try {
    // Agora buscamos só os filtros iniciais.
    // A API devolve os anos disponíveis mesmo sem informar "ano".
    const filtersRes = await fetch(`${API_BASE}/filters`, { cache: 'no-store' });

    if (!filtersRes.ok) {
      throw new Error(
        `Falha ao buscar filtros da API R: ${filtersRes.statusText} em ${filtersRes.url}`
      );
    }

    const filtersData = await filtersRes.json();

    return {
      summaryData: null,
      mediasData: null,
      proporcoesData: null,
      boxplotData: null,
      atividadesData: null,
      filtersOptions: {
        anos: filtersData?.anos ?? [],
        campus: filtersData?.campus ?? [],
        cursos: filtersData?.cursos ?? [],
      },
    };
  } catch (error) {
    console.error('Erro ao conectar com a API R:', error.message);

    return {
      summaryData: null,
      mediasData: null,
      proporcoesData: null,
      boxplotData: null,
      atividadesData: null,
      filtersOptions: {
        anos: [],
        campus: [],
        cursos: [],
      },
    };
  }
}

export default async function DiscentePage() {
  const {
    summaryData,
    mediasData,
    proporcoesData,
    boxplotData,
    atividadesData,
    filtersOptions,
  } = await getInitialData();

  if (!filtersOptions || !Array.isArray(filtersOptions.anos)) {
    return (
      <div>
        <Header title="Visão Geral da Avaliação Discente" date="17 de setembro de 2025" />
        <p style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
          Não foi possível carregar os filtros essenciais.
          <br />
          Tentativa de conexão com: <strong>{API_BASE}</strong>
        </p>
      </div>
    );
  }

  return (
    <div>
      <Header title="Visão Geral da Avaliação Discente" date="17 de setembro de 2025" />
      <DiscenteDashboardClient
        initialData={{
          summary: summaryData,
          medias: mediasData,
          proporcoes: proporcoesData,
          boxplot: boxplotData,
          atividades: atividadesData,
        }}
        filtersOptions={filtersOptions}
      />
    </div>
  );
}