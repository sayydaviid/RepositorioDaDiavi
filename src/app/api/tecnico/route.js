// src/app/api/tecnico/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  try {
    // 1. Caminho para o arquivo dos TÉCNICOS
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'TECNICO.json');

    // 2. Lê o arquivo como BUFFER (Binário)
    // Mais rápido que ler como string, pois não há processamento de encoding no servidor.
    const fileBuffer = await fs.readFile(filePath);

    // 3. Retorna o Buffer diretamente para o cliente
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // 4. ESSENCIAL: Permite que o frontend calcule o progresso de 0 a 100%
        'Content-Length': fileBuffer.length.toString(),
        // O Next.js tratará a compressão Gzip/Brotli automaticamente em produção.
      },
    });

  } catch (error) {
    console.error("ERRO NA API '/api/tecnico':", error); 
    
    return new NextResponse(
      JSON.stringify({ 
        message: "Erro ao carregar os dados dos técnicos.",
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}