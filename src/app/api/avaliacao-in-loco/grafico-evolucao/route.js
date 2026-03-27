import { getAvaliacaoInLocoEvolucaoAnual } from '@/lib/avaliacaoInLocoData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = getAvaliacaoInLocoEvolucaoAnual({
      undAcad: searchParams.get('undAcad') ?? '',
      curso: searchParams.get('curso') ?? '',
    });
    return Response.json(data);
  } catch (error) {
    console.error('Erro na API de gráfico de evolução:', error);
    return Response.json(
      { error: 'Erro ao processar gráfico de evolução' },
      { status: 500 }
    );
  }
}
