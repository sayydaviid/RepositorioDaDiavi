// src/app/api/discente/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  try {
    // 1. Define o caminho seguro para o seu arquivo JSON
    // process.cwd() aponta para a raiz do seu projeto
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'DISCENTE.json');

    // 2. Lê o conteúdo do arquivo no servidor
    const fileContents = await fs.readFile(filePath, 'utf8');

    // 3. Converte o conteúdo em um objeto JSON
    const data = JSON.parse(fileContents);

    // 4. Envia os dados como resposta para quem pediu (sua página)
    return NextResponse.json(data);

  } catch (error) {
    console.error("Erro ao ler o arquivo de dados:", error);
    // Em caso de erro, envia uma resposta com status 500 (Erro Interno do Servidor)
    return new NextResponse(
      JSON.stringify({ message: "Erro ao carregar os dados." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}