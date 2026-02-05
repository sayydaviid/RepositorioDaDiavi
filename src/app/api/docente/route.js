// src/app/api/docente/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  try {
    // 1. Caminho para o novo arquivo CSV dos DOCENTES
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'DOCENTE.csv');

    // 2. Lê o arquivo como BUFFER
    // Mais rápido, pois não decodifica o texto no servidor, apenas transmite os bytes
    const fileBuffer = await fs.readFile(filePath);

    // 3. Retorna a resposta com os headers apropriados para CSV
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        // Define o tipo como CSV com codificação UTF-8
        'Content-Type': 'text/csv; charset=utf-8',
        
        // Essencial para a barra de progresso no frontend (Loader2)
        'Content-Length': fileBuffer.length.toString(),
        
        // Previne problemas de cache durante o desenvolvimento
        'Cache-Control': 'no-store, max-age=0',
      },
    });

  } catch (error) {
    console.error("ERRO NA API '/api/docente':", error); 
    
    return new NextResponse(
      JSON.stringify({ message: "Erro ao carregar o arquivo CSV dos docentes." }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}