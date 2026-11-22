// notino.bg sits behind a Cloudflare "managed challenge" for automated clients.
// We do NOT try to bypass it. We make one polite request; if it is challenged we report
// "blocked" so the app can show a direct link instead. If notino ever serves the page,
// products are read from the page's JSON-LD.
import { fetchText, isChallenge, decode, guessGender, guessConcentration, fragranticaSearch } from '../lib.mjs';

const BASE = 'https://www.notino.bg';
export const NEW_URL = `${BASE}/novinki/`;

export async function scrape() {
  const r = await fetchText(NEW_URL);
  if (isChallenge(r)) {
    const err = new Error('notino: Cloudflare bot koruması (otomatik erişim engelli)');
    err.blocked = true;
    throw err;
  }
  if (r.status !== 200) throw new Error(`notino HTTP ${r.status}`);
  const items = [];
  for (const m of r.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const list = data?.itemListElement || [];
    for (const el of list) {
      const p = el.item || el;
      if (!p?.name || !p?.url) continue;
      const brand = p.brand?.name || p.brand || '';
      const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      items.push({
        id: `notino:${p.sku || p.url}`,
        shop: 'notino',
        brand,
        name: decode(p.name),
        url: p.url.startsWith('http') ? p.url : BASE + p.url,
        image: Array.isArray(p.image) ? p.image[0] : p.image || null,
        price: offer?.price ? parseFloat(offer.price) : null,
        currency: offer?.priceCurrency || 'EUR',
        gender: guessGender(p.name),
        concentration: guessConcentration(p.name),
        fragranticaSearch: fragranticaSearch(brand, p.name),
      });
    }
  }
  return items;
}

export async function pages() {
  const r = await fetchText(`${BASE}/`);
  return [{ url: `${BASE}/`, status: r.status, html: isChallenge(r) ? '' : r.text, blocked: isChallenge(r) }];
}
