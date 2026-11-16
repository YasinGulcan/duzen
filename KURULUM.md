# Düzen – Kurulum (yaklaşık 10 dakika, tamamen ücretsiz)

Uygulama iki ücretsiz servisle çalışır:
- **Firebase**: veritabanı ve giriş (Google'ın ücretsiz Spark planı, kredi kartı istemez)
- **GitHub Pages**: sitenin yayınlandığı yer

Bilgisayarın kapalı olsa bile çalışır.

---

## 1) Firebase projesi
1. https://console.firebase.google.com → **Proje ekle** → isim: `duzen` → Google Analytics'i kapatabilirsin → Oluştur.
2. Proje ana sayfasında **`</>` (Web)** simgesine tıkla → takma ad `duzen` → **Uygulamayı kaydet**.
3. Gösterilen `firebaseConfig = { ... }` içindeki değerleri kopyala ve **`js/firebase-config.js`** dosyasındaki yer tutucuların yerine yapıştır.

## 2) Giriş yöntemini aç
- Sol menü **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**.

## 3) Veritabanını oluştur
1. **Build → Firestore Database → Create database**.
2. Konum: **europe-west** (ör. `europe-west3 Frankfurt`) → **Production mode** ile başlat.
3. **Rules** sekmesine geç. **`firestore.rules`** dosyasının tamamını oraya yapıştır.
4. En üstteki 3 e-postayı **sen ve 2 arkadaşının e-postalarıyla** değiştir (küçük harfle) → **Publish**.

## 4) GitHub Pages'te yayınla
1. https://github.com → hesabın yoksa aç → sağ üst **+ → New repository** → isim: `duzen` → **Public** → Create.
2. **"uploading an existing file"** bağlantısına tıkla → bu klasördeki **tüm dosya ve klasörleri** (index.html, style.css, js/, icons/, manifest.json, sw.js…) sürükle bırak → **Commit changes**.
3. Repo'da **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **(root)** → Save.
4. 1-2 dakika sonra adres çıkar: `https://KULLANICI_ADIN.github.io/duzen/`
5. Firebase'de **Authentication → Settings → Authorized domains → Add domain** → `KULLANICI_ADIN.github.io` ekle.

## 5) Kullanmaya başla
- Linki arkadaşlarına gönder. Herkes ilk girişte **"Hesap oluştur"** ile kural listesindeki e-postasıyla kaydolur.
- **iPhone:** Safari'de aç → Paylaş → **Ana Ekrana Ekle**.
- **Android:** Chrome'da aç → ⋮ → **Ana ekrana ekle / Uygulamayı yükle**.

---

## Güncelleme yaparken
Değişen dosyaları GitHub'a tekrar yükle (aynı isimle üzerine yazar). Telefonda uygulamayı kapatıp açınca yenisi gelir.

## Ücretsiz limitler
Firestore günde 50.000 okuma / 20.000 yazma veriyor. 3 kişi için bu limitin çok çok altında kalırsınız.

## Sorun giderme
- **"Kurulum gerekiyor" yazıyor** → `js/firebase-config.js` doldurulmamış.
- **"Erişim yok" yazıyor** → o e-posta `firestore.rules` listesinde yok ya da yazım farklı. Ekleyip tekrar Publish et.
- **Giriş "auth/unauthorized-domain" hatası** → 4.5. adımı yap.
