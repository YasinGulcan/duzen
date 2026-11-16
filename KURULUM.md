# Düzen

Arkadaşlarla günlük görev ve bırakma hedefi takibi.

- **Adres:** https://yasingulcan.github.io/duzen/
- **Veritabanı ve giriş:** Firebase projesi `duzen-3c0cd` (ücretsiz Spark planı)
- **Yayın:** GitHub Pages, repo `YasinGulcan/duzen`

## Kullanmaya başlamak
1. Adresi aç → **İlk kez mi? Hesap oluştur**.
2. Kullanıcı adı, şifre (en az 6 karakter) ve **grup kodunu** gir. Grup kodu yalnızca ilk kayıtta sorulur.
3. Telefona kur:
   - **iPhone:** Safari → Paylaş → **Ana Ekrana Ekle**
   - **Android:** Chrome → ⋮ → **Ana ekrana ekle**

Grup kodu repoda yazmaz, yalnızca Firebase kurallarında durur. Kodu sadece arkadaşlarınla paylaş.

## Bildirimler
- Uygulamada **Bildirimleri aç**'a dokun. iPhone'da önce Ana Ekrana Ekle, sonra uygulamayı ana ekrandan aç (iOS 16.4+).
- Gönderici GitHub Actions'ta (`.github/workflows/notify.yml`) 5 dakikada bir çalışır. GitHub bu zamanlamayı tam tutmaz; bildirimler 5-15 dakika gecikebilir.
- Gönderilenler: dürtme, kriz anı, destek mesajı, görevine gelen yorum, 21:00 hatırlatması, pazartesi 10:00 haftalık sonuç.
- Firebase servis anahtarı GitHub'da `FIREBASE_SERVICE_ACCOUNT` gizli değişkeninde durur. Yenilemek için Firebase → Proje ayarları → Hizmet hesapları → yeni anahtar oluştur, `gh secret set FIREBASE_SERVICE_ACCOUNT < dosya.json` ile yükle, dosyayı sil.
- Çalışma kayıtları: GitHub → repo → Actions → Bildirimler.

## iPhone Sağlık (adım sayısı)
Uygulamada profil → **iPhone Sağlık → Kur** adımlarını izle. Her kişiye özel gizli bir bağlantı oluşur; Kestirmeler bu bağlantıya adım sayısını yazar, GitHub Actions profile işler.

## Güncelleme yayınlamak
Dosyaları değiştirip `git push` yapınca GitHub Pages 1-2 dakikada yeni sürümü yayınlar.

## Grup kodunu değiştirmek
Firebase konsolu → Firestore → **Rules** → `request.resource.data.code == '...'` satırındaki kodu değiştir → **Publish**. Daha önce katılmış hesaplar etkilenmez.

## Şifre unutulursa
E-posta olmadığı için kendi kendine sıfırlama yok. Firebase konsolu → Authentication → Users → o kullanıcı → **Delete account**. Kişi aynı kullanıcı adıyla yeniden kayıt olur. Eski görev geçmişi Firestore'da kalır ama yeni hesaba bağlanmaz.

## Ücretsiz limitler
Firestore günde 50.000 okuma ve 20.000 yazma veriyor. Üç kişi bu limitin çok altında kalır.
