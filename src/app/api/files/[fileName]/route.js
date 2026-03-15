import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

const ALLOWED_FILES = new Set(['questionario_disc.pdf', 'questionario_doc.pdf']);

export async function GET(_request, { params }) {
  try {
    const resolvedParams = await params;
    const fileName = decodeURIComponent(resolvedParams?.fileName || '');

    if (!ALLOWED_FILES.has(fileName)) {
      return NextResponse.json({ error: 'Arquivo não permitido.' }, { status: 404 });
    }

    const filePath = path.join(process.cwd(), 'src', 'app', 'avaliacao', 'files', fileName);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  }
}
