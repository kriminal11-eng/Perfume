// Parfüm Defteri — tek sayfalık uygulama (vanilla JS, derleme gerektirmez).
// Mağaza verisi: data/*.json (GitHub Actions her gün günceller).
// Kişisel veriler (koleksiyon, wishlist, Fragrantica kayıtları): bu cihazın localStorage'ı.

const KEY = 'pd.v1';
const SHOPS = { parfium: 'Parfium', parfimo: 'Parfimo', notino: 'Notino' };
const SEASONS = [
  ['winter', 'Kış'], ['spring', 'İlkbahar'], ['summer', 'Yaz'], ['fall', 'Sonbahar'],
];
const TIMES = [['day', 'Gündüz'], ['night', 'Gece']];
const VOTE_LABELS = {
  longevity: { title: 'Kalıcılık', keys: ['very weak', 'weak', 'moderate', 'long lasting', 'eternal'], tr: ['Çok zayıf', 'Zayıf', 'Orta', 'Uzun', 'Çok uzun'] },
  sillage: { title: 'Sillage (iz)', keys: ['intimate', 'moderate', 'strong', 'enormous'], tr: ['Yakın', 'Orta', 'Güçlü', 'Çok güçlü'] },
  gender: { title: 'Cinsiyet', keys: ['female', 'more female', 'unisex', 'more male', 'male'], tr: ['Kadın', 'Kadınsı', 'Unisex', 'Erkeksi', 'Erkek'] },
  price: { title: 'Fiyat / performans', keys: ['way overpriced', 'overpriced', 'ok', 'good value', 'great value'], tr: ['Çok pahalı', 'Pahalı', 'İdare eder', 'İyi', 'Harika'] },
  sentiment: { title: 'Beğeni', keys: ['love', 'like', 'ok', 'dislike', 'hate'], tr: ['Bayıldı', 'Beğendi', 'Fena değil', 'Beğenmedi', 'Nefret'] },
};
const GENDER_TR = { female: 'Kadın', male: 'Erkek', unisex: 'Unisex', women: 'Kadın', men: 'Erkek', 'women and men': 'Unisex' };

// ---------- state ----------
const defaults = () => ({
  collection: [], wishlist: [], frag: {}, links: {}, myCodes: [],
  lastVisit: null, lastCodesVisit: null, pendingLink: null, theme: 'auto', notify: false,
});
let S = load();
let products = [], codes = [], meta = null;
let tab = location.hash.match(/^#tab=(\w+)/)?.[1] || 'new';
let query = '';
const filt = { shop: 'all', gender: 'all', onlyNew: false, sale: false, season: 'all', libTime: 'all' };
let showCount = 60;
const prevVisit = S.lastVisit || new Date(Date.now() - 3 * 864e5).toISOString();
const prevCodesVisit = S.lastCodesVisit || new Date(0).toISOString();

function load() {
  try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return defaults(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Kaydedilemedi: depolama dolu olabilir (fotoğrafları azaltın)'); }
}

// ---------- utils ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fragIdFromUrl = (u) => String(u || '').match(/fragrantica\.[a-z.]+\/perfume\/.+?-(\d+)\.html/i)?.[1] || null;
const fragImg = (id) => (id ? `https://fimgs.net/mdimg/perfume/375x500.${id}.jpg` : null);
// Kayıtlı resim bu parfümün kendi fimgs resmi değilse (boş yer tutucu vb.) sabit adresi kullan
const fragImage = (f) => (f ? (f.image && f.id && f.image.includes(`.${f.id}.`) ? f.image : fragImg(f.id)) : null);
const fragSearch = (s) => `https://www.fragrantica.com/search/?query=${encodeURIComponent(s)}`;
const fmtPrice = (p) => (p == null ? '' : `${Number(p).toFixed(2).replace(/\.00$/, '')} €`);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ext = (href, label) => `<a class="link-sm" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} <svg><use href="#i-ext"/></svg></a>`;
const imgTag = (src, alt = '') =>
  src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'noimg',textContent:''}))">`
      : `<svg class="noimg"><use href="#i-bottle"/></svg>`;

function toast(msg, undo) {
  const t = $('#toast');
  toast.undo = undo || null;
  t.innerHTML = esc(msg) + (undo ? ' <button class="toast-undo" data-undo>Geri al</button>' : '');
  t.classList.toggle('has-undo', !!undo);
  t.classList.add('on');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.classList.remove('on'); toast.undo = null; }, undo ? 5000 : 2400);
}

function applyTheme() {
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', S.theme);
}

