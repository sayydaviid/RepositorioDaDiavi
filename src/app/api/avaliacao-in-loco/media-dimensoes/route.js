import { getAvaliacaoInLocoMediaDimensoes } from '@/lib/avaliacaoInLocoData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const data = getAvaliacaoInLocoMediaDimensoes({
      ano: searchParams.get('ano') ?? '',
      undAcad: searchParams.get('undAcad') ?? '',
      modalidade: searchParams.get('modalidade') ?? '',
      campus: searchParams.get('campus') ?? '',
      curso: searchParams.get('curso') ?? '',
    });

    return Response.json(data);
  } catch (error) {
    console.error('Erro na API de médias das dimensões:', error);
    return Response.json(
      { error: 'Erro ao processar médias das dimensões' },
      { status: 500 }
    );
  }
}
