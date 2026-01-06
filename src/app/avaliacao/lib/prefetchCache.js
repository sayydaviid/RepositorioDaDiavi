// src/app/avaliacao/minhaopiniao/lib/prefetchCache.js
const cache = new Map();

/**
 * Prefetch com cache em memória (por sessão).
 * Evita baixar/parsing do JSON repetidamente ao navegar entre páginas.
 */
export function prefetchJSON(url) {
  if (!url) return Promise.resolve(null);

  if (cache.has(url)) return cache.get(url);

  const p = fetch(url, { cache: 'force-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
      return r.json();
    })
    .catch((err) => {
      cache.delete(url);
      throw err;
    });

  cache.set(url, p);
  return p;
}

export function warmup(urls = []) {
  for (const u of urls) {
    prefetchJSON(u).catch(() => {});
  }
}
