# Parfüm Defteri 🧴

Bir parfümsever için kişisel takip uygulaması (telefona kurulabilen web uygulaması / PWA).

- **Yeniler** — parfium.bg ve parfimo.bg'ye yeni eklenen parfümler her gün otomatik toplanır.
- **Kodlar** — mağazaların duyuru alanlarında / kampanya sayfalarında geçen indirim kodları (ör. `BF26`) yakalanır, bildirim gelir. Uygulamaya özel kodlar etiketlenir.
- **Koleksiyon** — elindeki parfümler: Fragrantica bağlantısı, kendi fotoğrafın, puanın ve notların.
- **Wishlist** — alınacaklar: fiyat notu, "dekant alabilirim", nereden, serbest not.
- **Kütüphane** — Fragrantica'dan aldığın parfümler: notalar (küçük resimlerle), ana akorlar, mevsim ve gündüz/gece ikonları, kalıcılık, sillage, cinsiyet, fiyat/performans, "şunu hatırlatıyor" listesi ve yorumlar. Fragrantica'ya gitmeden uygulamada görürsün; istersen küçük bağlantıyla gidebilirsin.

## Nasıl çalışır?

| Parça | Ne yapar |
|---|---|
| `scraper/` | Node betiği. `parfium.bg` (Shopify `products.json`), `parfimo.bg` ("Нов продукт" listesi, Playwright ile) ve kod taraması. |
| `.github/workflows/daily.yml` | Her gün 06:23 UTC'de çalışır, `docs/data/*.json`'u günceller, yeni ürün/kod varsa **GitHub issue açar** (GitHub mobil uygulaması telefona bildirim yollar) ve isteğe bağlı **Telegram** mesajı gönderir. |
| `docs/` | Uygulamanın kendisi (derleme gerektirmez). GitHub Pages ile yayınlanır. |
| `docs/capture.js` | Fragrantica yer imi (bookmarklet). Fragrantica'da açtığın parfüm sayfasındaki bilgileri uygulamaya aktarır. |

### Sınırlamalar (dürüstçe)

- **notino.bg** ve **fragrantica.com** otomatik erişime Cloudflare bot korumasıyla kapalı. Bu korumayı aşmaya çalışmıyoruz.
  - Notino için uygulama, yeni ürünler sayfasına doğrudan bağlantı gösterir; kodları "Kod ekle" ile kendin kaydedebilirsin.
  - Fragrantica verisi bu yüzden **senin tarayıcında**, senin açtığın sayfadan yer imiyle alınır (kişisel kullanım). Bağlantıyı yapıştırınca şişe fotoğrafı hemen gelir.
- Kişisel veriler (koleksiyon, wishlist, Fragrantica kayıtları) cihazın tarayıcısında saklanır. Ayarlar → Dışa/İçe aktar ile başka cihaza taşınır.

## Kurulum (bir kez)

1. Bu dalı `main`'e birleştir (zamanlanmış görevler yalnızca varsayılan dalda çalışır).
2. **Settings → Pages** → *Deploy from a branch* → `main` / `/docs`. Uygulama adresi: `https://<kullanıcı>.github.io/<repo>/`
3. **Actions** sekmesinde "Günlük parfüm takibi" → *Run workflow* ile ilk çalıştırmayı yap.
4. Telefonda adresi aç → *Ana ekrana ekle*.
5. Uygulamada **Ayarlar → Fragrantica yer imi**'ni kur.
6. (İsteğe bağlı) Telegram bildirimi: @BotFather ile bot oluştur, **Settings → Secrets → Actions**'a `TELEGRAM_BOT_TOKEN` ve `TELEGRAM_CHAT_ID` ekle.

> Not: GitHub Pages özel (private) depolarda ücretli plan gerektirir; depo herkese açıksa ücretsizdir.

## Yerelde çalıştırma

```bash
cd scraper && npm install && npx playwright install chromium
node run.mjs          # docs/data/*.json üretir
cd ../docs && python3 -m http.server 8000   # http://localhost:8000
```