// ---------- data ----------
async function loadData() {
  const bust = `?t=${Math.floor(Date.now() / 6e5)}`;
  const get = (f) => fetch(`data/${f}${bust}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  [products, codes, meta] = await Promise.all([get('products.json'), get('codes.json'), get('meta.json')]);
  products = products || [];
  codes = codes || [];
}

const isNewSince = (p, ts) =>
  (!p.baseline && p.firstSeen > ts) || (p.shop === 'parfium' && p.publishedAt && p.publishedAt > ts);
const isFresh = (p) => isNewSince(p, new Date(Date.now() - 3 * 864e5).toISOString());

function allItems() { return [...S.collection, ...S.wishlist]; }
function itemByUid(u) { return allItems().find((i) => i.uid === u); }
function itemsByFrag(id) { return id ? allItems().filter((i) => i.fragId === id) : []; }
function itemByShop(id) { return allItems().find((i) => i.shopItemId === id); }
function fragFor(x) {
  if (!x) return null;
  const id = x.fragId || (x.shopItemId && S.links['shop:' + x.shopItemId]) || (x.id && S.links['shop:' + x.id]);
  return id ? S.frag[id] || null : null;
}
function imageFor(x) {
  const f = fragFor(x);
  return x.photo || x.image || fragImage(f) || fragImg(x.fragId) || null;
}

// ---------- render ----------
function render() {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const v = $('#view');
  const fn = { new: viewNew, codes: viewCodes, collection: () => viewList('collection'), wishlist: () => viewList('wishlist'), library: viewLibrary }[tab] || viewNew;
  v.innerHTML = fn();
  updateBadges();
}

function updateBadges() {
  const n = products.filter((p) => isNewSince(p, prevVisit)).length;
  const c = codes.filter((x) => x.active && x.firstSeen > prevCodesVisit).length;
  const bn = $('#b-new'), bc = $('#b-codes');
  bn.textContent = n > 99 ? '99+' : n; bn.classList.toggle('on', n > 0 && tab !== 'new');
  bc.textContent = c; bc.classList.toggle('on', c > 0 && tab !== 'codes');
}

function seasonStrip(f) {
  if (!f?.seasons) return '';
  const max = Math.max(...SEASONS.map(([k]) => f.seasons[k] || 0), 1);
  const s = SEASONS.map(([k, tr]) => `<svg class="${(f.seasons[k] || 0) / max >= 0.6 ? '' : 'off'}" style="color:var(--${k})" aria-label="${tr}"><use href="#s-${k}"/></svg>`).join('');
  const tmax = Math.max(f.time?.day || 0, f.time?.night || 0, 1);
  const t = TIMES.map(([k, tr]) => `<svg class="${(f.time?.[k] || 0) / tmax >= 0.6 ? '' : 'off'}" style="color:var(--${k})" aria-label="${tr}"><use href="#s-${k}"/></svg>`).join('');
  return `<div class="season-strip">${s}<span style="width:6px"></span>${t}</div>`;
}

function matchesQuery(...fields) {
  if (!query) return true;
  const q = norm(query);
  return fields.some((f) => norm(f).includes(q));
}

function viewNew() {
  const st = meta?.status || {};
  const status = Object.entries(SHOPS).map(([k, label]) => {
    const s = st[k];
    if (!s) return `<span class="stat bad"><i class="dot"></i>${label}: veri yok</span>`;
    return s.ok
      ? `<span class="stat"><i class="dot"></i>${label}: ${s.count}</span>`
      : `<a class="stat bad" href="${esc(s.home)}" target="_blank" rel="noopener" title="${esc(s.error)}"><i class="dot"></i>${label}: ${s.blocked ? 'otomatik erişim engelli · siteyi aç ↗' : 'hata'}</a>`;
  }).join('');

  let list = products.filter((p) =>
    (filt.shop === 'all' || p.shop === filt.shop) &&
    (filt.gender === 'all' || p.gender === filt.gender) &&
    (!filt.onlyNew || isNewSince(p, prevVisit) || isFresh(p)) &&
    (!filt.sale || p.oldPrice || p.discount) &&
    matchesQuery(p.brand, p.name, p.type, p.family));
  const counts = {};
  products.forEach((p) => (counts[p.shop] = (counts[p.shop] || 0) + 1));
  const newCount = products.filter((p) => isNewSince(p, prevVisit)).length;

  const chip = (k, v, label, n) => `<button class="chip ${filt[k] === v ? 'on' : ''}" data-f="${k}" data-v="${v}">${label}${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
  const tog = (k, label) => `<button class="chip ${filt[k] ? 'on' : ''}" data-t="${k}">${label}</button>`;
  const total = list.length;
  list = list.slice(0, showCount);

  return `
    <h2 class="section">Yeni eklenen parfümler</h2>
    <div class="sub">${meta?.lastRun ? `Son kontrol: ${new Date(meta.lastRun).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Henüz veri yok — günlük görev ilk kez çalıştığında dolacak.'}</div>
    <div class="status">${status}</div>
    ${newCount ? `<div class="banner"><span>Son ziyaretinden beri <b>${newCount}</b> yeni parfüm eklendi.</span><button class="btn small" data-t="onlyNew">${filt.onlyNew ? 'Hepsini göster' : 'Göster'}</button></div>` : ''}
    <div class="chips">
      ${chip('shop', 'all', 'Tümü', products.length)}${Object.entries(SHOPS).map(([k, l]) => chip('shop', k, l, counts[k] || 0)).join('')}
      <span style="width:8px;flex:none"></span>
      ${tog('onlyNew', 'Sadece yeni')}${tog('sale', 'İndirimli')}
      ${chip('gender', 'female', 'Kadın')}${chip('gender', 'male', 'Erkek')}${chip('gender', 'unisex', 'Unisex')}
    </div>
    ${list.length ? `<div class="grid">${list.map(productCard).join('')}</div>` : `<div class="empty"><svg><use href="#i-spark"/></svg><p>Bu filtrelerle ürün yok.</p></div>`}
    ${total > showCount ? `<div style="text-align:center;margin:16px"><button class="btn" data-more>Daha fazla (${total - showCount})</button></div>` : ''}
  `;
}

function productCard(p) {
  const own = itemByShop(p.id);
  const f = fragFor(p);
  const fresh = isNewSince(p, prevVisit) || isFresh(p);
  return `<article class="card" data-open="shop" data-id="${esc(p.id)}">
    <div class="ph">${imgTag(p.image, p.name)}</div>
    ${fresh ? '<span class="flag">YENİ</span>' : ''}
    <span class="shoptag">${SHOPS[p.shop]}</span>
    <div class="body">
      <div class="b" lang="en">${esc(p.brand)}</div>
      <div class="t">${esc(p.name)}</div>
      ${f ? seasonStrip(f) : ''}
      <div class="meta">
        ${p.price != null ? `<span class="price">${p.sizes?.length > 1 ? 'от ' : ''}${fmtPrice(p.price)}</span>` : ''}
        ${p.oldPrice ? `<span class="old">${fmtPrice(p.oldPrice)}</span>` : ''}
        ${p.discount ? `<span class="disc">${esc(p.discount.replace(/\s/g, ''))}</span>` : ''}
      </div>
      <div style="height:30px"></div>
    </div>
    <div class="acts">
      <button class="mini ${own?.list === 'wishlist' ? 'on' : ''}" data-quick="wishlist" data-id="${esc(p.id)}" aria-label="Wishlist"><svg><use href="#${own?.list === 'wishlist' ? 'i-heart-f' : 'i-heart'}"/></svg></button>
      <button class="mini own ${own?.list === 'collection' ? 'on' : ''}" data-quick="collection" data-id="${esc(p.id)}" aria-label="Koleksiyonuma ekle"><svg><use href="#i-check"/></svg></button>
    </div>
  </article>`;
}

function viewList(which) {
  const title = which === 'collection' ? 'Koleksiyonum' : 'Wishlist';
  const items = S[which].filter((i) => matchesQuery(i.brand, i.name, i.note, i.priceNote, i.where, ...(fragFor(i)?.accords || []).map((a) => a.name)));
  return `
    <div class="toolbar">
      <div><h2 class="section">${title}</h2><div class="sub">${S[which].length} parfüm${which === 'wishlist' ? ' · not, dekant ve fiyat bilgisi ekleyebilirsin' : ''}</div></div>
      <button class="btn primary" data-add="${which}"><svg><use href="#i-plus"/></svg>Ekle</button>
    </div>
    ${items.length ? `<div class="list">${items.map(itemRow).join('')}</div>` : `
      <div class="empty"><svg><use href="#${which === 'collection' ? 'i-bottle' : 'i-heart'}"/></svg>
      <p>${which === 'collection' ? 'Elindeki parfümleri ekle. Fragrantica bağlantısını yapıştırman yeterli; fotoğraf otomatik gelir.' : 'Almak istediklerini buraya ekle. Yeniler sekmesinde ♡ ile de ekleyebilirsin.'}</p>
      <button class="btn primary" data-add="${which}"><svg><use href="#i-plus"/></svg>Parfüm ekle</button></div>`}
  `;
}

function itemRow(i) {
  const f = fragFor(i);
  const acc = (f?.accords || []).slice(0, 3).map((a) => `<span class="pill" style="background:${esc(a.color || '')};color:${textOn(a.color)}">${esc(a.name)}</span>`).join('');
  return `<div class="row" data-open="item" data-id="${esc(i.uid)}">
    <div class="thumb">${imgTag(imageFor(i), i.name)}</div>
    <div class="info">
      <div class="d-brand" lang="en">${esc(i.brand || f?.brand || '')}</div>
      <div class="t">${esc(i.name || f?.name || 'İsimsiz')}</div>
      ${i.note ? `<div class="note">${esc(i.note)}</div>` : ''}
      <div>${i.decant ? '<span class="pill decant">Dekant</span>' : ''}${i.priceNote ? `<span class="pill price">${esc(i.priceNote)}</span>` : ''}${i.size ? `<span class="pill">${esc(i.size)}</span>` : ''}${acc}</div>
      ${f ? seasonStrip(f) : ''}
    </div>
    <button class="mini row-del" data-del="${esc(i.uid)}" aria-label="${i.list === 'collection' ? 'Koleksiyondan çıkar' : 'Wishlist’ten çıkar'}"><svg><use href="#i-trash"/></svg></button>
  </div>`;
}

function viewCodes() {
  const all = [...S.myCodes.map((c) => ({ ...c, mine: true, active: true })), ...codes];
  const list = all.filter((c) => matchesQuery(c.code, c.text, c.shop));
  return `
    <div class="toolbar">
      <div><h2 class="section">İndirim kodları</h2><div class="sub">Mağaza sayfaları ve duyuru alanları her gün taranır. Uygulamaya özel kodlar "Uygulama" etiketiyle işaretlenir.</div></div>
      <button class="btn" data-addcode><svg><use href="#i-plus"/></svg>Kod ekle</button>
    </div>
    ${list.length ? `<div class="list">${list.map(codeCard).join('')}</div>` : `<div class="empty"><svg><use href="#i-tag"/></svg><p>Şu an bulunmuş bir kod yok. Bulunduğunda burada ve bildirimlerde göreceksin.</p></div>`}
    <p class="sub" style="margin-top:16px">Notino.bg otomatik erişime kapalı olduğundan kodları taranamıyor; bulduğun kodları "Kod ekle" ile kaydedebilirsin.</p>`;
}

function codeCard(c) {
  const isNew = c.active && !c.mine && c.firstSeen > prevCodesVisit;
  return `<div class="code-card ${c.active ? '' : 'inactive'}">
    <div class="code-top">
      <button class="code" data-copy="${esc(c.code)}" title="Kopyala">${esc(c.code)}</button>
      <div style="text-align:right">
        <div><b>${esc(SHOPS[c.shop] || c.shop || '')}</b> ${c.discount ? `<span class="disc">${esc(c.discount)}</span>` : ''}</div>
        <div class="sub">${isNew ? '<span class="flag" style="position:static">YENİ</span> ' : ''}${c.app ? '<span class="pill decant">Uygulama</span>' : ''}${c.mine ? '<span class="pill">Benim notum</span>' : ''}${c.active ? '' : '<span class="pill">Artık görünmüyor</span>'}</div>
      </div>
    </div>
    <div class="btnrow">
      ${c.minOrder ? `<span class="pill price">Min. ${esc(c.minOrder)}</span>` : ''}${c.validUntil ? `<span class="pill">Son: ${esc(c.validUntil)}</span>` : ''}
      ${c.firstSeen ? `<span class="pill">İlk görülme: ${fmtDate(c.firstSeen)}</span>` : ''}
    </div>
    ${c.text ? `<div class="code-ctx">“…${esc(c.text)}…”</div>` : ''}
    <div class="btnrow">
      <button class="btn small" data-copy="${esc(c.code)}"><svg><use href="#i-copy"/></svg>Kopyala</button>
      ${c.source ? ext(c.source, 'Kaynak') : ''}
      ${c.mine ? `<button class="btn small danger" data-delcode="${esc(c.id)}"><svg><use href="#i-trash"/></svg></button>` : ''}
    </div>
  </div>`;
}

function viewLibrary() {
  const entries = Object.values(S.frag).sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''));
  const list = entries.filter((f) => {
    if (!matchesQuery(f.brand, f.name, ...(f.accords || []).map((a) => a.name), ...['top', 'middle', 'base', 'all'].flatMap((k) => (f.notes?.[k] || []).map((n) => n.name)))) return false;
    if (filt.season !== 'all') {
      const max = Math.max(...SEASONS.map(([k]) => f.seasons?.[k] || 0), 1);
      if ((f.seasons?.[filt.season] || 0) / max < 0.6) return false;
    }
    if (filt.libTime !== 'all') {
      const tmax = Math.max(f.time?.day || 0, f.time?.night || 0, 1);
      if ((f.time?.[filt.libTime] || 0) / tmax < 0.6) return false;
    }
    return true;
  });
  const chip = (k, v, label) => `<button class="chip ${filt[k] === v ? 'on' : ''}" data-f="${k}" data-v="${v}">${label}</button>`;
  return `
    <div class="fsearch">
      <h2 class="section" style="margin-top:0">Fragrantica’da ara</h2>
      <div class="fsearch-row">
        <input id="fq" type="search" placeholder="Parfüm adı, marka ya da Fragrantica bağlantısı" value="${esc(fragQuery)}" autocomplete="off" enterkeyhint="search">
        <a class="btn primary" id="fq-go" href="${esc(fragSearch(fragQuery || ''))}" target="_blank" rel="noopener">Ara ↗</a>
      </div>
      <div class="sub">Fragrantica’da açılan sonuçtan parfümü seç ve “parfumdefteri” yer imine dokun; bilgiler buraya gelir. Bağlantı yapıştırırsan fotoğrafıyla hemen ekleyebilirsin.</div>
      <div id="fq-results">${fragSearchResults(fragQuery)}</div>
    </div>
    <div class="toolbar">
      <div><h2 class="section">Fragrantica kütüphanem</h2><div class="sub">${entries.length} parfümün notaları, mevsimi, kalıcılığı ve yorumları bu cihazda kayıtlı.</div></div>
      <button class="btn" data-howto><svg><use href="#i-plus"/></svg>Nasıl eklenir?</button>
    </div>
    <div class="chips">
      ${chip('season', 'all', 'Tüm mevsimler')}${SEASONS.map(([k, tr]) => chip('season', k, tr)).join('')}
      <span style="width:8px;flex:none"></span>${chip('libTime', 'all', 'Gündüz + gece')}${TIMES.map(([k, tr]) => chip('libTime', k, tr)).join('')}
    </div>
    ${list.length ? `<div class="grid">${list.map(fragCard).join('')}</div>` : `<div class="empty"><svg><use href="#i-book"/></svg><p>${entries.length ? 'Bu filtreye uyan parfüm yok.' : 'Henüz Fragrantica kaydı yok. Bir parfümün Fragrantica sayfasında "Parfüm Defteri\'ne ekle" yer imini çalıştır; tüm bilgiler buraya gelir.'}</p>${entries.length ? '' : '<button class="btn primary" data-howto>Kurulumu göster</button>'}</div>`}`;
}

let fragQuery = '';

// Arama kutusunun altındaki sonuçlar: yapıştırılan Fragrantica bağlantısı ya da kütüphane + mağaza eşleşmeleri.
// (Fragrantica otomatik sorguya kapalı; asıl arama Fragrantica'nın kendi sayfasında açılır.)
function fragSearchResults(q) {
  q = (q || '').trim();
  if (!q) return '';
  const id = fragIdFromUrl(q);
  if (id) {
    const m = q.match(/\/perfume\/([^/]+)\/(.+)-\d+\.html/);
    const brand = m ? decodeURIComponent(m[1]).replace(/-/g, ' ') : '';
    const name = m ? decodeURIComponent(m[2]).replace(/-/g, ' ') : '';
    const known = S.frag[id];
    return `<div class="row" style="margin-top:10px;cursor:default">
      <div class="thumb">${imgTag(fragImg(id), name)}</div>
      <div class="info"><div class="d-brand" lang="en">${esc(brand)}</div><div class="t">${esc(name)}</div>
        <div class="btnrow" style="margin-top:6px">
          <button class="btn small" data-urladd="collection" data-url="${esc(q)}"><svg><use href="#i-check"/></svg>Bende var</button>
          <button class="btn small" data-urladd="wishlist" data-url="${esc(q)}"><svg><use href="#i-heart"/></svg>Wishlist</button>
          ${known ? `<button class="btn small" data-open="frag" data-id="${esc(id)}">Bilgileri gör</button>` : `<a class="btn small ghost" href="${esc(q)}" target="_blank" rel="noopener">Bilgileri al ↗</a>`}
        </div></div></div>`;
  }
  const nq = norm(q);
  const lib = Object.values(S.frag).filter((f) => norm(`${f.brand} ${f.name}`).includes(nq)).slice(0, 6);
  const shop = products.filter((p) => norm(`${p.brand} ${p.name}`).includes(nq)).slice(0, 6);
  if (!lib.length && !shop.length) return `<p class="sub" style="margin-top:8px">Kütüphanende ve mağaza yenilerinde “${esc(q)}” yok. <b>Ara ↗</b> ile Fragrantica’da bak.</p>`;
  return `${lib.length ? `<h3 class="mini-h">Kütüphanende</h3><div class="grid">${lib.map(fragCard).join('')}</div>` : ''}
    ${shop.length ? `<h3 class="mini-h">Mağaza yenilerinde</h3><div class="grid">${shop.map(productCard).join('')}</div>` : ''}`;
}

function addFromFragUrl(list, url) {
  const id = fragIdFromUrl(url);
  if (!id) return;
  const ex = itemsByFrag(id)[0];
  if (ex) { toast(ex.list === 'collection' ? 'Zaten koleksiyonunda' : 'Zaten wishlist’inde'); return; }
  const m = url.match(/\/perfume\/([^/]+)\/(.+)-\d+\.html/);
  S[list].unshift({
    uid: uid(), list, addedAt: new Date().toISOString(),
    brand: S.frag[id]?.brand || (m ? decodeURIComponent(m[1]).replace(/-/g, ' ') : ''),
    name: S.frag[id]?.name || (m ? decodeURIComponent(m[2]).replace(/-/g, ' ') : ''),
    fragId: id, fragUrl: url.split('#')[0], note: '', decant: false,
  });
  save();
  toast(list === 'collection' ? 'Koleksiyona eklendi ✓' : 'Wishlist’e eklendi ♡');
}

function fragCard(f) {
  const owned = itemsByFrag(f.id);
  return `<article class="card" data-open="frag" data-id="${esc(f.id)}">
    <div class="ph">${imgTag(fragImage(f), f.name)}</div>
    ${owned.length ? `<span class="shoptag">${owned.some((o) => o.list === 'collection') ? 'Bende var' : 'Wishlist'}</span>` : ''}
    <div class="body">
      <div class="b" lang="en">${esc(f.brand)}</div>
      <div class="t">${esc(f.name)}</div>
      ${seasonStrip(f)}
      <div class="meta">${f.rating ? `<span class="stars">★ ${f.rating.toFixed(2)}</span>` : ''}${(f.accords || []).slice(0, 2).map((a) => `<span class="pill" style="background:${esc(a.color)};color:${textOn(a.color)};margin:0">${esc(a.name)}</span>`).join('')}</div>
    </div>
  </article>`;
}

// ---------- detail sheet ----------
function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.remove('hidden');
  const panel = $('.sheet-panel');
  // Ölçekli (masaüstü modu) görünümde vh birimi de büyüyor ve panelin üstü ekran dışına taşıyor:
  // yüksekliği gerçek ekran yüksekliğine göre piksel olarak ver.
  const z = parseFloat(document.documentElement.style.zoom) || 1;
  panel.style.maxHeight = Math.floor((innerHeight * 0.94) / z) + 'px';
  panel.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').classList.add('hidden');
  document.body.style.overflow = '';
}

function openDetail(kind, id, extra) {
  let x, f, shop;
  if (kind === 'shop') {
    shop = products.find((p) => p.id === id);
    if (!shop) return;
    x = itemByShop(id) || null;
    f = fragFor(x || { id });
  } else if (kind === 'item') {
    x = itemByUid(id);
    if (!x) return;
    shop = x.shopItemId ? products.find((p) => p.id === x.shopItemId) : null;
    f = fragFor(x);
  } else if (kind === 'frag') {
    f = S.frag[id];
    x = itemsByFrag(id)[0] || null;
    if (!f && extra) f = null;
  }
  const fragId = f?.id || x?.fragId || (kind === 'frag' ? id : null) || (shop && S.links['shop:' + shop.id]);
  const brand = x?.brand || f?.brand || shop?.brand || extra?.brand || '';
  const name = x?.name || f?.name || shop?.name || extra?.name || '';
  const img = x?.photo || fragImage(f) || shop?.image || x?.image || fragImg(fragId);
  const fragUrl = f?.url || x?.fragUrl || extra?.url || null;
  const searchUrl = shop?.fragranticaSearch || fragSearch(`${brand} ${name}`);
  const ctx = { kind, id, shopId: shop?.id, uid: x?.uid, fragId, brand, name, fragUrl, extra };
  openDetail.ctx = ctx;

  const gender = f?.genderLabel ? GENDER_TR[f.genderLabel] : shop?.gender ? GENDER_TR[shop.gender] : '';
  const head = `
    <div class="d-head">
      <div class="d-img">${imgTag(img, name)}</div>
      <div style="min-width:0;flex:1">
        <div class="d-brand" lang="en">${esc(brand)}</div>
        <div class="d-title">${esc(name)}</div>
        <div class="sub">${[gender, f?.year, shop?.concentration, f?.perfumers?.length ? 'Parfümör: ' + f.perfumers.join(', ') : ''].filter(Boolean).map(esc).join(' · ')}</div>
        ${f?.rating ? `<div class="stars">${'★'.repeat(Math.round(f.rating))}${'☆'.repeat(5 - Math.round(f.rating))} <span class="sub">${f.rating.toFixed(2)} · ${f.ratingCount || ''} oy</span></div>` : ''}
        ${shop ? `<div class="meta" style="margin-top:6px"><span class="price">${fmtPrice(shop.price)}</span> ${shop.oldPrice ? `<span class="old">${fmtPrice(shop.oldPrice)}</span>` : ''} ${shop.discount ? `<span class="disc">${esc(shop.discount)}</span>` : ''} <span class="sub">${esc(SHOPS[shop.shop])}${shop.sizes?.length ? ' · ' + shop.sizes.map(esc).join(', ') : ''}</span></div>` : ''}
        <div class="d-links">
          ${fragUrl ? ext(fragUrl, 'Fragrantica') : ext(searchUrl, 'Fragrantica’da ara')}
          ${shop ? ext(shop.url, SHOPS[shop.shop]) : x?.shopUrl ? ext(x.shopUrl, 'Mağaza') : ''}
        </div>
      </div>
    </div>`;

  const actions = x
    ? `<div class="btnrow" style="margin-top:14px">
        <span class="pill ${x.list === 'collection' ? '' : 'decant'}" style="padding:6px 10px;font-size:13px">${x.list === 'collection' ? '✓ Koleksiyonumda' : '♡ Wishlist’te'}</span>
        <button class="btn small" data-edit="${x.uid}">Düzenle / not</button>
        <button class="btn small" data-move="${x.uid}">${x.list === 'collection' ? 'Wishlist’e taşı' : 'Aldım → Koleksiyona'}</button>
        <button class="btn small danger" data-del="${x.uid}"><svg><use href="#i-trash"/></svg>${x.list === 'collection' ? 'Koleksiyondan çıkar' : 'Wishlist’ten çıkar'}</button>
      </div>`
    : `<div class="btnrow" style="margin-top:14px">
        <button class="btn primary" data-addfrom="collection"><svg><use href="#i-check"/></svg>Bende var</button>
        <button class="btn" data-addfrom="wishlist"><svg><use href="#i-heart"/></svg>Wishlist</button>
      </div>`;

  const personal = x && (x.note || x.priceNote || x.decant || x.where || x.size || x.myRating)
    ? `<div class="block"><h3>Notlarım</h3><div class="review">
        ${x.myRating ? `<div class="stars">${'★'.repeat(x.myRating)}${'☆'.repeat(5 - x.myRating)}</div>` : ''}
        ${x.note ? `<div style="white-space:pre-wrap">${esc(x.note)}</div>` : ''}
        <div>${x.decant ? '<span class="pill decant">Dekant alınabilir</span>' : ''}${x.priceNote ? `<span class="pill price">${esc(x.priceNote)}</span>` : ''}${x.where ? `<span class="pill">${esc(x.where)}</span>` : ''}${x.size ? `<span class="pill">${esc(x.size)}</span>` : ''}</div>
      </div></div>` : '';

  const fragBlock = f ? renderFrag(f) : renderFragCta(ctx, searchUrl);
  const shopDesc = shop?.description ? `<div class="block"><h3>Mağaza açıklaması</h3><div class="sub">${esc(shop.description)}</div></div>` : '';
  openSheet(head + actions + personal + fragBlock + shopDesc);
}

function renderFrag(f) {
  const out = [];
  const hasSeason = f.seasons && Object.values(f.seasons).some((v) => v != null);
  const hasTime = f.time && Object.values(f.time).some((v) => v != null);
  if (hasSeason || hasTime) {
    const cell = (k, tr, v) => `<div class="w"><svg style="color:var(--${k});opacity:${v == null ? 0.3 : 0.35 + 0.65 * (v / 100)}"><use href="#s-${k}"/></svg><span>${tr}</span><div class="vbar"><i style="width:${v || 0}%;background:var(--${k})"></i></div></div>`;
    out.push(`<div class="block"><h3>Ne zaman kullanılır?</h3><div class="wear">
      ${SEASONS.map(([k, tr]) => cell(k, tr, f.seasons?.[k])).join('')}${TIMES.map(([k, tr]) => cell(k, tr, f.time?.[k])).join('')}
    </div></div>`);
  }
  const meters = ['longevity', 'sillage', 'gender', 'price'].filter((k) => f.votes?.[k]).map((k) => meter(k, f.votes[k]));
  if (meters.length) out.push(`<div class="block"><h3>Topluluk oyları</h3><div class="meters">${meters.join('')}</div></div>`);
  if (f.accords?.length) {
    out.push(`<div class="block"><h3>Ana akorlar</h3><div class="accords">${f.accords.map((a) => `<div class="accord" style="background:${esc(a.color || 'var(--accent)')};color:${textOn(a.color)};text-shadow:none;width:${Math.max(30, a.width || 50)}%">${esc(a.name)}</div>`).join('')}</div></div>`);
  }
  const noteHtml = (arr) => `<div class="notes">${arr.map((n) => `<a class="note" href="${esc(n.url || '#')}" target="_blank" rel="noopener">${n.img ? `<img src="${esc(n.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=ni>•</span>'">` : '<span class="ni">•</span>'}<span>${esc(n.name)}</span></a>`).join('')}</div>`;
  const N = f.notes || {};
  if (N.top?.length || N.middle?.length || N.base?.length) {
    out.push(`<div class="block"><h3>Nota piramidi</h3><div class="pyr">
      ${N.top?.length ? `<div class="pyr-level"><div class="lbl">Üst notalar</div>${noteHtml(N.top)}</div>` : ''}
      ${N.middle?.length ? `<div class="pyr-level"><div class="lbl">Orta notalar</div>${noteHtml(N.middle)}</div>` : ''}
      ${N.base?.length ? `<div class="pyr-level"><div class="lbl">Alt notalar</div>${noteHtml(N.base)}</div>` : ''}
    </div></div>`);
  } else if (N.all?.length) {
    out.push(`<div class="block"><h3>Notalar</h3>${noteHtml(N.all)}</div>`);
  }

  const sims = (arr, title) => arr?.length ? `<div class="block"><h3>${title}</h3><div class="hscroll">${arr.map((s) => `<div class="sim" data-sim="${esc(s.id)}" data-name="${esc(s.name)}" data-url="${esc(s.url)}"><img src="${esc(s.img || fragImg(s.id))}" alt="" loading="lazy" referrerpolicy="no-referrer"><div>${esc(s.name)}</div></div>`).join('')}</div></div>` : '';
  out.push(sims(f.remindsOf, 'Bu parfüm şunları hatırlatıyor'));
  out.push(sims(f.alsoLike, 'Bunu sevenler bunları da seviyor'));

  if (f.reviews?.length) {
    out.push(`<div class="block"><h3>Yorumlar (${f.reviews.length})</h3>${f.reviews.map((r) => `<div class="review" data-rev><div class="ra">${esc(r.author || 'Anonim')}${r.date ? ' · ' + esc(r.date) : ''}</div><div class="rt">${esc(r.text)}</div></div>`).join('')}</div>`);
  }
  if (f.description) out.push(`<div class="block"><h3>Açıklama</h3><div class="sub">${esc(f.description)}</div></div>`);
  out.push(`<div class="block sub">Fragrantica’dan ${fmtDate(f.capturedAt)} tarihinde alındı · ${ext(f.url, 'kaynak')} · <a href="#" data-refetch="${esc(f.url)}">güncelle</a> · <a href="#" data-delfrag="${esc(f.id)}" style="color:#c2416b">kütüphaneden sil</a></div>`);
  if (f.debug) out.push(`<div class="block sub">Eksik bölüm mü var? <a href="${esc(debugIssueUrl(f))}" target="_blank" rel="noopener" data-debugcopy="${esc(f.id)}">Tanı bilgisini geliştiriciye gönder ↗</a><br>Ayrıntılı döküm panoya kopyalanır: açılan GitHub sayfasında metin kutusunun sonuna <b>yapıştır</b>, sonra “Create”.</div>`);
  return out.join('');
}

function debugIssueUrl(f) {
  const have = {
    akor: f.accords?.length || 0,
    nota: ['top', 'middle', 'base', 'all'].reduce((n, k) => n + (f.notes?.[k]?.length || 0), 0),
    mevsim: Object.values(f.seasons || {}).filter((v) => v != null).length,
    oy: Object.keys(f.votes || {}).join(',') || '-',
    hatirlatan: f.remindsOf?.length || 0, benzer: f.alsoLike?.length || 0, yorum: f.reviews?.length || 0,
  };
  const fence = '`'.repeat(3);
  const body = `Sayfa: ${f.url}\n\nGelenler: ${JSON.stringify(have)}\n\nSayaçlar: ${JSON.stringify(f.debug?.counts || {})}\n\n(Ayrıntılı döküm panoya kopyalandı — bu satırın altına YAPIŞTIR)\n`;
  const repo = 'https://github.com/kriminal11-eng/Perfume';
  return `${repo}/issues/new?title=${encodeURIComponent('Fragrantica tanı: ' + (f.brand || '') + ' ' + (f.name || ''))}&body=${encodeURIComponent(body)}`;
}

function textOn(color) {
  const m = String(color || '').match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (!m) return '#fff';
  const [r, g, b] = [m[1], m[2], m[3]].map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#2a2230' : '#fff';
}

function meter(k, votes) {
  const def = VOTE_LABELS[k];
  const vals = def.keys.map((key) => votes[key] || 0);
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...vals, 1);
  const topI = vals.indexOf(max);
  return `<div class="meter"><div class="mt"><span>${def.title}</span><b>${def.tr[topI]}</b></div>
    <div class="seg">${def.keys.map((key, i) => `<div class="${i === topI ? 'top' : ''}"><div class="bar"><i style="height:${(vals[i] / max) * 100}%"></i></div><span>${def.tr[i]}</span><span>${Math.round((vals[i] / total) * 100)}%</span></div>`).join('')}</div></div>`;
}

function renderFragCta(ctx, searchUrl) {
  const target = ctx.fragUrl || searchUrl;
  return `<div class="block cta">
    <b>Fragrantica bilgilerini ekle</b>
    <ol>
      <li><a href="${esc(target)}" target="_blank" rel="noopener" data-pend>Fragrantica’da ${ctx.fragUrl ? 'sayfayı aç' : 'ara'}</a> ve doğru parfümün sayfasına gir.</li>
      <li>Yer imlerinden <b>“Parfüm Defteri’ne ekle”</b>yi çalıştır.</li>
      <li>Notalar, mevsim, gündüz/gece, kalıcılık, sillage, yorumlar ve benzer parfümler buraya gelir.</li>
    </ol>
    <div class="field"><label>…ya da Fragrantica bağlantısını yapıştır (fotoğraf ve bağlantı hemen eklenir)</label>
      <div class="btnrow"><input id="fraglink" placeholder="https://www.fragrantica.com/perfume/…" style="flex:1;min-width:200px" value="${esc(ctx.fragUrl || '')}"><button class="btn" data-setfrag>Kaydet</button></div>
    </div>
    <div class="sub" style="margin-top:8px">Yer imi kurulu değil mi? <a href="#" data-howto>Kurulum</a></div>
  </div>`;
}

// ---------- add / edit ----------
function editForm(item, list) {
  const i = item || { list, brand: '', name: '', fragUrl: '', note: '', priceNote: '', decant: false, where: '', size: '', myRating: 0 };
  const isWish = (item?.list || list) === 'wishlist';
  openSheet(`
    <h2 class="section">${item ? 'Düzenle' : isWish ? 'Wishlist’e ekle' : 'Koleksiyona ekle'}</h2>
    <form class="form" id="itemform">
      <div class="field"><label>Fragrantica bağlantısı (önerilir)</label><input name="fragUrl" value="${esc(i.fragUrl || '')}" placeholder="https://www.fragrantica.com/perfume/Marka/Isim-12345.html" inputmode="url"></div>
      <div class="btnrow" style="gap:10px">
        <div class="field" style="flex:1;min-width:140px"><label>Marka</label><input name="brand" value="${esc(i.brand)}" placeholder="Dior"></div>
        <div class="field" style="flex:2;min-width:180px"><label>Parfüm</label><input name="name" value="${esc(i.name)}" placeholder="Sauvage EDP"></div>
      </div>
      <div class="btnrow" style="gap:10px">
        <div class="field" style="flex:1"><label>${isWish ? 'Fiyat notu' : 'Boyut'}</label><input name="${isWish ? 'priceNote' : 'size'}" value="${esc(isWish ? i.priceNote : i.size)}" placeholder="${isWish ? 'Parfimo’da 89 €' : '100 ml'}"></div>
        <div class="field" style="flex:1"><label>${isWish ? 'Nereden' : 'Puanım'}</label>${isWish ? `<input name="where" value="${esc(i.where)}" placeholder="Notino / dekant grubu">` : `<select name="myRating">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${+i.myRating === n ? 'selected' : ''}>${n ? '★'.repeat(n) : '—'}</option>`).join('')}</select>`}</div>
      </div>
      ${isWish ? `<label class="check"><input type="checkbox" name="decant" ${i.decant ? 'checked' : ''}> Dekant alabilirim</label>` : ''}
      <div class="field"><label>Notlarım</label><textarea name="note" placeholder="${isWish ? 'Dekant alıp denemeliyim, X’e benziyormuş…' : 'Kış akşamları, iş yerinde fazla ağır…'}">${esc(i.note)}</textarea></div>
      <div class="field"><label>Kendi fotoğrafın (isteğe bağlı)</label>
        <div class="btnrow"><label class="btn small"><svg><use href="#i-camera"/></svg>Fotoğraf çek / seç<input type="file" accept="image/*" capture="environment" name="photo" hidden></label>
        <span id="photoprev">${i.photo ? `<img src="${i.photo}" style="height:48px;border-radius:8px">` : ''}</span>
        ${i.photo ? '<button type="button" class="btn small ghost" data-rmphoto>Kaldır</button>' : ''}</div>
      </div>
      <div class="sticky-actions">
        <button class="btn primary" type="submit">Kaydet</button>
        <button class="btn ghost" type="button" data-close>Vazgeç</button>
        ${item ? `<button class="btn danger" type="button" data-del="${item.uid}" style="margin-left:auto"><svg><use href="#i-trash"/></svg>Sil</button>` : ''}
      </div>
    </form>`);
  const form = $('#itemform');
  let photo = i.photo || null;
  form.photo.addEventListener('change', async () => {
    const file = form.photo.files[0];
    if (!file) return;
    photo = await downscale(file, 520);
    $('#photoprev').innerHTML = `<img src="${photo}" style="height:48px;border-radius:8px">`;
  });
  form.querySelector('[data-rmphoto]')?.addEventListener('click', () => { photo = null; $('#photoprev').innerHTML = ''; });
  form.fragUrl.addEventListener('change', () => {
    const id = fragIdFromUrl(form.fragUrl.value);
    if (!id) return;
    const m = form.fragUrl.value.match(/\/perfume\/([^/]+)\/(.+)-\d+\.html/);
    if (m) {
      if (!form.brand.value) form.brand.value = decodeURIComponent(m[1]).replace(/-/g, ' ');
      if (!form.name.value) form.name.value = decodeURIComponent(m[2]).replace(/-/g, ' ');
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries([...fd.entries()].filter(([k]) => k !== 'photo'));
    data.decant = !!fd.get('decant');
    data.myRating = +data.myRating || 0;
    data.fragId = fragIdFromUrl(data.fragUrl) || item?.fragId || null;
    if (!data.brand && !data.name && !data.fragId) return toast('Marka/isim ya da Fragrantica bağlantısı gir');
    data.photo = photo;
    if (item) Object.assign(item, data);
    else S[list].unshift({ uid: uid(), list, addedAt: new Date().toISOString(), ...(editForm.prefill || {}), ...data });
    editForm.prefill = null;
    save();
    closeSheet();
    render();
    toast('Kaydedildi');
  });
}

async function downscale(file, max) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.78);
}

function addFromContext(list) {
  const c = openDetail.ctx;
  const shop = c.shopId ? products.find((p) => p.id === c.shopId) : null;
  const item = {
    uid: uid(), list, addedAt: new Date().toISOString(),
    brand: c.brand, name: c.name, fragId: c.fragId || null, fragUrl: c.fragUrl || (c.fragId && S.frag[c.fragId]?.url) || '',
    image: shop?.image || null, shopItemId: shop?.id || null, shopUrl: shop?.url || null,
    priceNote: list === 'wishlist' && shop?.price ? `${SHOPS[shop.shop]}: ${fmtPrice(shop.price)}` : '',
    note: '', decant: false,
  };
  S[list].unshift(item);
  save();
  toast(list === 'collection' ? 'Koleksiyona eklendi' : 'Wishlist’e eklendi');
  render();
  openDetail('item', item.uid);
}

function quickToggle(list, shopId) {
  const p = products.find((x) => x.id === shopId);
  const ex = itemByShop(shopId);
  if (ex && ex.list === list) return removeItem(ex.uid);
  else if (ex) {
    S[ex.list] = S[ex.list].filter((i) => i !== ex);
    ex.list = list;
    S[list].unshift(ex);
    toast(list === 'collection' ? 'Koleksiyona taşındı' : 'Wishlist’e taşındı');
  } else {
    S[list].unshift({
      uid: uid(), list, addedAt: new Date().toISOString(), brand: p.brand, name: p.name, image: p.image,
      shopItemId: p.id, shopUrl: p.url, fragId: S.links['shop:' + p.id] || null, fragUrl: '',
      priceNote: list === 'wishlist' && p.price ? `${SHOPS[p.shop]}: ${fmtPrice(p.price)}` : '', note: '', decant: false,
    });
    toast(list === 'collection' ? 'Koleksiyona eklendi ✓' : 'Wishlist’e eklendi ♡');
  }
  save();
  render();
}

function removeItem(u) {
  const x = itemByUid(u);
  if (!x) return;
  const list = x.list;
  const idx = S[list].indexOf(x);
  S[list] = S[list].filter((i) => i !== x);
  save();
  closeSheet();
  render();
  toast(list === 'collection' ? 'Koleksiyondan çıkarıldı' : 'Wishlist’ten çıkarıldı', () => {
    S[list].splice(idx, 0, x);
    save();
    render();
  });
}

function moveItem(u) {
  const x = itemByUid(u);
  if (!x) return;
  S[x.list] = S[x.list].filter((i) => i !== x);
  x.list = x.list === 'collection' ? 'wishlist' : 'collection';
  S[x.list].unshift(x);
  save();
  render();
  openDetail('item', u);
  toast(x.list === 'collection' ? 'Koleksiyona taşındı' : 'Wishlist’e taşındı');
}

function linkFragTo(ctx, fragId, fragUrl) {
  if (ctx.uid) {
    const x = itemByUid(ctx.uid);
    if (x) { x.fragId = fragId; if (fragUrl) x.fragUrl = fragUrl; }
  }
  if (ctx.shopId) S.links['shop:' + ctx.shopId] = fragId;
}

// ---------- Fragrantica import (from bookmarklet) ----------
async function decodePayload(p) {
  if (p[0] === 'j') return JSON.parse(decodeURIComponent(p.slice(1)));
  const b64 = p.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

async function handleImport() {
  const m = location.hash.match(/#fimport=(.+)$/);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  let f;
  try { f = await decodePayload(m[1]); } catch (e) { toast('Fragrantica verisi okunamadı'); return false; }
  if (!f?.id) return false;
  S.frag[f.id] = f;
  let linked = itemsByFrag(f.id);
  linked.forEach((x) => { if (!x.fragUrl) x.fragUrl = f.url; });
  const pend = S.pendingLink;
  if (pend && Date.now() - pend.at < 60 * 60e3) {
    linkFragTo(pend, f.id, f.url);
    S.pendingLink = null;
  }
  save();
  tab = 'library';
  render();
  if (pend?.uid) openDetail('item', pend.uid);
  else if (pend?.shopId) openDetail('shop', pend.shopId);
  else openDetail('frag', f.id);
  const counts = [f.accords?.length && `${f.accords.length} akor`, (f.notes?.top?.length || 0) + (f.notes?.middle?.length || 0) + (f.notes?.base?.length || 0) + (f.notes?.all?.length || 0) + ' nota', f.reviews?.length && `${f.reviews.length} yorum`].filter(Boolean).join(', ');
  toast(`Fragrantica’dan alındı: ${counts}`);
  return true;
}

// ---------- settings ----------
async function openSettings() {
  const appUrl = location.origin + location.pathname;
  let bm = '#', bmLong = '#';
  try {
    const src = await fetch('capture.js').then((r) => r.text());
    bmLong = 'javascript:' + encodeURIComponent(src.replace('__APP_URL__', appUrl));
  } catch {}
  // Kısa yükleyici: telefon tarayıcıları çok uzun yer imlerini çalıştırmayabiliyor.
  const loader = `(function(){var n=document.createElement('div');n.id='pd-note';n.textContent='Parfüm Defteri yükleniyor…';n.style.cssText='position:fixed;top:12px;left:12px;right:12px;z-index:2147483647;background:#9b5a7a;color:#fff;padding:14px;border-radius:12px;font:600 16px sans-serif;text-align:center';document.body.appendChild(n);var s=document.createElement('script');s.src='${appUrl}capture.js?t='+Date.now();s.onerror=function(){n.style.background='#b3261e';n.textContent='Parfüm Defteri: kod yüklenemedi (site engelliyor olabilir)'};document.body.appendChild(s);})();`;
  bm = 'javascript:' + encodeURIComponent(loader);
  openSettings.bm = bm;
  openSettings.bmLong = bmLong;
  const notifyState = 'Notification' in window ? Notification.permission : 'unsupported';
  openSheet(`
    <h2 class="section">Ayarlar</h2>
    <div class="block" id="howto"><h3>Fragrantica yer imi (bookmarklet)</h3>
      <p class="sub">Fragrantica otomatik toplamaya kapalı; bu yüzden bilgiler <b>senin tarayıcında</b>, açtığın sayfadan alınır. Bir kez kur, sonra her parfüm sayfasında tek dokunuş.</p>
      <p><a class="bm" href="${esc(bm)}" onclick="event.preventDefault();alert('Bu düğmeyi yer imleri çubuğuna sürükleyin (masaüstü) veya aşağıdaki “Kodu kopyala” ile yer imi oluşturun.')">Parfüm Defteri’ne ekle</a></p>
      <ol class="sub" style="padding-left:18px">
        <li><b>Masaüstü:</b> Mor düğmeyi yer imleri çubuğuna sürükle.</li>
        <li><b>Telefon (Chrome/Safari):</b> “Kodu kopyala”ya bas → herhangi bir sayfayı yer imlerine ekle → yer imini düzenle, adını <i>Parfüm Defteri’ne ekle</i>, adresini kopyaladığın kod yap.</li>
        <li>Fragrantica’da parfüm sayfasındayken: Chrome’da adres çubuğuna “Parfüm Defteri” yazıp yer imine dokun; Safari’de yer imlerinden seç.</li>
      </ol>
      <button class="btn small" data-copybm><svg><use href="#i-copy"/></svg>Kodu kopyala</button>
      <details style="margin-top:8px"><summary class="sub">Kopyalama çalışmazsa kodu göster</summary>
        <textarea readonly onclick="this.select()" style="width:100%;height:90px;font-size:11px;margin-top:6px">${esc(bm)}</textarea>
        <div class="sub">Kod <b>javascript:</b> ile başlamalı (${bm.length} karakter).</div>
        <button class="btn small ghost" data-copybmlong style="margin-top:6px">Uzun (çevrimdışı) sürümü kopyala</button>
      </details>
    </div>
    <div class="block"><h3>Bildirimler</h3>
      <p class="sub">Telefonuna anlık bildirim için günlük görev şunları yapar: (1) GitHub’da bir “issue” açar — GitHub mobil uygulaması bildirim gönderir; (2) isteğe bağlı Telegram botu ayarlarsan Telegram’dan mesaj atar. Uygulama açıldığında yeni ürün/kod varsa ayrıca burada bildirim gösterilir.</p>
      <button class="btn small" data-notify>${notifyState === 'granted' ? '✓ Tarayıcı bildirimleri açık' : 'Tarayıcı bildirimlerine izin ver'}</button>
    </div>
    <div class="block"><h3>Görünüm</h3>
      <div class="chips">${['auto', 'light', 'dark'].map((t) => `<button class="chip ${S.theme === t ? 'on' : ''}" data-theme="${t}">${{ auto: 'Otomatik', light: 'Açık', dark: 'Koyu' }[t]}</button>`).join('')}</div>
    </div>
    <div class="block"><h3>Yedekle / taşı</h3>
      <p class="sub">Koleksiyon, wishlist ve Fragrantica kayıtları bu cihazda saklanır. Başka cihaza taşımak için dışa aktar → diğer cihazda içe aktar.</p>
      <div class="btnrow"><button class="btn small" data-export>Dışa aktar (.json)</button><label class="btn small">İçe aktar<input type="file" accept="application/json,.json" data-import hidden></label></div>
      <p class="sub">${S.collection.length} koleksiyon · ${S.wishlist.length} wishlist · ${Object.keys(S.frag).length} Fragrantica kaydı</p>
    </div>
    <div class="block"><h3>Mağaza takibi</h3>
      <div class="status">${Object.entries(meta?.status || {}).map(([k, s]) => `<span class="stat ${s.ok ? '' : 'bad'}"><i class="dot"></i>${esc(s.label || k)}: ${s.ok ? s.count + ' ürün' : esc(s.error)}</span>`).join('') || '<span class="sub">Henüz çalışmadı</span>'}</div>
    </div>
  `);
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `parfum-defteri-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text());
    const mergeList = (a = [], b = []) => { const ids = new Set(a.map((x) => x.uid)); return [...a, ...b.filter((x) => !ids.has(x.uid))]; };
    S.collection = mergeList(S.collection, d.collection);
    S.wishlist = mergeList(S.wishlist, d.wishlist);
    S.frag = { ...d.frag, ...S.frag };
    S.links = { ...d.links, ...S.links };
    S.myCodes = mergeList(S.myCodes, d.myCodes);
    save();
    render();
    closeSheet();
    toast('İçe aktarıldı');
  } catch { toast('Dosya okunamadı'); }
}

