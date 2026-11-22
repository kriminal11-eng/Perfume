// Daily job: scrape shops, detect new perfumes + discount codes, write JSON for the app,
// and produce a notification summary (GitHub issue / optional Telegram).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as parfium from './sources/parfium.mjs';
import * as parfimo from './sources/parfimo.mjs';
import * as notino from './sources/notino.mjs';
import { findCodes } from './codes.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, '..', 'docs', 'data');
const STATE = path.join(ROOT, 'state');
const OUT = path.join(ROOT, 'out');
const KEEP_DAYS = 60;
const now = new Date().toISOString();

const SHOPS = {
  parfium: { mod: parfium, label: 'Parfium.bg', home: 'https://parfium.bg/collections/all?sort_by=created-descending' },
  parfimo: { mod: parfimo, label: 'Parfimo.bg', home: 'https://parfimo.bg/parfyumi/?dynamic_filter[labels][8]=8' },
  notino: { mod: notino, label: 'Notino.bg', home: notino.NEW_URL },
};

const readJson = async (f, d) => {
  try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return d; }
};
const writeJson = (f, v) => fs.writeFile(f, JSON.stringify(v, null, 1) + '\n');

async function main() {
  await fs.mkdir(DATA, { recursive: true });
  await fs.mkdir(STATE, { recursive: true });
  await fs.mkdir(OUT, { recursive: true });

  const seen = await readJson(path.join(STATE, 'seen.json'), {}); // id -> firstSeen
  const prevProducts = await readJson(path.join(DATA, 'products.json'), []);
  const prevCodes = await readJson(path.join(DATA, 'codes.json'), []);
  const byId = new Map(prevProducts.map((p) => [p.id, p]));
  const status = {};
  const newItems = [];
  const foundCodes = [];

  for (const [key, shop] of Object.entries(SHOPS)) {
    const hadBaseline = Object.keys(seen).some((id) => id.startsWith(key + ':'));
    try {
      const items = await shop.mod.scrape();
      for (const it of items) {
        const isNew = !seen[it.id];
        if (isNew) seen[it.id] = now;
        const merged = {
          ...byId.get(it.id),
          ...it,
          firstSeen: seen[it.id],
          baseline: byId.get(it.id)?.baseline ?? (isNew && !hadBaseline),
          lastSeen: now,
        };
        byId.set(it.id, merged);
        if (isNew && hadBaseline) newItems.push(merged);
      }
      status[key] = { ok: true, count: items.length, at: now };
      console.log(`[${key}] ${items.length} items`);
    } catch (e) {
      status[key] = { ok: false, blocked: !!e.blocked, error: e.message, at: now };
      console.warn(`[${key}] FAILED: ${e.message}`);
    }
    try {
      for (const pg of await shop.mod.pages()) foundCodes.push(...findCodes(pg.html, { shop: key, url: pg.url }));
    } catch (e) {
      console.warn(`[${key}] code scan failed: ${e.message}`);
    }
    status[key].label = shop.label;
    status[key].home = shop.home;
  }
  await parfimo.close();

  // Products: keep a rolling window, newest first.
  const cutoff = Date.now() - KEEP_DAYS * 864e5;
  const products = [...byId.values()]
    .filter((p) => Date.parse(p.firstSeen) >= cutoff || Date.parse(p.publishedAt || 0) >= cutoff)
    .sort((a, b) => (b.publishedAt || b.firstSeen).localeCompare(a.publishedAt || a.firstSeen));

  // Codes: merge with history, mark active if seen this run.
  const codeMap = new Map(prevCodes.map((c) => [c.id, { ...c, active: false }]));
  const newCodes = [];
  for (const c of foundCodes) {
    const prev = codeMap.get(c.id);
    if (!prev) newCodes.push(c);
    codeMap.set(c.id, { ...prev, ...c, firstSeen: prev?.firstSeen || now, lastSeen: now, active: true });
  }
  const codes = [...codeMap.values()]
    .filter((c) => c.active || Date.parse(c.lastSeen) >= cutoff)
    .sort((a, b) => Number(b.active) - Number(a.active) || b.firstSeen.localeCompare(a.firstSeen));

  await writeJson(path.join(DATA, 'products.json'), products);
  await writeJson(path.join(DATA, 'codes.json'), codes);
  await writeJson(path.join(DATA, 'meta.json'), {
    lastRun: now,
    status,
    newToday: newItems.length,
    newCodes: newCodes.map((c) => c.id),
  });
  await writeJson(path.join(STATE, 'seen.json'), seen);

  // Notification summary
  const lines = [];
  if (newCodes.length) {
    lines.push(`## 🏷️ Yeni indirim kodları (${newCodes.length})`);
    for (const c of newCodes)
      lines.push(`- **${c.code}** — ${SHOPS[c.shop].label} ${c.discount || ''}${c.app ? ' (uygulama)' : ''}\n  > ${c.text.slice(0, 220)}`);
  }
  if (newItems.length) {
    lines.push(`## 🧴 Yeni eklenen parfümler (${newItems.length})`);
    for (const p of newItems.slice(0, 40))
      lines.push(`- [${p.brand} — ${p.name}](${p.url}) · ${SHOPS[p.shop].label}${p.price ? ` · ${p.price} €` : ''}`);
    if (newItems.length > 40) lines.push(`- … ve ${newItems.length - 40} tane daha (uygulamada)`);
  }
  const blocked = Object.entries(status).filter(([, s]) => !s.ok).map(([k, s]) => `${SHOPS[k].label}: ${s.error}`);
  const summary = lines.join('\n');
  await fs.writeFile(path.join(OUT, 'notify.md'), summary + (blocked.length ? `\n\n<sub>⚠️ ${blocked.join(' · ')}</sub>\n` : '\n'));
  const notify = lines.length > 0;
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `notify=${notify}\ntitle=Parfüm: ${newItems.length} yeni ürün, ${newCodes.length} yeni kod\n`);
  }
  if (notify && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) await telegram(summary);
  console.log(`new items: ${newItems.length}, new codes: ${newCodes.length}`);
}

async function telegram(md) {
  const text = md.replace(/^## /gm, '').replace(/\*\*/g, '').replace(/^\s+> /gm, '   ').slice(0, 3900);
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!res.ok) console.warn('telegram failed', res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
