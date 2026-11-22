/* Parfüm Defteri — Fragrantica yakalayıcı (bookmarklet).
   Fragrantica'da bir parfüm sayfasındayken çalıştırılır: sayfadaki notaları, akorları,
   mevsim / gündüz-gece oylarını, kalıcılık, iz, cinsiyet, fiyat/performans oylarını,
   "şunu hatırlatıyor" listesini ve yorumları okur; uygulamaya aktarır.
   Yalnızca sizin tarayıcınızda, sizin açtığınız sayfada çalışır. */
(async function () {
  var APP = '__APP_URL__';
  /* Kısa yükleyici ile <script src=".../capture.js"> olarak yüklendiyse adres betiğin kendi konumundan gelir */
  if (APP.charAt(0) === '_' && document.currentScript) APP = new URL('./', document.currentScript.src).href;
  var note = document.getElementById('pd-note') || document.createElement('div');
  note.id = 'pd-note';
  note.textContent = 'Parfüm Defteri: bilgiler okunuyor…';
  note.setAttribute('style', 'position:fixed;left:12px;right:12px;top:12px;z-index:2147483647;background:#9b5a7a;color:#fff;font:600 16px/1.4 sans-serif;padding:14px 16px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.3);text-align:center');
  document.body.appendChild(note);
  try {
  var d = document;
  var txt = function (el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var abs = function (u) { try { return new URL(u, location.href).href; } catch (e) { return u; } };
  var num = function (s) { var m = String(s || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };

  var idm = location.pathname.match(/\/perfume\/[^/]+\/.+-(\d+)\.html/);
  if (!/fragrantica\./.test(location.hostname) || !idm) {
    note.textContent = 'Lütfen Fragrantica\'da bir parfüm sayfası açıp tekrar deneyin.';
    setTimeout(function () { note.remove(); }, 4000);
    return;
  }

  var data = { v: 1, id: idm[1], url: location.href.split('#')[0].split('?')[0], capturedAt: new Date().toISOString() };

  /* --- Başlık, marka, görsel --- */
  var h1 = $('h1[itemprop="name"]') || $('h1');
  data.title = txt(h1);
  data.brand = txt($('[itemprop="brand"] [itemprop="name"]')) || txt($('[itemprop="brand"]'));
  var parts = location.pathname.split('/');
  if (!data.brand) data.brand = decodeURIComponent(parts[2] || '').replace(/-/g, ' ');
  data.name = decodeURIComponent((parts[3] || '').replace(/-\d+\.html$/, '')).replace(/-/g, ' ');
  if (data.title) {
    var t = data.title.replace(/\s+for\s+(women and men|women|men)\s*$/i, '');
    if (data.brand && t.toLowerCase().endsWith(data.brand.toLowerCase())) t = t.slice(0, -data.brand.length).trim();
    if (t) data.name = t;
    var g = data.title.match(/for (women and men|women|men)\s*$/i);
    if (g) data.genderLabel = g[1].toLowerCase();
  }
  var img = $('img[itemprop="image"]') || $('img[src*="fimgs.net/mdimg/perfume/"]');
  data.image = img ? abs(img.getAttribute('src')) : 'https://fimgs.net/mdimg/perfume/375x500.' + data.id + '.jpg';
  data.rating = num(txt($('[itemprop="ratingValue"]')));
  data.ratingCount = num(txt($('[itemprop="ratingCount"]')));
  var desc = $('[itemprop="description"]');
  data.description = txt(desc).slice(0, 1200);
  var y = data.description.match(/launched in (\d{4})/i);
  if (y) data.year = +y[1];
  data.perfumers = $$('a[href*="/noses/"]').map(txt).filter(function (s, i, a) { return s && a.indexOf(s) === i; }).slice(0, 4);

  /* --- Ana akorlar --- */
  data.accords = $$('.accord-bar').map(function (el) {
    var st = el.getAttribute('style') || '';
    var w = st.match(/width:\s*([\d.]+)%/);
    var bg = st.match(/background(?:-color)?:\s*([^;]+)/);
    return { name: txt(el), width: w ? +w[1] : null, color: bg ? bg[1].trim() : null };
  }).filter(function (a) { return a.name; }).slice(0, 12);

  /* --- Nota piramidi --- */
  var noteFrom = function (a) {
    var im = $('img', a);
    var name = (im && (im.getAttribute('alt') || im.getAttribute('title'))) || txt(a) || txt(a.parentElement);
    return { name: (name || '').trim(), img: im ? abs(im.getAttribute('src') || im.getAttribute('data-src')) : null, url: a.href };
  };
  var pyramid = $('#pyramid') || d.body;
  var notes = { top: [], middle: [], base: [], all: [] };
  var heads = $$('h4, h3, b, strong', pyramid).filter(function (h) { return /^(top|middle|heart|base) notes$/i.test(txt(h)); });
  if (heads.length) {
    heads.forEach(function (h, i) {
      var key = /top/i.test(txt(h)) ? 'top' : /base/i.test(txt(h)) ? 'base' : 'middle';
      var el = h.nextElementSibling, guard = 0;
      while (el && guard++ < 4 && !$$('a[href*="/notes/"]', el).length) el = el.nextElementSibling;
      if (el) notes[key] = $$('a[href*="/notes/"]', el).map(noteFrom);
    });
  }
  if (!notes.top.length && !notes.middle.length && !notes.base.length) {
    notes.all = $$('a[href*="/notes/"]', pyramid).filter(function (a) { return $('img', a); }).map(noteFrom);
  }
  /* Yedek yöntem: nota resimleri (fimgs.net/.../sastojci/) — bağlantı içinde olmasalar da bulunur;
     her resim, belgede kendinden önce gelen "Top/Middle/Base Notes" başlığına atanır. */
  if (!notes.top.length && !notes.middle.length && !notes.base.length && !notes.all.length) {
    var heads2 = $$('h2, h3, h4, h5, h6, b, strong, span, div, p').filter(function (h) {
      return h.children.length <= 1 && /^\s*(top|middle|heart|base) notes\s*$/i.test(txt(h));
    });
    var levelOf = function (el) {
      var lvl = null;
      heads2.forEach(function (h) {
        if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
          lvl = /top/i.test(txt(h)) ? 'top' : /base/i.test(txt(h)) ? 'base' : 'middle';
        }
      });
      return lvl || 'all';
    };
    $$('img').filter(function (im) { return /\/sastojci\//.test(im.getAttribute('src') || im.getAttribute('data-src') || ''); }).forEach(function (im) {
      var a = im.closest('a');
      var holder = im.parentElement;
      var name = im.getAttribute('alt') || im.getAttribute('title') || txt(a) || txt(holder) || txt(holder && holder.parentElement);
      notes[levelOf(im)].push({ name: (name || '').trim(), img: abs(im.getAttribute('src') || im.getAttribute('data-src')), url: a ? a.href : null });
    });
  }
  var dedupe = function (arr) { var s = {}; return arr.filter(function (n) { if (!n.name || s[n.name]) return false; s[n.name] = 1; return true; }); };
  ['top', 'middle', 'base', 'all'].forEach(function (k) { notes[k] = dedupe(notes[k]).slice(0, 30); });
  data.notes = notes;

  /* --- Mevsim / gündüz-gece çubukları (etiket metnine en yakın genişlik çubuğu) --- */
  var barFor = function (label) {
    var cands = $$('span, div, p, small').filter(function (e) { return e.children.length === 0 && txt(e).toLowerCase() === label; });
    for (var i = 0; i < cands.length; i++) {
      var p = cands[i];
      for (var up = 0; up < 4 && p; up++) {
        p = p.parentElement;
        if (!p) break;
        var bars = $$('[style*="width"]', p).filter(function (b) { return /width:\s*[\d.]+%/.test(b.getAttribute('style')); });
        if (bars.length === 1) return +bars[0].getAttribute('style').match(/width:\s*([\d.]+)%/)[1];
      }
    }
    return null;
  };
  data.seasons = { winter: barFor('winter'), spring: barFor('spring'), summer: barFor('summer'), fall: barFor('fall') };
  data.time = { day: barFor('day'), night: barFor('night') };

  /* --- Oy grupları: kalıcılık, iz, cinsiyet, fiyat/performans, duygu --- */
  var GROUPS = {
    sentiment: ['love', 'like', 'ok', 'dislike', 'hate'],
    longevity: ['very weak', 'weak', 'moderate', 'long lasting', 'eternal'],
    sillage: ['intimate', 'moderate', 'strong', 'enormous'],
    gender: ['female', 'more female', 'unisex', 'more male', 'male'],
    price: ['way overpriced', 'overpriced', 'ok', 'good value', 'great value']
  };
  var votes = {};
  var names = $$('.vote-button-name');
  var cur = null;
  names.forEach(function (n) {
    var label = txt(n).toLowerCase();
    var holder = n.closest('tr') || n.parentElement && n.parentElement.parentElement || n.parentElement;
    var legend = holder ? $('.vote-button-legend', holder) : null;
    var count = legend ? num(txt(legend)) : null;
    /* yeni grup: bu etiket, henüz başlamamış bir grubun ilk etiketi ise */
    var start = Object.keys(GROUPS).filter(function (g) { return GROUPS[g][0] === label && !votes[g]; })[0];
    var fitsCur = cur && GROUPS[cur].indexOf(label) > -1 && votes[cur][label] === undefined;
    if (start && !fitsCur) { cur = start; votes[cur] = {}; }
    if (cur && GROUPS[cur].indexOf(label) > -1 && votes[cur][label] === undefined) votes[cur][label] = count;
    else cur = null;
  });
  data.votes = votes;

  /* --- "Bu parfüm şunu hatırlatıyor" --- */
  var similarFrom = function (headRe) {
    var head = $$('h2, h3, h4, h5, b, strong, span').find(function (e) { return headRe.test(txt(e)) && txt(e).length < 60; });
    if (!head) return [];
    var box = head.parentElement, guard = 0;
    while (box && guard++ < 4 && $$('a[href*="/perfume/"] img', box).length < 1) box = box.parentElement;
    if (!box) return [];
    var seen = {};
    return $$('a[href*="/perfume/"]', box).map(function (a) {
      var m = a.getAttribute('href').match(/-(\d+)\.html/);
      if (!m || m[1] === data.id || seen[m[1]]) return null;
      var im = $('img', a);
      var label = ((im && (im.getAttribute('alt') || im.getAttribute('title'))) || txt(a) || '').replace(/^perfume\s+/i, '');
      if (!im && !label) return null;
      seen[m[1]] = 1;
      return { id: m[1], name: (label || '').trim(), url: abs(a.getAttribute('href')), img: im ? abs(im.getAttribute('src') || im.getAttribute('data-src')) : 'https://fimgs.net/mdimg/perfume/375x500.' + m[1] + '.jpg' };
    }).filter(Boolean).slice(0, 16);
  };
  data.remindsOf = similarFrom(/reminds me of/i);
  data.alsoLike = similarFrom(/people who like this also like/i);

  /* --- Yorumlar --- */
  var boxes = $$('.fragrance-review-box');
  if (!boxes.length) boxes = $$('[itemprop="review"]');
  data.reviews = boxes.map(function (b) {
    var body = $('[itemprop="reviewBody"]', b) || b;
    return {
      author: txt($('[itemprop="author"]', b)) || txt($('b', b)),
      date: txt($('[itemprop="datePublished"]', b)),
      text: txt(body).slice(0, 900)
    };
  }).filter(function (r) { return r.text.length > 20; }).slice(0, 10);

  /* --- Tanı bilgisi: eksik bölümlerin sayfa yapısını görmek için küçük HTML parçaları --- */
  var snip = function (re) {
    var el = $$('h1, h2, h3, h4, h5, h6, span, b, strong, div, p, td, a').find(function (e) { return e.children.length <= 2 && re.test(txt(e)) && txt(e).length < 80; });
    if (!el) return null;
    var box = (el.parentElement && el.parentElement.parentElement) || el;
    return box.outerHTML.replace(/\s+/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 1400);
  };
  data.debug = {
    ua: navigator.userAgent.slice(0, 120),
    counts: {
      notesLinks: $$('a[href*="/notes/"]').length, noteImgs: $$('img[src*="sastojci"], img[data-src*="sastojci"]').length,
      voteNames: $$('.vote-button-name').length, voteLegends: $$('.vote-button-legend').length,
      reviewBoxes: $$('.fragrance-review-box').length, itempropReview: $$('[itemprop="review"]').length, pyramid: !!$('#pyramid')
    },
    notes: snip(/^(top notes|middle notes|base notes|fragrance notes|perfume pyramid)$/i),
    longevity: snip(/^longevity$/i), sillage: snip(/^sillage$/i), price: snip(/^price value$/i),
    gender: snip(/^gender$/i), reminds: snip(/reminds me of/i), reviews: snip(/^(all reviews|perfume reviews|reviews)/i)
  };

  /* --- Uygulamaya gönder (sıkıştırılmış, URL hash ile) --- */
  var json = JSON.stringify(data);
  var payload;
  try {
    var cs = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    var buf = new Uint8Array(await new Response(cs).arrayBuffer());
    var bin = '';
    for (var i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    payload = 'z' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    payload = 'j' + encodeURIComponent(json);
  }
  var url = APP + '#fimport=' + payload;
  note.textContent = 'Parfüm Defteri açılıyor… (' + (data.accords || []).length + ' akor, ' +
    ['top', 'middle', 'base', 'all'].reduce(function (n, k) { return n + ((data.notes || {})[k] || []).length; }, 0) + ' nota)';
  location.href = url;
  } catch (err) {
    note.style.background = '#b3261e';
    note.textContent = 'Parfüm Defteri hatası: ' + (err && err.message || err);
  }
})();
