# Finance Smoke Checklist

Bu liste, `muhasebe` rolü ile masaustu uygulamasinda canli oncesi son kontrol turu icin hazirlandi.

## Test Hesabi

- Rol: `muhasebe`
- Kullanici: `muhasebe.selim`

## 1. Muhasebe Ozet

- `Muhasebe Ozet` ekranini ac.
- KPI kartlarinin kaymadan, ayni yukseklikte ve duzgun grid ile gorundugunu kontrol et.
- `Son Tahsilatlar` listesinden bir kayda tikla.
- Beklenen:
  - detay dialogu acilir
  - ogrenci adi, belge no, odeme yontemi, zaman, not gorulur
  - tutar dogru formatta gorulur
- `Geciken Odemeler` alanindaki `Tahsilat Al` butonuna tikla.
- Beklenen:
  - `/finance/collections` ekranina gider

## 2. Ogrenci Cari Hesaplari

- `Ogrenci Hesaplari` ekranini ac.
- Bir ogrenci satirina tikla.
- Beklenen:
  - drawer acilir
  - hesap hareketleri listelenir
  - toplam ucret / odenen / bakiye kartlari gorulur
- `Tahsilat Gir` tikla.
- Beklenen:
  - backend collection kaydi olusur
  - toast basarili olur
  - yeniden acildiginda tahsilat hareketi listede gorunur
- `Ekstre Indir` tikla.
- Beklenen:
  - HTML belge indirilir
  - belge tasarimli gorunur
- `Yazdir` tikla.
- Beklenen:
  - yazdirilabilir belge penceresi acilir

## 3. Tahsilatlar

- `Tahsilatlar` ekranini ac.
- `Yeni Tahsilat` ile yeni kayit olustur.
- Beklenen:
  - kayit tabloda gorunur
  - toplam kartlari guncellenir
- Bir satirdaki detay ikonuna tikla.
- Beklenen:
  - profesyonel detay dialogu acilir
- `Disa Aktar` tikla.
- Beklenen:
  - CSV dosyasi iner
  - HTML ozet dosyasi da iner

## 4. Fatura ve Makbuz

- `Fatura & Makbuz` ekranini ac.
- `Yeni Fatura` ile bir kayit olustur.
- Beklenen:
  - fatura listesine dusmesi
- Bir fatura icin:
  - `Gor`
  - `Indir`
  - `Yazdir`
  aksiyonlarini dene.
- Beklenen:
  - detay dialogu acilir
  - indir tasarimli HTML belge uretir
  - yazdir belge penceresi acar
- `Toplu Yazdir` dene.
- Beklenen:
  - toplu belge gorunumu acilir
- `Excel` dene.
- Beklenen:
  - uygun CSV dosyasi iner

## 5. Taksitler

- `Taksitler` ekranini ac.
- `Yeni Plan` ile bir taksit olustur.
- Beklenen:
  - yeni satir listede gorunur
- Bir satira tikla.
- Beklenen:
  - `Tahsilat Takvimi` ekranina gider

## 6. Tahsilat Takvimi

- `Tahsilat Takvimi` ekranini ac.
- `Gunluk / Haftalik / Aylik` sekmeleri arasinda gec.
- Beklenen:
  - gruplama degisir
  - kayitlar periyot bazli listelenir
- Herhangi bir `Detaya Git` butonuna tikla.
- Beklenen:
  - `Tahsilatlar` ekranina gider

## 7. Mutabakat

- `Mutabakat` ekranini ac.
- Beklenen:
  - oran kartlari
  - acik fark
  - eslesme listesi
  gorunur
- Liste bos olmamali; veri yoksa yine duzgun bos durum lazim.

## 8. Toplu Islemler

- `Toplu Islemler` ekranini ac.
- `Toplu Hatirlatma Gonder` tikla.
- Beklenen:
  - secili/geciken kayitlar icin backend notification akisi calisir
  - basarili toast gorulur

## 9. Audit Log

- `Audit Log` ekranini ac.
- Beklenen:
  - tahsilat / fatura / onay olaylari timeline gibi listelenir
  - kartlar profesyonel ve okunakli gorunur

## 10. Indirim ve Burs

- `Indirim & Burs` ekranini ac.
- `Yeni Tanim` tikla.
- Beklenen:
  - secili sekmeye gore yeni profil olusur
  - backend persistence calisir
  - sayfa yenilendiginde profil korunur

## 11. Gecikenler

- `Gecikenler` ekranini ac.
- `Excel Indir` tikla.
- Beklenen:
  - CSV iner
- Bir satira tikla.
- Beklenen:
  - `Ogrenci Hesaplari` ekranina gider
- Satirdaki zil ikonuna tikla.
- Beklenen:
  - reminder notification akisi calisir

## 12. Disa Aktar

- `Disa Aktar` ekranini ac.
- farkli rapor turleri sec
- CSV ve Metin Raporu modlari arasinda gec
- Beklenen:
  - onizleme alani secime gore degisir
  - `Disa Aktar` gercekten dosya indirir

## 13. Mesajlar

- `Mesajlar` ekranini ac.
- farkli kullanici thread'lerini kontrol et
- yeni mesaj gonder
- Beklenen:
  - mesajlar backend uzerinden gercek thread yapisinda akar
  - thread detaylari gorunur
  - finans rolu sadece ilgili thread'leri gorur

## Canli Oncesi Son Karar

Asagidaki 4 madde temiz degilse canliya cikma:

- belge indirme ve yazdirma aksiyonlari sorunsuz mu
- backend persistence olan akislarda yeniden acinca veri koraniyor mu
- finance menusu icinde artik `Onaylar` gorunmuyor mu
- finance kullanicisi gercek mesajlasma akisinda hata almiyor mu
