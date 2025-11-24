import Header from '../components/Header';
import DiscenteDashboardClient from './DiscenteDashboardClient';

// Força o Next.js a não fazer cache estático dessa página (importante para dados dinâmicos)
export const dynamic = 'force-dynamic';

// URL Base: Tenta pegar do .env, senão usa o link direto do Hugging Face
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://sayydaviid-avalia-backend.hf.space';

async function getInitialData() {
  // Parâmetros padrão para a carga inicial
  const params = '?campus=todos&curso=todos';

  const urls = {
    summary:    `${API_BASE}/discente/geral/summary${params}`,
    medias:     `${API_BASE}/discente/dimensoes/medias${params}`,
    proporcoes: `${API_BASE}/discente/dimensoes/proporcoes${params}`,
    boxplot:    `${API_BASE}/discente/dimensoes/boxplot${params}`,
    atividades: `${API_BASE}/discente/atividades/percentual${params}`,
    filters:    `${API_BASE}/filters`,
  };

  try {
    const responses = await Promise.all(
      Object.values(urls).map(url => fetch(url, { cache: 'no-store' }))
    );

    for (const res of responses) {
      if (!res.ok) {
        throw new Error(`Falha ao buscar dados da API R: ${res.statusText} em ${res.url}`);
      }
    }

    const [summaryData, mediasData, proporcoesData, boxplotData, atividadesData, filtersOptions] =
      await Promise.all(responses.map(res => res.json()));

    return { summaryData, mediasData, proporcoesData, boxplotData, atividadesData, filtersOptions };
  } catch (error) {
    console.error('Erro ao conectar com a API R:', error.message);
    return { 
      summaryData: null,
      mediasData: null, 
      proporcoesData: null, 
      boxplotData: null, 
      atividadesData: null, 
      filtersOptions: null 
    };
  }
}

export default async function DiscentePage() {
  const { summaryData, mediasData, proporcoesData, boxplotData, atividadesData, filtersOptions } = await getInitialData();

  // Verifica se o básico carregou
  if (!mediasData || !filtersOptions) {
    return (
      <div>
        <Header title="Visão Geral da Avaliação Discente" date="17 de setembro de 2025" />
        <p style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
          Não foi possível carregar os dados essenciais. <br/>
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
          summary:    summaryData,    // Adicionado pois o Client espera isso
          medias:     mediasData,
          proporcoes: proporcoesData,
          boxplot:    boxplotData,
          atividades: atividadesData
        }}
        filtersOptions={filtersOptions}
      />
    </div>
  );
}