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

  /* --- Sayfayı aşağı kaydır: yeni tasarım bazı bölümleri (oylar, hatırlatanlar, yorumlar) görünür olunca yüklüyor --- */
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var startY = window.scrollY;
  for (var step = 0; step < 30; step++) {
    var before = window.scrollY;
    window.scrollBy(0, Math.round(window.innerHeight * 0.9));
    note.textContent = 'Parfüm Defteri: sayfa taranıyor… ' + Math.min(99, Math.round(100 * (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight)) + '%';
    await wait(350);
    if (window.scrollY === before) break;
  }
  await wait(800);
  window.scrollTo(0, startY);
  note.textContent = 'Parfüm Defteri: bilgiler okunuyor…';

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
  /* Şişe fotoğrafı: Fragrantica'nın sabit adresi (perfume/375x500.<id>.jpg) en güvenilir olanı.
     Sayfadaki ilk resim yeni tasarımda boş yer tutucu ya da başka bir parfüm olabiliyor. */
  data.image = 'https://fimgs.net/mdimg/perfume/375x500.' + data.id + '.jpg';
  data.rating = num(txt($('[itemprop="ratingValue"]')));
  data.ratingCount = num(txt($('[itemprop="ratingCount"]')));
  var desc = $('[itemprop="description"]');
  data.description = txt(desc).slice(0, 1200);
  var y = data.description.match(/launched in (\d{4})/i);
  if (y) data.year = +y[1];
  data.perfumers = $$('a[href*="/noses/"]').map(txt).filter(function (s, i, a) { return s && a.indexOf(s) === i; }).slice(0, 4);

  /* Genel yardımcılar (yeni tasarım: sınıf adlarına değil, görünen yazıya göre bul) */
  var leafWith = function (re, maxLen) {
    return $$('body *').filter(function (e) {
      if (e.closest('#pd-note')) return false;
      var own = Array.prototype.map.call(e.childNodes, function (n) { return n.nodeType === 3 ? n.textContent : ''; }).join(' ').replace(/\s+/g, ' ').trim();
      return own && own.length <= (maxLen || 60) && re.test(own);
    });
  };
  var widthOf = function (el) { var m = (el.getAttribute && el.getAttribute('style') || '').match(/width:\s*([\d.]+)%/); return m ? +m[1] : null; };

  /* --- Ana akorlar --- */
  data.accords = $$('.accord-bar').map(function (el) {
    var st = el.getAttribute('style') || '';
    var w = st.match(/width:\s*([\d.]+)%/);
    var bg = st.match(/background(?:-color)?:\s*([^;]+)/);
    return { name: txt(el), width: w ? +w[1] : null, color: bg ? bg[1].trim() : null };
  }).filter(function (a) { return a.name; }).slice(0, 12);

  if (!data.accords.length) {
    var ah = leafWith(/^main accords$/i)[0];
    var abox = ah, ag = 0;
    while (abox && ag++ < 6 && $$('[style*="width"]', abox).filter(function (b) { return widthOf(b) != null && txt(b); }).length < 2) abox = abox.parentElement;
    if (abox) {
      data.accords = $$('[style*="width"]', abox).map(function (el) {
        var st = el.getAttribute('style') || '';
        var bg = st.match(/background(?:-color)?:\s*([^;]+)/);
        return { name: txt(el), width: widthOf(el), color: bg ? bg[1].trim() : null };
      }).filter(function (a) { return a.name && a.width != null && a.name.length < 30; }).slice(0, 12);
    }
  }

  /* --- Nota piramidi --- */
  var slugName = function (href) {
    var m = String(href || '').match(/\/notes\/(.+?)-\d+\.html/);
    return m ? decodeURIComponent(m[1]).replace(/-/g, ' ') : '';
  };
  var noteFrom = function (a) {
    var im = $('img', a) || (a.parentElement && $('img', a.parentElement));
    var name = (im && (im.getAttribute('alt') || im.getAttribute('title'))) || txt(a) || slugName(a.getAttribute('href')) || txt(a.parentElement);
    var nid = String(a.getAttribute('href') || '').match(/-(\d+)\.html/);
    var src = im ? (im.getAttribute('src') || im.getAttribute('data-src') || '') : '';
    if (!/sastojci|fimgs/.test(src) && nid) src = 'https://fimgs.net/mdimg/sastojci/t.' + nid[1] + '.jpg';
    return { name: (name || '').trim().slice(0, 40), img: src ? abs(src) : null, url: a.href };
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
      var name = im.getAttribute('alt') || im.getAttribute('title') || txt(a) || (a && slugName(a.getAttribute('href'))) || txt(holder) || txt(holder && holder.parentElement);
      notes[levelOf(im)].push({ name: (name || '').trim(), img: abs(im.getAttribute('src') || im.getAttribute('data-src')), url: a ? a.href : null });
    });
  }
  if (!notes.top.length && !notes.middle.length && !notes.base.length && !notes.all.length) {
    var heads3 = leafWith(/^(top|middle|heart|base) notes$/i, 20);
    $$('a[href*="/notes/"]').forEach(function (a) {
      if (a.closest('[itemprop="description"]')) return;
      var lvl = 'all';
      heads3.forEach(function (h) { if (h.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) lvl = /top/i.test(txt(h)) ? 'top' : /base/i.test(txt(h)) ? 'base' : 'middle'; });
      notes[lvl].push(noteFrom(a));
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
  /* Yedek: etiket yazısının bulunduğu satırda sayı (oy adedi) ya da genişlik (%) ara */
  Object.keys(GROUPS).forEach(function (g) {
    if (votes[g] && Object.keys(votes[g]).length >= GROUPS[g].length - 1) return;
    var titleRe = { sentiment: /^(rating|how do you like|what do you think)/i, longevity: /^longevity/i, sillage: /^sillage/i, gender: /^gender/i, price: /^price value/i }[g];
    var head = leafWith(titleRe, 40)[0];
    var scope = head, sg = 0;
    while (scope && sg++ < 5 && leafWith(new RegExp('^' + GROUPS[g][1] + '$', 'i')).filter(function (e) { return scope.contains(e); }).length < 1) scope = scope.parentElement;
    if (!scope) return;
    var out = {}, found = 0;
    GROUPS[g].forEach(function (label) {
      /* Aynı yazı birden çok yerde olabilir (ör. kaydırıcının uçlarındaki "female … male" etiketleri):
         sayı/çubuk bulunana kadar tüm eşleşmeleri sırayla dene. */
      var els = leafWith(new RegExp('^' + label.replace(/ /g, '\\s+') + '$', 'i'), 30).filter(function (e) { return scope.contains(e) && !e.closest('[class*="slider"]'); });
      var val = null;
      var others = GROUPS[g].filter(function (o) { return o !== label; });
      for (var ei = 0; ei < els.length && val == null; ei++) {
      var row = els[ei];
      for (var up = 0; up < 3 && row && val == null; up++) {
        row = row.parentElement;
        if (!row) break;
        var rowText = txt(row).toLowerCase();
        var clash = others.some(function (o) { return new RegExp('(^|[^a-z])' + o + '([^a-z]|$)').test(rowText.replace(new RegExp('(^|[^a-z])' + label + '([^a-z]|$)'), ' ')); });
        if (clash) break;
        var nums = $$('*', row).filter(function (x) { return x.children.length === 0 && /^\d[\d,.]*(k|%)?$/i.test(txt(x)); });
        if (nums.length === 1) { var t = txt(nums[0]).replace(/,/g, '').replace('%', ''); val = /k$/i.test(t) ? parseFloat(t) * 1000 : parseFloat(t); }
        else { var bars = $$('[style*="width"]', row).filter(function (b) { return widthOf(b) != null && !b.closest('[class*="slider"]'); }); if (bars.length === 1) val = widthOf(bars[0]); }
      }
      }
      if (val != null) { out[label] = val; found++; }
    });
    if (found >= 2) votes[g] = out;
  });
  data.votes = votes;

  /* --- "Bu parfüm şunu hatırlatıyor" --- */
  var similarFrom = function (headRe) {
    var head = $$('h2, h3, h4, h5, b, strong, span').find(function (e) { return headRe.test(txt(e)) && txt(e).length < 60; }) || leafWith(headRe, 80)[0];
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
  /* Yeni tasarımda yorumlar [itemprop="review"] kartlarında; eski .fragrance-review-box boş kalabiliyor.
     İç içe review öğelerinden yalnızca en dıştakileri al. */
  var boxes = $$('[itemprop="review"]').filter(function (b) { return !(b.parentElement && b.parentElement.closest('[itemprop="review"]')); });
  if (!boxes.length) boxes = $$('.fragrance-review-box');
  var seenRv = {};
  data.reviews = boxes.map(function (b) {
    var body = $('[itemprop="reviewBody"]', b) || $('[itemprop="description"]', b) || b;
    var au = $('[itemprop="author"] [itemprop="name"]', b) || $('[itemprop="author"]', b) || $('a[href*="/member/"]', b) || $('b', b);
    var dt = $('[itemprop="datePublished"]', b) || $('time', b);
    var t = txt(body);
    if (seenRv[t.slice(0, 80)]) return { text: '' };
    seenRv[t.slice(0, 80)] = 1;
    return {
      author: au ? (au.getAttribute('content') || txt(au)).slice(0, 40) : '',
      date: dt ? (dt.getAttribute('content') || dt.getAttribute('datetime') || txt(dt)).slice(0, 20) : '',
      text: t.slice(0, 900)
    };
  }).filter(function (r) { return r.text.length > 20; }).slice(0, 15);

  if (!data.reviews.length) {
    var rh = leafWith(/(^|\s)reviews?\b/i, 60).filter(function (h) { return !/perfumes:|members:/i.test(txt(h.parentElement || h)); });
    var descEl = $('[itemprop="description"]');
    var seenT = {};
    /* en alttaki "reviews" başlığından başla; ardından metin bloğu yoksa bir yukarıdakini dene */
    var candidatesAfter = function (startEl) { return $$('p, div, span').filter(function (e) {
      if (!(startEl.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      if (descEl && descEl.contains(e)) return false;
      if (e.closest('#pd-note')) return false;
      var t = txt(e);
      if (t.length < 120 || t.length > 4000) return false;
      /* en içteki metin bloğu: kendisi kadar uzun metin taşıyan bir çocuğu olmasın */
      return !Array.prototype.some.call(e.children, function (c) { return txt(c).length > t.length * 0.8; });
    }); };
    var cands = [];
    for (var ri = rh.length - 1; ri >= 0 && !cands.length; ri--) cands = candidatesAfter(rh[ri]);
    data.reviews = cands.map(function (e) {
      var card = e, g = 0;
      while (card.parentElement && g++ < 4 && !$('a[href*="/member/"]', card)) card = card.parentElement;
      var au = $('a[href*="/member/"]', card);
      var tm = $('time', card);
      return { author: txt(au), date: tm ? (tm.getAttribute('datetime') || txt(tm)) : '', text: txt(e).slice(0, 900) };
    }).filter(function (r) { if (seenT[r.text.slice(0, 60)]) return false; seenT[r.text.slice(0, 60)] = 1; return true; }).slice(0, 10);
  }

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
    reviewsHeads: leafWith(/reviews?\b/i, 80).map(function (e) { return txt(e).slice(0, 60); }).slice(0, 12)
  };

  var skeleton = function (re, last) {
    var els = leafWith(re, 80).filter(function (e) { return !/members:|online:/i.test(txt(e.parentElement && e.parentElement.parentElement || e)); });
    var el = last ? els[els.length - 1] : els[0];
    if (!el) return null;
    var box = el, g = 0;
    while (box.parentElement && g++ < 8 && box.parentElement.outerHTML.length < 6000) box = box.parentElement;
    var c = box.cloneNode(true);
    $$('svg, script, style, noscript, iframe', c).forEach(function (x) { x.replaceWith(document.createTextNode('')); });
    $$('*', c).forEach(function (x) { var cl = x.getAttribute('class'); if (cl && cl.length > 50) x.setAttribute('class', cl.slice(0, 50)); });
    return c.outerHTML.replace(/\s+/g, ' ').replace(/ (class|style)=""/g, '').slice(0, 3500);
  };
  data.debugBig = {
    accords: skeleton(/^main accords$/i), longevity: skeleton(/^longevity/i), sillage: skeleton(/^sillage/i),
    gender: skeleton(/^gender/i), price: skeleton(/^price value/i), reminds: skeleton(/reminds me of/i),
    rating: skeleton(/^(rating|perfume rating)/i), reviews: skeleton(/reviews?\b/i, true),
    reviewText: (function () {
      var desc = $('[itemprop="description"]');
      var longs = $$('p, div').filter(function (e) { return e.children.length <= 2 && txt(e).length > 200 && !(desc && desc.contains(e)) && !e.closest('#pd-note'); });
      return longs.slice(-2).map(function (r) { var box = r.parentElement && r.parentElement.parentElement || r; return box.outerHTML.replace(/\s+/g, ' ').slice(0, 3000); });
    })()
  };

  data.debugBig.review1 = boxes[0] ? boxes[0].outerHTML.replace(/\s+/g, ' ').slice(0, 3000) : null;

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
