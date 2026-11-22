// parfimo.bg: server-rendered listing. Plain HTTP clients get a WAF 403, a normal browser
// is served fine, so we load the public "New product" perfume listing with Playwright.
import { decode, stripTags, parsePrice, guessGender, guessConcentration, fragranticaSearch } from '../lib.mjs';

const BASE = 'https://parfimo.bg';
const LIST = `${BASE}/parfyumi/?dynamic_filter[labels][8]=8`; // label 8 = "Нов продукт"
const MAX_PAGES = 4;
const PERFUME_RE = /парфюм|тоалетна вода|одеколон|eau de|extrait|parfum|cologne|\bedp\b|\bedt\b/i;

let browserPromise;
async function browser() {
  if (!browserPromise) {
    const { chromium } = await import('playwright');
    browserPromise = chromium.launch();
  }
  return browserPromise;
}
export async function close() {
  if (browserPromise) (await browserPromise).close();
}

export async function getHtml(url) {
  const b = await browser();
  const page = await b.newPage({ locale: 'bg-BG' });
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    return { status: res.status(), html: await page.content() };
  } finally {
    await page.close();
  }
}

export function parseList(html) {
  const items = [];
  const chunks = html.split('data-component="productlist-squareitem"').slice(1);
  for (const c of chunks) {
    const href = c.match(/href="(\/[^"]+_z(\d+)\/)"/);
    if (!href) continue;
    const brand = stripTags(c.match(/class="producer-name">([\s\S]*?)<\/span>/)?.[1] || '');
    const title = stripTags(c.match(/class="title h3">([\s\S]*?)<\/span>/)?.[1] || '');
    const perex = stripTags(c.match(/class="perex">([\s\S]*?)<\/span>/)?.[1] || '');
    const img = c.match(/<img src="(https:\/\/data\.parfimo\.bg\/photo\/product_catalog[^"]+)"/)?.[1];
    const priceBox = c.match(/c-product-price"[\s\S]*?<strong>([\s\S]*?)<\/strong>/)?.[1];
    const oldPrice = c.match(/<(?:del|s)[^>]*>([\s\S]*?)<\/(?:del|s)>/)?.[1];
    const discount = stripTags(c.match(/c-product-discountlabel[^>]*>([\s\S]*?)<\/(?:span|div)>/)?.[1] || '');
    const labels = [...c.matchAll(/class="flag[^"]*">\s*([\s\S]*?)\s*<\/span>/g)].map((m) => stripTags(m[1]));
    const rating = c.match(/class="reviews-count">([\d.,]+)<\/span>/)?.[1];
    const available = /delivery-0/.test(c);
    items.push({
      id: `parfimo:${href[2]}`,
      shop: 'parfimo',
      brand,
      name: title,
      url: BASE + decode(href[1]),
      image: img ? decode(img) : null,
      price: parsePrice(priceBox),
      oldPrice: parsePrice(oldPrice),
      discount: discount || null,
      currency: 'EUR',
      available,
      type: perex,
      labels,
      shopRating: rating ? parseFloat(rating.replace(',', '.')) : null,
      gender: guessGender(`${perex} ${title}`),
      concentration: guessConcentration(`${title} ${perex}`),
      fragranticaSearch: fragranticaSearch(brand, title.replace(/\s(за (жени|мъже)|унисекс).*$/i, '')),
    });
  }
  return items;
}

export async function scrape() {
  const all = new Map();
  for (let p = 1; p <= MAX_PAGES; p++) {
    const { status, html } = await getHtml(p === 1 ? LIST : `${LIST}&page=${p}`);
    if (status !== 200) {
      if (p === 1) throw new Error(`parfimo HTTP ${status}`);
      break;
    }
    // Pagination links can drop the "new" filter, so keep only tiles that carry the label,
    // and only perfume-type products.
    const items = parseList(html).filter(
      (it) => it.labels.some((l) => /нов продукт/i.test(l)) && PERFUME_RE.test(`${it.type} ${it.name}`)
    );
    if (!items.length) break;
    let added = 0;
    for (const it of items) if (!all.has(it.id)) { all.set(it.id, it); added++; }
    if (!added) break;
  }
  return [...all.values()];
}

export async function pages() {
  const out = [];
  for (const url of [`${BASE}/`, `${BASE}/promotsii/`]) {
    try {
      const r = await getHtml(url);
      out.push({ url, ...r });
    } catch (e) {
      out.push({ url, status: 0, html: '', error: e.message });
    }
  }
  return out;
}
