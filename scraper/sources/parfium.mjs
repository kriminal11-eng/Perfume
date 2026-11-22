// parfium.bg is a Shopify store: /products.json is public and sorted by publish date (newest first).
import { fetchText, isChallenge, stripTags, guessGender, guessConcentration, fragranticaSearch } from '../lib.mjs';

const BASE = 'https://parfium.bg';
const MAX_PAGES = 8; // 250 per page

export async function scrape({ sinceDays = 45 } = {}) {
  const since = Date.now() - sinceDays * 864e5;
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetchText(`${BASE}/products.json?limit=250&page=${page}`);
    if (isChallenge(r) || r.status !== 200) throw new Error(`parfium HTTP ${r.status}`);
    const { products } = JSON.parse(r.text);
    if (!products.length) break;
    let older = 0;
    for (const p of products) {
      const published = Date.parse(p.published_at || p.created_at);
      if (published < since) { older++; continue; }
      if (!/парфюм|parfum|perfume/i.test(p.product_type || '')) continue;
      const prices = p.variants.map((v) => parseFloat(v.price)).filter((x) => !isNaN(x));
      const compare = p.variants.map((v) => parseFloat(v.compare_at_price)).filter((x) => !isNaN(x) && x > 0);
      const genderTag = (p.tags || []).find((t) => t.startsWith('Пол:'));
      const groupTag = (p.tags || []).find((t) => t.startsWith('Ароматна група:'));
      items.push({
        id: `parfium:${p.id}`,
        shop: 'parfium',
        brand: p.vendor,
        name: p.title,
        url: `${BASE}/products/${p.handle}`,
        image: p.images?.[0]?.src || null,
        price: prices.length ? Math.min(...prices) : null,
        oldPrice: compare.length ? Math.max(...compare) : null,
        currency: 'EUR',
        sizes: p.variants.map((v) => v.title).filter((t) => t && t !== 'Default Title'),
        available: p.variants.some((v) => v.available),
        type: p.product_type,
        gender: guessGender(`${genderTag || ''} ${p.product_type} ${p.title}`),
        concentration: guessConcentration(p.title),
        family: groupTag ? groupTag.split(':')[1].trim() : null,
        description: stripTags(p.body_html || '').slice(0, 400),
        publishedAt: new Date(published).toISOString(),
        fragranticaSearch: fragranticaSearch(p.vendor, p.title.replace(new RegExp(`^${escapeRe(p.vendor)}\\s*`, 'i'), '')),
      });
    }
    if (older === products.length) break; // whole page older than window
  }
  return items;
}

const escapeRe = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Homepage HTML (used for discount codes / announcement bar). */
export async function pages() {
  const out = [];
  for (const url of [`${BASE}/`]) {
    const r = await fetchText(url);
    out.push({ url, status: r.status, html: r.text });
  }
  return out;
}
