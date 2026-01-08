// src/app/api/discente/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'DISCENTE.json');

    // 1. Lê o arquivo como BUFFER (binário), não como string UTF-8
    // Isso é muito mais rápido e gasta menos memória
    const fileBuffer = await fs.readFile(filePath);

    // 2. Retorna uma NextResponse manual
    // EVITAMOS o JSON.parse() e o NextResponse.json()
    // Por que? Porque o arquivo já é um JSON. Não precisamos carregar na memória do servidor
    // como objeto para depois transformar em texto de novo. Enviamos o "puro" do disco.
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // 3. ESSENCIAL: Envia o tamanho total para a barra de progresso do frontend
        'Content-Length': fileBuffer.length.toString(),
        // Dica: Next.js em produção (Vercel/Node) aplicará Gzip/Brotli automaticamente 
        // sobre este buffer se o navegador suportar.
      },
    });

  } catch (error) {
    console.error("Erro ao ler o arquivo de dados:", error);
    return new NextResponse(
      JSON.stringify({ message: "Erro ao carregar os dados." }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}