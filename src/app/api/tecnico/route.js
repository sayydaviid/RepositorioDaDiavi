// src/app/api/docente/route.js
import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET() {
  try {
    // 1. Define o caminho seguro para o arquivo de dados dos DOCENTES
    const filePath = path.join(process.cwd(), 'src', 'app', 'banco', 'TECNICO.json');

    // 2. Lê o conteúdo do arquivo no servidor
    const fileContents = await fs.readFile(filePath, 'utf8');

    // 3. Converte o conteúdo em um objeto JSON
    const data = JSON.parse(fileContents);

    // 4. Envia os dados como resposta
    return NextResponse.json(data);

  } catch (error) {
    // Log de erro específico para esta API para facilitar a depuração
    console.error("ERRO NA API '/api/tecnico':", error); 
    
    return new NextResponse(
      JSON.stringify({ message: "Erro ao carregar os dados dos técnicos." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}