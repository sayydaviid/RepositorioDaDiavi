import { getAvaliacaoInLocoEvolucaoAnual } from '@/lib/avaliacaoInLocoData';

export async function GET() {
  try {
    const data = getAvaliacaoInLocoEvolucaoAnual();
    return Response.json(data);
  } catch (error) {
    console.error('Erro na API de gráfico de evolução:', error);
    return Response.json(
      { error: 'Erro ao processar gráfico de evolução' },
      { status: 500 }
    );
  }
}
