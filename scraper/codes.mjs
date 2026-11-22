// Discount-code detector: scans shop pages (announcement bars, banners, promo pages)
// for "код XYZ" / "promo code XYZ" patterns and returns structured codes.
import { stripTags } from './lib.mjs';

const CODE_RE =
  /(?:промо[\s-]?код(?:а)?|код(?:а)?\s+за\s+отстъпка|с\s+код(?:а)?|код(?:а)?|promo\s*code|discount\s*code|coupon|code)\s*[:\-–—]?\s*["„“”'«»]?\s*([A-Z0-9][A-Z0-9_-]{2,19})\b/g;

const STOP = new Set(['ДДС', 'EUR', 'BGN', 'HTTP', 'HTTPS', 'HTML', 'FREE', 'THE', 'CODE', 'PROMO']);

export function findCodes(html, { shop, url }) {
  if (!html) return [];
  const text = stripTags(html);
  const out = new Map();
  for (const m of text.matchAll(CODE_RE)) {
    const code = m[1];
    if (STOP.has(code) || !/[A-Z]/.test(code) || code.length < 3) continue;
    if (/^\d+$/.test(code)) continue;
    const start = Math.max(0, m.index - 90);
    const ctx = text.slice(start, m.index + m[0].length + 90).trim();
    const pct = ctx.match(/-?\s?(\d{1,2})\s?%/);
    const min = ctx.match(/над\s+(\d+(?:[.,]\d+)?)\s?(€|лв|евро)/i);
    const until = ctx.match(/до\s+(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/);
    const key = `${shop}:${code}`;
    if (out.has(key)) continue;
    out.set(key, {
      id: key,
      shop,
      code,
      discount: pct ? `-${pct[1]}%` : null,
      minOrder: min ? `${min[1]} ${min[2]}` : null,
      validUntil: until ? until[1] : null,
      app: /приложение|мобилн|\bapp\b/i.test(ctx),
      text: ctx,
      source: url,
    });
  }
  return [...out.values()];
}