async function maybeNotify() {
  if (!S.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const n = products.filter((p) => isNewSince(p, prevVisit)).length;
  const c = codes.filter((x) => x.active && x.firstSeen > prevCodesVisit);
  if (!n && !c.length) return;
  const body = [n && `${n} yeni parfüm`, c.length && `Yeni kod: ${c.map((x) => x.code).join(', ')}`].filter(Boolean).join(' · ');
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification('Parfüm Defteri', { body, icon: 'icons/icon-192.png', tag: 'pd-daily' });
  else new Notification('Parfüm Defteri', { body });
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a, [data-open], [data-sim], [data-rev], [data-close]');
  if (!t) return;
  const d = t.dataset;
  if (d.close !== undefined) return closeSheet();
  if (d.tab) { tab = d.tab; showCount = 60; history.replaceState(null, '', '#tab=' + tab); if (tab === 'codes') { S.lastCodesVisit = new Date().toISOString(); save(); } render(); window.scrollTo(0, 0); return; }
  if (d.quick) { e.stopPropagation(); return quickToggle(d.quick, d.id); }
  if (d.f) { filt[d.f] = filt[d.f] === d.v && d.v !== 'all' ? 'all' : d.v; showCount = 60; return render(); }
  if (d.t) { filt[d.t] = !filt[d.t]; showCount = 60; return render(); }
  if (d.more !== undefined) { showCount += 60; return render(); }
  if (d.open) return openDetail(d.open, d.id);
  if (d.add) { editForm.prefill = null; return editForm(null, d.add); }
  if (d.addfrom) return addFromContext(d.addfrom);
  if (d.edit) return editForm(itemByUid(d.edit));
  if (d.move) return moveItem(d.move);
  if (d.del) { e.stopPropagation(); return removeItem(d.del); }
  if (d.delfrag) {
    e.preventDefault();
    if (!confirm('Bu Fragrantica kaydı kütüphaneden silinsin mi? (Koleksiyon/wishlist kaydın kalır)')) return;
    const fid = d.delfrag;
    const backup = S.frag[fid];
    delete S.frag[fid];
    save(); closeSheet(); render();
    return toast('Fragrantica kaydı silindi', () => { S.frag[fid] = backup; save(); render(); });
  }
  if (d.undo !== undefined) { const fn = toast.undo; toast.undo = null; $('#toast').classList.remove('on'); fn?.(); return; }
  if (d.sim) {
    const f = S.frag[d.sim];
    if (f) return openDetail('frag', d.sim);
    openSheet(`<div class="d-head"><div class="d-img">${imgTag(fragImg(d.sim), d.name)}</div><div style="flex:1">
      <div class="d-title">${esc(d.name)}</div>
      <div class="d-links">${ext(d.url, 'Fragrantica')}</div>
      <p class="sub">Bu parfümün tüm bilgilerini görmek için Fragrantica sayfasını açıp yer imini çalıştır.</p>
      <div class="btnrow"><button class="btn primary" data-simadd="wishlist" data-id="${esc(d.sim)}" data-name="${esc(d.name)}" data-url="${esc(d.url)}"><svg><use href="#i-heart"/></svg>Wishlist’e ekle</button></div>
    </div></div>`);
    return;
  }
  if (d.simadd) {
    const m = d.url.match(/\/perfume\/([^/]+)\//);
    const brand = m ? decodeURIComponent(m[1]).replace(/-/g, ' ') : '';
    const name = d.name.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i'), '').trim();
    S.wishlist.unshift({ uid: uid(), list: 'wishlist', addedAt: new Date().toISOString(), brand, name, fragId: d.id, fragUrl: d.url, note: '', decant: false });
    save(); render(); closeSheet(); return toast('Wishlist’e eklendi ♡');
  }
  if (d.rev !== undefined) return t.classList.toggle('open');
  if (d.pend !== undefined) {
    const c = openDetail.ctx;
    S.pendingLink = { uid: c.uid, shopId: c.shopId, at: Date.now() };
    save();
    return; // link opens normally
  }
  if (d.setfrag !== undefined) {
    const v = $('#fraglink').value.trim();
    const id = fragIdFromUrl(v);
    if (!id) return toast('Geçerli bir Fragrantica parfüm bağlantısı değil');
    const c = openDetail.ctx;
    linkFragTo(c, id, v);
    save(); render();
    if (c.uid) openDetail('item', c.uid); else if (c.shopId) openDetail('shop', c.shopId);
    return toast('Fragrantica bağlantısı kaydedildi');
  }
  if (d.refetch) { e.preventDefault(); window.open(d.refetch, '_blank'); return; }
  if (d.howto !== undefined) { e.preventDefault(); await openSettings(); return; }
  if (d.copy) { navigator.clipboard?.writeText(d.copy); return toast(`${d.copy} kopyalandı`); }
  if (d.addcode !== undefined) {
    const code = prompt('Kod:');
    if (!code) return;
    const shop = (prompt('Mağaza (parfium / parfimo / notino):', 'notino') || '').toLowerCase().trim();
    const text = prompt('Not (indirim, son tarih…):', '') || '';
    S.myCodes.unshift({ id: 'my:' + uid(), code: code.trim().toUpperCase(), shop, text, firstSeen: new Date().toISOString() });
    save(); return render();
  }
  if (d.delcode) { S.myCodes = S.myCodes.filter((c) => c.id !== d.delcode); save(); return render(); }
  if (d.urladd) { addFromFragUrl(d.urladd, d.url); $('#fq-results').innerHTML = fragSearchResults(fragQuery); return; }
  if (d.debugcopy) {
    const f = S.frag[d.debugcopy];
    if (f?.debugBig) { try { await navigator.clipboard.writeText('\n\nAYRINTILI DÖKÜM:\n' + '`'.repeat(3) + 'json\n' + JSON.stringify(f.debugBig, null, 1) + '\n' + '`'.repeat(3)); toast('Döküm kopyalandı — GitHub’da yapıştır'); } catch {} }
    return; // link opens normally
  }
  if (d.copybmlong !== undefined) { try { await navigator.clipboard.writeText(openSettings.bmLong); toast('Uzun kod kopyalandı'); } catch { toast('Kopyalanamadı'); } return; }
  if (d.copybm !== undefined) {
    if (!openSettings.bm || openSettings.bm === '#') return toast('Kod yüklenemedi, internet bağlantısını kontrol edip Ayarlar’ı yeniden aç');
    try { await navigator.clipboard.writeText(openSettings.bm); toast('Yer imi kodu kopyalandı'); }
    catch { toast('Kopyalanamadı — “kodu göster”den elle kopyala'); }
    return;
  }
  if (d.theme) { S.theme = d.theme; save(); applyTheme(); return openSettings(); }
  if (d.export !== undefined) return exportData();
  if (d.notify !== undefined) {
    if (!('Notification' in window)) return toast('Bu tarayıcı bildirim desteklemiyor');
    const p = await Notification.requestPermission();
    S.notify = p === 'granted'; save();
    toast(S.notify ? 'Bildirimler açıldı' : 'İzin verilmedi');
    return openSettings();
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'fq') return;
  fragQuery = e.target.value;
  const id = fragIdFromUrl(fragQuery);
  $('#fq-go').href = id ? fragQuery.trim() : fragSearch(fragQuery.trim());
  $('#fq-go').textContent = id ? 'Aç ↗' : 'Ara ↗';
  $('#fq-results').innerHTML = fragSearchResults(fragQuery);
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'fq' && e.key === 'Enter' && fragQuery.trim()) { e.preventDefault(); $('#fq-go').click(); }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-import]') && e.target.files[0]) importData(e.target.files[0]);
});
$('#btn-settings').addEventListener('click', openSettings);
$('#btn-search').addEventListener('click', () => {
  const sb = $('#searchbar');
  sb.classList.toggle('hidden');
  if (!sb.classList.contains('hidden')) $('#q').focus();
  else { query = ''; $('#q').value = ''; render(); }
});
$('#q').addEventListener('input', (e) => { query = e.target.value.trim(); showCount = 60; render(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
window.addEventListener('hashchange', () => handleImport());

// ---------- boot ----------
// Telefon "masaüstü sitesi" modunda açılırsa (geniş sanal ekran) her şey küçük görünür: ölçekle.
function fitPhone() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dev = Math.min(screen.width, screen.height);
  const z = coarse && dev < 600 && innerWidth > dev * 1.3 ? innerWidth / dev : 1;
  document.documentElement.style.zoom = z > 1 ? z.toFixed(2) : '';
}

(async function boot() {
  fitPhone();
  applyTheme();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  await loadData();
  const imported = await handleImport();
  if (!imported) render();
  maybeNotify();
  S.lastVisit = new Date().toISOString();
  if (tab === 'codes') S.lastCodesVisit = S.lastVisit;
  save();
})();
