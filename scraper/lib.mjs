// Shared helpers for the scrapers.
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

export async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'bg,en;q=0.8', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(opts.timeout || 30000),
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

export function isChallenge({ status, text, headers }) {
  return (
    (status === 403 || status === 503) &&
    ((headers && headers.get && headers.get('cf-mitigated') === 'challenge') ||
      /Just a moment\.\.\.|challenges\.cloudflare\.com|403 Forbidden/i.test(text))
  );
}

export const decode = (s = '') =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

export const stripTags = (h = '') =>
  decode(
    h
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

export const parsePrice = (s) => {
  if (s == null) return null;
  const m = String(s).replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
};

/** Guess gender from Bulgarian/English product text. */
export function guessGender(text = '') {
  const t = text.toLowerCase();
  if (/унисекс|unisex/.test(t)) return 'unisex';
  if (/дамск|за жени|for women|women/.test(t)) return 'female';
  if (/мъжк|за мъже|for men|\bmen\b/.test(t)) return 'male';
  return null;
}

/** Guess concentration (EDP/EDT/...) from title. */
export function guessConcentration(text = '') {
  const t = text.toLowerCase();
  if (/extrait|екстракт|parfum extrait|pure perfume/.test(t)) return 'Extrait';
  if (/eau de parfum|парфюмна вода|\bedp\b/.test(t)) return 'EDP';
  if (/eau de toilette|тоалетна вода|\bedt\b/.test(t)) return 'EDT';
  if (/eau de cologne|одеколон|\bedc\b/.test(t)) return 'EDC';
  if (/\bparfum\b|парфюм\b/.test(t)) return 'Parfum';
  return null;
}

/** Fragrantica search URL for a brand + name. */
export function fragranticaSearch(brand, name) {
  const clean = `${brand || ''} ${name || ''}`
    .replace(/\b(eau de (parfum|toilette|cologne)|edp|edt|extrait de parfum|parfum|tester|тестер)\b/gi, ' ')
    .replace(/\d+\s?ml/gi, ' ')
    .replace(/[\u0400-\u04FF]+/g, ' ') // Fragrantica names are Latin; drop Bulgarian words
    .replace(/\s\+.*$/, ' ')
    .replace(/[^\p{L}\p{N}'&.\- ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `https://www.fragrantica.com/search/?query=${encodeURIComponent(clean)}`;
}
