// src/app/api/tecnico/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  try {
    // 1. Ajuste do caminho para o novo arquivo CSV dos TÉCNICOS
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'TECNICO.csv');

    // 2. Lê o arquivo como BUFFER
    // Mantemos a performance máxima: bytes direto do disco para a rede
    const fileBuffer = await fs.readFile(filePath);

    // 3. Retorna a resposta com cabeçalhos de texto CSV
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        // Define o MIME type como CSV e garante a codificação UTF-8 para acentos
        'Content-Type': 'text/csv; charset=utf-8',
        
        // Essencial: Envia o tamanho total para o LoadingOverlay do frontend
        'Content-Length': fileBuffer.length.toString(),
        
        // Controle de cache para evitar dados obsoletos durante a navegação
        'Cache-Control': 'no-store, max-age=0',
      },
    });

  } catch (error) {
    console.error("ERRO NA API '/api/tecnico':", error); 
    
    return new NextResponse(
      JSON.stringify({ 
        message: "Erro ao carregar o arquivo CSV dos técnicos.",
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}