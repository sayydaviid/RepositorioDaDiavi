import { NextResponse } from 'next/server';
import { put, head } from '@vercel/blob';

export const runtime = 'edge'; // menor latência, sem Node KV

// Normaliza strings para compor caminhos estáveis
function norm(s) {
  return (s || 'curso')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .toLowerCase();
}

// Caminho determinístico no Blob por (ano, curso)
function blobPath(ano, curso) {
  return `reports/ead/${norm(ano)}/${norm(curso)}/todos-os-polos.pdf`;
}

/**
 * GET /api/reports/ead/cache?ano=2025&curso=Licenciatura...
 * Retorna { url } se existir; { url: null } se não existir.
 * (200 sempre, para não poluir logs com 404.)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ano = searchParams.get('ano') || '';
    const curso = searchParams.get('curso') || '';

    if (!ano) {
      return NextResponse.json({ error: 'ano is required' }, { status: 400 });
    }

    const path = blobPath(ano, curso);
    const info = await head(path).catch(() => null);

    // Se não existir, devolve url:null (200)
    if (!info) {
      return NextResponse.json({ url: null }, { status: 200 });
    }

    // info.url é pública
    return NextResponse.json({ url: info.url }, { status: 200 });
  } catch (err) {
    console.error('Cache GET error:', err);
    return NextResponse.json({ error: 'cache lookup failed' }, { status: 500 });
  }
}

/**
 * POST /api/reports/ead/cache
 * multipart/form-data: { ano, curso, file }
 * Salva o PDF no Blob com chave estável (sem sufixo aleatório) e retorna { url }.
 */
export async function POST(req) {
  try {
    const ctype = req.headers.get('content-type') || '';
    if (!ctype.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'content-type must be multipart/form-data' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file');
    const ano = String(form.get('ano') || '');
    const curso = String(form.get('curso') || '');

    if (!file || !ano) {
      return NextResponse.json({ error: 'file and ano are required' }, { status: 400 });
    }

    const path = blobPath(ano, curso);

    const { url } = await put(path, file, {
      access: 'public',
      addRandomSuffix: false,              // sobrescreve determinístico
      contentType: 'application/pdf',
      cacheControlMaxAge: '31536000',      // cache CDN (não duplica headers)
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    console.error('Cache POST error:', err);
    return NextResponse.json({ error: 'upload/cache failed' }, { status: 500 });
  }
}
