import Header from '../components/Header';
import DiscenteDashboardClient from './DiscenteDashboardClient';

export const dynamic = 'force-dynamic';

function buildCacheUrl(baseUrl, endpoint, filters = {}) {
  const qs = new URLSearchParams();
  qs.set('endpoint', endpoint);

  if (filters?.ano) qs.set('ano', String(filters.ano).trim());
  if (filters?.campus) qs.set('campus', String(filters.campus).trim());
  if (filters?.curso) qs.set('curso', String(filters.curso).trim());

  return `${baseUrl}/api/dashboard-cache?${qs.toString()}`;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

async function getInitialData() {
  try {
    const baseUrl = getBaseUrl();

    const filtersRes = await fetch(buildCacheUrl(baseUrl, '/filters'), {
      cache: 'no-store',
    });

    if (!filtersRes.ok) {
      throw new Error(
        `Falha ao buscar filtros do cache local: ${filtersRes.status} ${filtersRes.statusText}`
      );
    }

    const filtersData = await filtersRes.json();
    console.log('filtersData page:', filtersData);

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
    console.error('Erro ao carregar filtros iniciais:', error.message);

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

  return (
    <div>
      <Header
        title="Visão Geral do Avalia Presencial"
        date="17 de setembro de 2025"
      />
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