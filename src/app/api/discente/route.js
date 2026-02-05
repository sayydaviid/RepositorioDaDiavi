// src/app/api/discente/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  try {
    // 1. Ajuste do caminho para o arquivo .csv
    // Certifique-se que o arquivo DISCENTE.csv está na pasta src/app/banco/
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'DISCENTE.csv');

    // 2. Lê o arquivo como BUFFER (binário)
    // Mantemos essa estratégia pois é muito performática para arquivos grandes
    const fileBuffer = await fs.readFile(filePath);

    // 3. Retorna a resposta
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        // MUDANÇA IMPORTANTE: O tipo agora é text/csv
        // Adicionamos charset=utf-8 para garantir que os acentos não quebrem no navegador
        'Content-Type': 'text/csv; charset=utf-8',
        
        // Mantemos o Content-Length para sua barra de progresso no frontend funcionar
        'Content-Length': fileBuffer.length.toString(),
        
        // Opcional: Cachear no navegador por 1 hora (se os dados não mudam com frequência)
        // 'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });

  } catch (error) {
    console.error("Erro ao ler o arquivo CSV:", error);
    
    // Em caso de erro, retornamos um JSON avisando
    return new NextResponse(
      JSON.stringify({ message: "Erro ao carregar o arquivo CSV de dados." }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}