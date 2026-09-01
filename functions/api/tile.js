export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const z = Number(url.searchParams.get('z'));
  const x = Number(url.searchParams.get('x'));
  const y = Number(url.searchParams.get('y'));
  if (![z,x,y].every(Number.isInteger) || z < 0 || z > 20 || x < 0 || y < 0) {
    return new Response('Invalid tile coordinates', { status: 400 });
  }

  const n = 2 ** z;
  if (x >= n || y >= n) return new Response('Tile out of range', { status: 400 });

  const cacheKey = new Request(`${url.origin}/api/tile?z=${z}&x=${x}&y=${y}`, { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const sources = [
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    `https://tile.openstreetmap.fr/hot/${z}/${x}/${y}.png`
  ];

  let lastStatus = 502;
  for (const src of sources) {
    try {
      const upstream = await fetch(src, {
        headers: {
          'User-Agent': 'JofamsSmartDrive/6.4 (+https://jofams-smartdrive.pages.dev)',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        cf: { cacheTtl: 86400, cacheEverything: true }
      });
      lastStatus = upstream.status;
      if (!upstream.ok) continue;
      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.delete('set-cookie');
      const response = new Response(upstream.body, { status: 200, headers });
      context.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (e) {
      console.warn('tile upstream failed', src, e);
    }
  }
  return new Response('Tile unavailable', { status: lastStatus || 502 });
}
