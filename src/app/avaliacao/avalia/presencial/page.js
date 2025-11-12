import Header from '../components/Header';
import DiscenteDashboardClient from './DiscenteDashboardClient';
export const dynamic = 'force-dynamic';

// busca inicial (inclui BOXLOT agora)
async function getInitialData() {
  const urls = {
    medias:     'http://localhost:8000/discente/dimensoes/medias',
    proporcoes: 'http://localhost:8000/discente/dimensoes/proporcoes',
    boxplot:    'http://localhost:8000/discente/dimensoes/boxplot',
    atividades: 'http://localhost:8000/discente/atividades/percentual',
    filters:    'http://localhost:8000/filters',
  };

  try {
    const responses = await Promise.all(
      Object.values(urls).map(url => fetch(url, { cache: 'no-store' }))
    );

    for (const res of responses) {
      if (!res.ok) throw new Error(`Falha ao buscar dados da API R: ${res.statusText} em ${res.url}`);
    }

    const [mediasData, proporcoesData, boxplotData, atividadesData, filtersOptions] =
      await Promise.all(responses.map(res => res.json()));

    return { mediasData, proporcoesData, boxplotData, atividadesData, filtersOptions };
  } catch (error) {
    console.error('Erro ao conectar com a API R:', error.message);
    return { mediasData: null, proporcoesData: null, boxplotData: null, atividadesData: null, filtersOptions: null };
  }
}

export default async function DiscentePage() {
  const { mediasData, proporcoesData, boxplotData, atividadesData, filtersOptions } = await getInitialData();

  if (!mediasData || !proporcoesData || !boxplotData || !atividadesData || !filtersOptions) {
    return (
      <div>
        <Header title="Visão Geral da Avaliação Discente" date="17 de setembro de 2025" />
        <p style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
          Não foi possível carregar os dados essenciais. A API R está online e os endpoints estão corretos?
        </p>
      </div>
    );
  }

  return (
    <div>
      <Header title="Visão Geral da Avaliação Discente" date="17 de setembro de 2025" />
      <DiscenteDashboardClient
        initialData={{
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
