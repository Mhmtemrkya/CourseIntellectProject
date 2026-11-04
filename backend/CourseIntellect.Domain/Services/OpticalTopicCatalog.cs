using System.Globalization;
using System.Text;

namespace CourseIntellect.Domain.Services;

/// <summary>Konu listesinde bir başlık (ünite / tema / alt test) ve altındaki konular.</summary>
public sealed record OpticalTopicUnit(string Label, IReadOnlyList<string> Topics);

/// <summary>
/// Optik deneme cevap anahtarında soru konusu seçimi için hazır konu kataloğu (seviye × ders).
/// Konu analizi konuları adıyla topladığı için aynı konu her denemede aynı yazılmalıdır; liste bunu sağlar.
/// Kurum listede olmayan konuyu kendi listesine ekleyebilir ya da yalnız o soruya serbest yazabilir.
///
/// Kapsam (2026-2027 öğretim yılı):
/// • 5, 6, 7. sınıf: Türkiye Yüzyılı Maarif Modeli programları. Tema/ünite adları MEB TYMM sayfalarından
///   (tymm.meb.gov.tr/ogretim-programlari: ortaokul-matematik-dersi, fen-bilimleri-dersi, sosyal-bilgiler-dersi);
///   konular deneme sınavlarında kullanılan konu düzeyindedir.
/// • 8. sınıf / LGS: 8. sınıf 2026-2027'de Maarif programına geçmedi; LGS 2027 mevcut 8. sınıf programından sorulur.
/// • TYT / AYT / YDT: YKS 2027 adayları (12. sınıf / mezun) mevcut ortaöğretim programından sorumludur
///   (Maarif etkisi ilk kez YKS 2028'de beklenir). Konular ÖSYM test kapsamı ve yaygın konu dağılımı tablolarına göredir.
/// Kazanım düzeyine inilmez; analiz için konu düzeyi yeterli ve kararlıdır.
/// </summary>
public static class OpticalTopicCatalog
{
    public static readonly IReadOnlyList<(string Key, string Label)> Levels =
    [
        ("5", "5. sınıf"),
        ("6", "6. sınıf"),
        ("7", "7. sınıf"),
        ("LGS", "8. sınıf (LGS)"),
        ("TYT", "TYT"),
        ("AYT", "AYT"),
        ("YDT", "YDT"),
    ];

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    public static bool IsLevel(string? key) => Levels.Any(level => level.Key == key);

    public static string LevelLabel(string key) => Levels.FirstOrDefault(level => level.Key == key).Label ?? key;

    /// <summary>
    /// Bir dersin konuları. Seviye boşsa dersin bulunduğu bütün seviyeler döner (başlıklar "LGS · …" biçiminde).
    /// Aynı ders görünümünde aynı konu (harf katlamalı) bir kez yer alır.
    /// </summary>
    public static IReadOnlyList<OpticalTopicUnit> For(string? level, string subject)
    {
        var key = (subject ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(level))
            return Dedupe(Catalog.TryGetValue((level, key), out var units) ? units : []);
        var all = Levels
            .Where(item => Catalog.ContainsKey((item.Key, key)))
            .SelectMany(item => Catalog[(item.Key, key)].Select(unit => unit with { Label = $"{item.Label} · {unit.Label}" }))
            .ToList();
        return Dedupe(all);
    }

    /// <summary>Kataloğu olan (seviye, ders) çiftleri (testler ve yönetim için).</summary>
    public static IEnumerable<(string Level, string Subject)> Keys => Catalog.Keys;

    /// <summary>Arama ve tekilleştirme anahtarı: küçük harf, Türkçe harfler katlanmış, boşluk sadeleşmiş.</summary>
    public static string Fold(string? value)
    {
        var lower = string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLower(Tr);
        var builder = new StringBuilder(lower.Length);
        foreach (var ch in lower.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            builder.Append(ch switch { 'ı' => 'i', '’' or '‘' or '`' => '\'', _ => ch });
        }
        return builder.ToString();
    }

    private static List<OpticalTopicUnit> Dedupe(IEnumerable<OpticalTopicUnit> units)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<OpticalTopicUnit>();
        foreach (var unit in units)
        {
            var topics = unit.Topics.Where(topic => seen.Add(Fold(topic))).ToList();
            if (topics.Count > 0) result.Add(unit with { Topics = topics });
        }
        return result;
    }

    private static OpticalTopicUnit U(string label, string topics) =>
        new(label, topics.Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));

    /// <summary>Birleşik alt testlerde (TYT Fen, TYT Sosyal, Felsefe Grubu) her dersin konuları ders adıyla tek başlıkta toplanır.</summary>
    private static OpticalTopicUnit[] Part(string label, OpticalTopicUnit[] units) =>
        [new(label, units.SelectMany(unit => unit.Topics).ToList())];

    // ── Türkçe ───────────────────────────────────────────────────────────────

    private static readonly OpticalTopicUnit[] Turkce5 =
    [
        U("Anlam Bilgisi", "Sözcükte Anlam|Gerçek, Mecaz ve Terim Anlam|Eş Anlamlı ve Zıt Anlamlı Sözcükler|Eş Sesli Sözcükler|Deyimler ve Atasözleri|Cümlede Anlam|Neden-Sonuç İlişkisi|Amaç-Sonuç İlişkisi|Öznel ve Nesnel Yargılar|Paragrafta Anlam|Paragrafın Konusu ve Ana Fikri|Yardımcı Fikirler|Başlık Belirleme|Metin Türleri|Hikâye Unsurları|Görsel Okuma ve Yorumlama|Sözel Mantık ve Akıl Yürütme"),
        U("Dil Bilgisi", "Kök ve Ek|Yapım Ekleri ve Çekim Ekleri|Basit, Türemiş ve Birleşik Sözcükler|Hece Bilgisi ve Satır Sonunda Ayırma"),
        U("Yazım ve Noktalama", "Yazım Kuralları|Noktalama İşaretleri"),
    ];

    private static readonly OpticalTopicUnit[] Turkce6 =
    [
        U("Anlam Bilgisi", "Sözcükte Anlam|Gerçek, Mecaz ve Terim Anlam|Eş Anlamlı ve Zıt Anlamlı Sözcükler|Eş Sesli Sözcükler|Deyimler ve Atasözleri|Söz Sanatları|Cümlede Anlam|Neden-Sonuç İlişkisi|Amaç-Sonuç İlişkisi|Öznel ve Nesnel Yargılar|Paragrafta Anlam|Paragrafın Konusu ve Ana Fikri|Yardımcı Fikirler|Paragraf Oluşturma ve Akışı Bozan Cümle|Metin Türleri|Hikâye Unsurları|Görsel Okuma ve Yorumlama|Sözel Mantık ve Akıl Yürütme"),
        U("Dil Bilgisi", "Kök ve Ek|Yapım Ekleri ve Çekim Ekleri|İsimler|İsim Tamlamaları|Sıfatlar|Zamirler|Edat, Bağlaç ve Ünlem"),
        U("Yazım ve Noktalama", "Yazım Kuralları|Noktalama İşaretleri"),
    ];

    private static readonly OpticalTopicUnit[] Turkce7 =
    [
        U("Anlam Bilgisi", "Sözcükte Anlam|Gerçek, Mecaz ve Terim Anlam|Deyimler ve Atasözleri|Söz Sanatları|Cümlede Anlam|Neden-Sonuç İlişkisi|Amaç-Sonuç İlişkisi|Koşul (Şart) İlişkisi|Karşılaştırma Cümleleri|Öznel ve Nesnel Yargılar|Paragrafta Anlam|Paragrafın Konusu ve Ana Fikri|Yardımcı Fikirler|Paragraf Oluşturma ve Akışı Bozan Cümle|Düşünceyi Geliştirme Yolları|Anlatım Biçimleri|Metin Türleri|Görsel Okuma ve Yorumlama|Sözel Mantık ve Akıl Yürütme"),
        U("Dil Bilgisi", "Fiiller|Fiillerde Anlam (İş, Oluş, Durum)|Fiil Kipleri (Haber ve Dilek Kipleri)|Fiillerde Kişi|Fiillerde Yapı|Ek Fiil|Zarflar|Anlatım Bozuklukları"),
        U("Yazım ve Noktalama", "Yazım Kuralları|Noktalama İşaretleri"),
    ];

    private static readonly OpticalTopicUnit[] TurkceLgs =
    [
        U("Anlam Bilgisi", "Sözcükte Anlam|Gerçek, Mecaz ve Terim Anlam|Çok Anlamlılık|Deyimler ve Atasözleri|Söz Sanatları|Cümlede Anlam|Cümle Yorumlama|Neden-Sonuç İlişkisi|Amaç-Sonuç İlişkisi|Koşul (Şart) İlişkisi|Karşılaştırma Cümleleri|Öznel ve Nesnel Yargılar|Paragrafta Anlam|Paragrafın Konusu ve Ana Fikri|Yardımcı Fikirler|Paragraf Oluşturma ve Akışı Bozan Cümle|Paragraf Tamamlama|Düşünceyi Geliştirme Yolları|Anlatım Biçimleri|Metin Türleri|Hikâye Unsurları|Görsel Okuma ve Grafik Yorumlama|Sözel Mantık ve Akıl Yürütme"),
        U("Dil Bilgisi", "Fiilimsiler|Cümlenin Ögeleri|Fiilde Çatı|Cümle Türleri|Anlatım Bozuklukları"),
        U("Yazım ve Noktalama", "Yazım Kuralları|Noktalama İşaretleri"),
    ];

    private static readonly OpticalTopicUnit[] TurkceTyt =
    [
        U("Anlam Bilgisi", "Sözcükte Anlam|Söz Yorumu|Deyim ve Atasözü|Cümlede Anlam|Cümle Yorumlama|Paragrafta Anlam|Paragrafta Ana Düşünce|Paragrafta Yardımcı Düşünce|Paragrafın Yapısı ve Akışı Bozan Cümle|Paragraf Tamamlama ve Cümle Yerleştirme|Anlatım Biçimleri|Düşünceyi Geliştirme Yolları|Anlatımın Özellikleri"),
        U("Dil Bilgisi", "Ses Bilgisi|Sözcükte Yapı (Kök ve Ekler)|İsimler|İsim Tamlamaları|Sıfatlar|Zamirler|Zarflar|Edat, Bağlaç ve Ünlem|Fiiller (Kip ve Kişi)|Fiilde Yapı ve Birleşik Fiiller|Ek Fiil|Fiilimsiler|Fiilde Çatı|Cümlenin Ögeleri|Cümle Türleri|Anlatım Bozuklukları"),
        U("Yazım ve Noktalama", "Yazım Kuralları|Noktalama İşaretleri"),
    ];

    // ── Matematik ────────────────────────────────────────────────────────────

    private static readonly OpticalTopicUnit[] Matematik5 =
    [
        U("Sayılar ve Nicelikler", "Doğal Sayılar|Doğal Sayılarla Toplama ve Çıkarma|Doğal Sayılarla Çarpma ve Bölme|Zihinden İşlem ve Tahmin|Kesirler|Kesirlerle İşlemler|Ondalık Gösterim|Ondalık Gösterimlerle İşlemler|Yüzdeler"),
        U("İşlemlerle Cebirsel Düşünme", "Örüntüler|İşlem Önceliği|Eşitlik Kavramı|Problem Çözme"),
        U("Geometrik Şekiller", "Temel Geometrik Kavramlar (Nokta, Doğru, Işın)|Doğru Parçası ve Doğrular|Açılar|Üçgenler|Dörtgenler|Çokgenler"),
        U("Geometrik Nicelikler", "Uzunluk Ölçme|Çevre Uzunluğu|Alan Ölçme|Zaman Ölçme"),
        U("İstatistiksel Araştırma Süreci", "Veri Toplama ve Düzenleme|Sıklık Tablosu ve Sütun Grafiği"),
        U("Veriden Olasılığa", "Olasılık"),
    ];

    private static readonly OpticalTopicUnit[] Matematik6 =
    [
        U("Sayılar ve Nicelikler", "Doğal Sayılarla İşlemler|Üslü İfadeler|Çarpanlar ve Katlar|Bölünebilme Kuralları|Asal Sayılar|EBOB ve EKOK|Kümeler|Tam Sayılar|Kesirlerle İşlemler|Ondalık Gösterim|Ondalık Gösterimlerle İşlemler|Oran"),
        U("İşlemlerle Cebirsel Düşünme ve Değişimler", "Cebirsel İfadeler|Cebirsel İfadelerle İşlemler|Örüntüler|Problem Çözme"),
        U("Geometrik Şekiller", "Açılar|Komşu, Tümler ve Bütünler Açılar|Çokgenler|Çember"),
        U("Geometrik Nicelikler", "Alan Ölçme|Üçgen ve Paralelkenarın Alanı|Uzunluk ve Alan Ölçü Birimleri|Hacim Ölçme|Sıvı Ölçme"),
        U("İstatistiksel Araştırma Süreci", "Veri Analizi|Aritmetik Ortalama ve Açıklık|Grafikler"),
        U("Veriden Olasılığa", "Olasılık"),
    ];

    private static readonly OpticalTopicUnit[] Matematik7 =
    [
        U("Sayılar ve Nicelikler", "Tam Sayılarla İşlemler|Rasyonel Sayılar|Rasyonel Sayılarla İşlemler|Oran ve Orantı|Doğru ve Ters Orantı|Yüzdeler|Yüzde Problemleri"),
        U("İşlemlerle Cebirsel Düşünme ve Değişimler", "Cebirsel İfadeler|Eşitlik ve Denklem|Birinci Dereceden Bir Bilinmeyenli Denklemler|Örüntüler|Problem Çözme"),
        U("Dönüşüm", "Öteleme|Yansıma|Dönme|Cisimlerin Farklı Yönlerden Görünümleri"),
        U("Geometrik Nicelikler", "Doğrular ve Açılar|Paralel Doğrular ve Kesenle Oluşan Açılar|Çokgenlerin Açıları|Alan Ölçme|Çember ve Daire|Çemberin Uzunluğu|Dairenin ve Daire Diliminin Alanı"),
        U("Geometrik Şekiller", "Çokgenler|Dörtgenler|Üçgenler"),
        U("İstatistiksel Araştırma Süreci", "Veri Analizi|Merkezî Eğilim Ölçüleri (Ortalama, Ortanca, Tepe Değer)|Grafikler"),
        U("Veriden Olasılığa", "Olasılık"),
    ];

    private static readonly OpticalTopicUnit[] MatematikLgs =
    [
        U("Sayılar ve İşlemler", "Çarpanlar ve Katlar|EBOB ve EKOK|Aralarında Asal Sayılar|Üslü İfadeler|Bilimsel Gösterim|Kareköklü İfadeler|Kareköklü İfadelerde İşlemler|Gerçek Sayılar"),
        U("Veri Analizi", "Veri Analizi (Grafikler)"),
        U("Olasılık", "Basit Olayların Olma Olasılığı"),
        U("Cebir", "Cebirsel İfadeler ve Özdeşlikler|Çarpanlara Ayırma|Doğrusal Denklemler|Koordinat Sistemi|Doğrusal İlişkiler ve Grafikleri|Eğim|Eşitsizlikler"),
        U("Geometri ve Ölçme", "Üçgenler|Üçgen Eşitsizliği|Pisagor Bağıntısı|Eşlik ve Benzerlik|Dönüşüm Geometrisi (Öteleme ve Yansıma)|Geometrik Cisimler (Prizmalar)|Dik Dairesel Silindir|Dik Piramit|Dik Dairesel Koni"),
        U("Problemler", "Problemler ve Sayısal Akıl Yürütme"),
    ];

    private static readonly OpticalTopicUnit[] MatematikTyt =
    [
        U("Sayılar", "Temel Kavramlar|Sayı Basamakları|Bölme ve Bölünebilme|Asal Çarpanlara Ayırma|EBOB ve EKOK|Rasyonel Sayılar|Ondalık Sayılar|Basit Eşitsizlikler|Mutlak Değer|Üslü Sayılar|Köklü Sayılar|Çarpanlara Ayırma|Oran ve Orantı|Denklem Çözme|Modüler Aritmetik"),
        U("Problemler", "Sayı Problemleri|Kesir Problemleri|Yaş Problemleri|Hareket Problemleri|İşçi ve Havuz Problemleri|Yüzde Problemleri|Kâr-Zarar Problemleri|Karışım Problemleri|Faiz Problemleri|Grafik Problemleri|Rutin Olmayan Problemler"),
        U("Kümeler, Mantık ve Fonksiyonlar", "Kümeler|Kartezyen Çarpım|Mantık|Fonksiyonlar|Polinomlar|İkinci Dereceden Denklemler"),
        U("Sayma, Olasılık ve Veri", "Permütasyon|Kombinasyon|Binom Açılımı|Olasılık|Veri ve İstatistik"),
    ];

    private static readonly OpticalTopicUnit[] GeometriTyt =
    [
        U("Geometri", "Doğruda ve Üçgende Açılar|Dik Üçgen ve Trigonometrik Bağıntılar|İkizkenar ve Eşkenar Üçgen|Üçgende Açıortay|Üçgende Kenarortay|Üçgende Eşlik ve Benzerlik|Üçgende Açı-Kenar Bağıntıları|Üçgende Alan|Çokgenler|Dörtgenler|Paralelkenar|Eşkenar Dörtgen|Dikdörtgen|Kare|Yamuk|Deltoid|Çemberde Açı|Çemberde Uzunluk|Dairede Alan|Noktanın Analitik İncelenmesi|Doğrunun Analitik İncelenmesi|Katı Cisimler (Prizmalar)|Katı Cisimler (Piramitler)|Silindir, Koni ve Küre"),
    ];

    private static readonly OpticalTopicUnit[] MatematikAyt =
    [
        U("Cebir", "Polinomlar|İkinci Dereceden Denklemler|Karmaşık Sayılar|Parabol|İkinci Dereceden Eşitsizlikler|Denklem ve Eşitsizlik Sistemleri|Fonksiyonlar (Bileşke ve Ters Fonksiyon)|Fonksiyon Grafikleri ve Dönüşümleri"),
        U("Sayma ve Olasılık", "Permütasyon|Kombinasyon|Binom Açılımı|Olasılık"),
        U("Trigonometri", "Trigonometrik Fonksiyonlar|Trigonometrik Özdeşlikler|Toplam-Fark ve İki Kat Açı Formülleri|Trigonometrik Denklemler|Sinüs ve Kosinüs Teoremleri"),
        U("Üstel ve Logaritmik Fonksiyonlar", "Üstel Fonksiyonlar|Logaritma|Logaritmik Denklemler ve Eşitsizlikler"),
        U("Diziler", "Gerçek Sayı Dizileri|Aritmetik Dizi|Geometrik Dizi|Toplam ve Çarpım Sembolü"),
        U("Analiz", "Limit|Süreklilik|Türev|Türev Alma Kuralları|Türevin Geometrik Yorumu|Artan ve Azalan Fonksiyonlar|Maksimum ve Minimum Problemleri|Belirsiz İntegral|Belirli İntegral|İntegral ile Alan Hesabı"),
    ];

    private static readonly OpticalTopicUnit[] GeometriAyt =
    [
        U("Geometri", "Doğruda ve Üçgende Açılar|Dik Üçgen ve Trigonometrik Bağıntılar|İkizkenar ve Eşkenar Üçgen|Üçgende Açıortay|Üçgende Kenarortay|Üçgende Eşlik ve Benzerlik|Üçgende Açı-Kenar Bağıntıları|Üçgende Alan|Çokgenler|Dörtgenler|Paralelkenar|Eşkenar Dörtgen|Dikdörtgen|Kare|Yamuk|Deltoid|Çemberde Açı|Çemberde Uzunluk|Dairede Alan|Katı Cisimler (Prizmalar)|Katı Cisimler (Piramitler)|Silindir, Koni ve Küre"),
        U("Analitik Geometri ve Dönüşümler", "Noktanın Analitik İncelenmesi|Doğrunun Analitik İncelenmesi|Çemberin Analitik İncelenmesi|Dönüşüm Geometrisi (Öteleme, Yansıma, Dönme)|Vektörler"),
    ];

    // ── Fen ──────────────────────────────────────────────────────────────────

    private static readonly OpticalTopicUnit[] Fen5 =
    [
        U("Gökyüzündeki Komşularımız ve Biz", "Güneş'in Yapısı ve Özellikleri|Ay'ın Yapısı ve Özellikleri|Ay'ın Evreleri|Dünya, Güneş ve Ay'ın Hareketleri"),
        U("Kuvveti Tanıyalım", "Kuvvetin Ölçülmesi|Dinamometre|Sürtünme Kuvveti"),
        U("Canlıların Yapısına Yolculuk", "Hücre ve Organelleri|Mikroskop|Canlıların Sınıflandırılması"),
        U("Işığın Dünyası", "Işığın Yayılması|Işık Kaynakları|Gölge Oluşumu|Işığın Maddeyle Etkileşimi"),
        U("Maddenin Doğası", "Maddenin Halleri|Maddenin Hal Değişimi|Isı ve Sıcaklık|Isınma-Soğuma Eğrileri"),
        U("Yaşamımızdaki Elektrik", "Elektrik Devre Elemanları|Basit Elektrik Devresi|Devre Şeması"),
        U("Sürdürülebilir Yaşam ve Geri Dönüşüm", "Geri Dönüşüm|Çevre Sorunları|Biyoçeşitlilik|Sürdürülebilir Yaşam"),
    ];

    private static readonly OpticalTopicUnit[] Fen6 =
    [
        U("Güneş Sistemi ve Tutulmalar", "Güneş Sistemi ve Gezegenler|Güneş Tutulması|Ay Tutulması"),
        U("Kuvvetin Etkisinde Hareket", "Bileşke Kuvvet|Dengelenmiş ve Dengelenmemiş Kuvvetler|Sabit Süratli Hareket|Sürat"),
        U("Canlılarda Sistemler", "Destek ve Hareket Sistemi|Sindirim Sistemi|Dolaşım Sistemi|Solunum Sistemi|Boşaltım Sistemi"),
        U("Işığın Yansıması ve Renkler", "Işığın Yansıması|Düzlem Ayna|Işığın Soğurulması|Renkler"),
        U("Maddenin Ayırt Edici Özellikleri", "Kütle ve Hacim|Yoğunluk|Maddenin Ayırt Edici Özellikleri"),
        U("Elektriğin İletimi ve Direnç", "İletken ve Yalıtkan Maddeler|Elektriksel Direnç|Direnci Etkileyen Faktörler"),
        U("Sürdürülebilir Yaşam ve Etkileşim", "Ekosistem ve Etkileşim|Sürdürülebilir Yaşam"),
    ];

    private static readonly OpticalTopicUnit[] Fen7 =
    [
        U("Uzay Çağı", "Uzay Araştırmaları ve Teknolojileri|Gök Cisimleri|Güneş Sistemi Ötesi|Uzay Kirliliği"),
        U("Kuvvet ve Enerjiyi Keşfedelim", "Kütle ve Ağırlık|İş ve Enerji|Kinetik Enerji|Potansiyel Enerji|Enerji Dönüşümleri|Sürtünmenin Enerjiye Etkisi"),
        U("Vücudumuzdaki Sistemler", "Denetleyici ve Düzenleyici Sistemler|Duyu Organları|Sistemlerin Sağlığı"),
        U("Işığın Kırılması ve Mercekler", "Işığın Kırılması|Mercekler|Merceklerin Kullanım Alanları"),
        U("Maddenin Doğasına Yolculuk", "Atomun Yapısı|Element ve Bileşikler|Saf Madde ve Karışımlar|Karışımların Ayrılması"),
        U("Elektriklenme", "Elektrik Yükleri|Elektriklenme Çeşitleri|Elektroskop|Topraklama"),
        U("Sürdürülebilir Yaşam ve Enerji", "Enerji Kaynakları|Yenilenebilir Enerji|Sürdürülebilir Yaşam"),
    ];

    private static readonly OpticalTopicUnit[] FenLgs =
    [
        U("Mevsimler ve İklim", "Mevsimlerin Oluşumu|İklim ve Hava Hareketleri"),
        U("DNA ve Genetik Kod", "DNA ve Genetik Kod|Kalıtım|Mutasyon ve Modifikasyon|Adaptasyon|Biyoteknoloji"),
        U("Basınç", "Katı Basıncı|Sıvı Basıncı|Gaz Basıncı (Açık Hava Basıncı)"),
        U("Madde ve Endüstri", "Periyodik Sistem|Fiziksel ve Kimyasal Değişimler|Kimyasal Tepkimeler|Asitler ve Bazlar|Maddenin Isı ile Etkileşimi|Türkiye'de Kimya Endüstrisi"),
        U("Basit Makineler", "Kaldıraçlar|Makaralar ve Palangalar|Eğik Düzlem, Vida ve Çıkrık|Dişli Çarklar ve Kasnaklar"),
        U("Enerji Dönüşümleri ve Çevre Bilimi", "Besin Zinciri ve Enerji Akışı|Fotosentez|Solunum|Madde Döngüleri ve Çevre Sorunları|Sürdürülebilir Kalkınma"),
        U("Elektrik Yükleri ve Elektrik Enerjisi", "Elektrik Yükleri ve Elektriklenme|Elektrik Yüklü Cisimler|Elektrik Enerjisinin Dönüşümü"),
    ];

    private static readonly OpticalTopicUnit[] FizikTyt =
    [
        U("Fizik", "Fizik Bilimine Giriş|Madde ve Özellikleri|Kütle, Hacim ve Özkütle|Dayanıklılık, Adezyon ve Kohezyon|Basınç|Sıvıların Kaldırma Kuvveti|Isı, Sıcaklık ve Genleşme|Hareket|Kuvvet ve Newton'un Hareket Yasaları|İş, Güç ve Enerji|Elektrostatik|Elektrik Akımı ve Direnç|Elektrik Devreleri|Mıknatıslar ve Manyetik Alan|Dalgalar (Yay ve Su Dalgaları)|Ses Dalgaları|Deprem Dalgaları|Aydınlanma ve Gölge|Düzlem Ayna|Küresel Aynalar|Işığın Kırılması|Mercekler|Prizmalar ve Renkler"),
    ];

    private static readonly OpticalTopicUnit[] FizikAyt =
    [
        U("Kuvvet ve Hareket", "Vektörler|Bağıl Hareket|Newton'un Hareket Yasaları|Bir Boyutta Sabit İvmeli Hareket|İki Boyutta Hareket (Atışlar)|Enerji ve Hareket|İtme ve Çizgisel Momentum|Tork|Denge ve Denge Şartları|Kütle ve Ağırlık Merkezi|Basit Makineler"),
        U("Elektrik ve Manyetizma", "Elektriksel Kuvvet ve Elektrik Alan|Elektriksel Potansiyel ve Potansiyel Enerji|Düzgün Elektrik Alan ve Sığa|Manyetizma ve Manyetik Kuvvet|Elektromanyetik İndüklenme|Alternatif Akım|Transformatörler"),
        U("Çembersel ve Harmonik Hareket", "Düzgün Çembersel Hareket|Dönerek Öteleme ve Açısal Momentum|Kütle Çekim ve Kepler Yasaları|Basit Harmonik Hareket"),
        U("Dalga Mekaniği", "Dalgalarda Kırınım ve Girişim|Doppler Olayı|Elektromanyetik Dalgalar"),
        U("Modern Fizik", "Atom Modelleri|Büyük Patlama ve Atom Altı Parçacıklar|Radyoaktivite|Özel Görelilik|Kara Cisim Işıması|Fotoelektrik Olay|Compton Saçılması ve De Broglie Dalga Boyu|Modern Fiziğin Teknolojideki Uygulamaları"),
    ];

    private static readonly OpticalTopicUnit[] KimyaTyt =
    [
        U("Kimya", "Kimya Bilimi|Atom ve Yapısı|Periyodik Sistem|Kimyasal Türler Arası Etkileşimler|Maddenin Halleri|Doğa ve Kimya|Kimyanın Temel Kanunları|Mol Kavramı|Kimyasal Tepkimeler ve Denklemler|Kimyasal Hesaplamalar|Karışımlar|Asitler, Bazlar ve Tuzlar|Kimya Her Yerde"),
    ];

    private static readonly OpticalTopicUnit[] KimyaAyt =
    [
        U("Kimya", "Modern Atom Teorisi|Gazlar|Sıvı Çözeltiler ve Çözünürlük|Kimyasal Tepkimelerde Enerji|Kimyasal Tepkimelerde Hız|Kimyasal Denge|Asit-Baz Dengesi|Çözünürlük Dengesi|Kimya ve Elektrik (Redoks)|Elektrokimyasal Hücreler ve Elektroliz|Karbon Kimyasına Giriş|Organik Bileşikler (Hidrokarbonlar)|Fonksiyonel Gruplar|Enerji Kaynakları ve Bilimsel Gelişmeler"),
    ];

    private static readonly OpticalTopicUnit[] BiyolojiTyt =
    [
        U("Biyoloji", "Canlıların Ortak Özellikleri|İnorganik Bileşikler|Organik Bileşikler (Karbonhidrat, Lipit, Protein)|Enzimler|Vitaminler, Hormonlar ve Nükleik Asitler|Hücre ve Organeller|Hücre Zarından Madde Geçişi|Canlıların Sınıflandırılması|Canlı Âlemleri|Hücre Bölünmeleri (Mitoz)|Mayoz ve Eşeyli Üreme|Eşeysiz Üreme|Kalıtım|Genetik Varyasyonlar|Ekosistem Ekolojisi|Güncel Çevre Sorunları"),
    ];

    private static readonly OpticalTopicUnit[] BiyolojiAyt =
    [
        U("İnsan Fizyolojisi", "Sinir Sistemi|Endokrin Sistem|Duyu Organları|Destek ve Hareket Sistemi|Sindirim Sistemi|Dolaşım Sistemi|Bağışıklık Sistemi|Solunum Sistemi|Üriner Sistem (Boşaltım)|Üreme Sistemi ve Embriyonik Gelişim"),
        U("Genetik ve Biyoteknoloji", "Nükleik Asitler|Genetik Şifre ve Protein Sentezi|Biyoteknoloji ve Gen Mühendisliği"),
        U("Canlılık ve Enerji", "ATP ve Enerji|Fotosentez|Kemosentez|Hücresel Solunum"),
        U("Bitki Biyolojisi", "Bitkilerin Yapısı|Bitkilerde Madde Taşınması|Bitkilerde Beslenme ve Hareket|Bitkilerde Eşeyli Üreme"),
        U("Ekoloji ve Evrim", "Komünite Ekolojisi|Popülasyon Ekolojisi|Canlılar ve Çevre (Adaptasyon)|Evrim"),
    ];

    // ── Sosyal ───────────────────────────────────────────────────────────────

    private static readonly OpticalTopicUnit[] Sosyal5 =
    [
        U("Birlikte Yaşamak", "Gruplar ve Roller|Ortak Değerler ve Kültür|Sosyal Sorumluluk"),
        U("Evimiz Dünya", "Yaşadığımız Yerin Konumu|Harita Okuryazarlığı|Yer Şekilleri|Hava Durumu ve İklim|Doğal Afetler"),
        U("Ortak Mirasımız", "Anadolu ve Mezopotamya Uygarlıkları|Kültürel Mirasımız"),
        U("Yaşayan Demokrasimiz", "Haklar ve Sorumluluklar|Demokrasi ve Katılım|Çocuk Hakları"),
        U("Hayatımızdaki Ekonomi", "Üretim, Dağıtım ve Tüketim|Ekonomik Faaliyetler|Bilinçli Tüketim"),
        U("Teknoloji ve Sosyal Bilimler", "Teknolojinin Etkileri|Teknolojiyi Bilinçli Kullanma"),
    ];

    private static readonly OpticalTopicUnit[] Sosyal6 =
    [
        U("Birlikte Yaşamak", "Sosyal Roller|Kültürel Etkileşim|Toplumsal Yardımlaşma"),
        U("Evimiz Dünya", "Türkiye'nin Konumu|Türkiye'nin Fiziki Özellikleri|İklim Tipleri|Kıtalar ve Okyanuslar|Türkiye'nin Doğal Kaynakları"),
        U("Ortak Mirasımız", "İlk Türk Devletleri|Türklerin İslamiyet'i Kabulü|İpek Yolu ve Ticaret"),
        U("Yaşayan Demokrasimiz", "Yasama, Yürütme ve Yargı|Demokrasi ve Temel Haklar|Etkin Vatandaşlık"),
        U("Hayatımızdaki Ekonomi", "Türkiye'nin Ekonomik Kaynakları|Meslekler ve Üretim"),
        U("Teknoloji ve Sosyal Bilimler", "Bilim ve Teknolojinin Gelişimi|Türk-İslam Bilginleri"),
    ];

    private static readonly OpticalTopicUnit[] Sosyal7 =
    [
        U("Birlikte Yaşamak", "İletişim ve İnsan İlişkileri|Medya Okuryazarlığı|Hak ve Özgürlükler"),
        U("Evimiz Dünya", "Nüfus|Göç|Yerleşme"),
        U("Ortak Mirasımız", "Osmanlı Devleti'nin Kuruluşu|Osmanlı Devleti'nin Yükselişi|Osmanlı Kültür ve Medeniyeti"),
        U("Yaşayan Demokrasimiz", "Demokrasinin Gelişimi|Atatürk ve Demokrasi|Sivil Toplum Kuruluşları"),
        U("Hayatımızdaki Ekonomi", "Üretim ve Ekonomik Faaliyetler|Osmanlı'da Ekonomi ve Ticaret"),
        U("Teknoloji ve Sosyal Bilimler", "Bilimsel Gelişmeler|Rönesans ve Reform|Matbaanın Etkileri"),
    ];

    private static readonly OpticalTopicUnit[] InkilapLgs =
    [
        U("Bir Kahraman Doğuyor", "Avrupa'daki Gelişmeler ve Osmanlı Devleti|Mustafa Kemal'in Çocukluk ve Öğrenim Hayatı|Mustafa Kemal'in Askerlik Hayatı"),
        U("Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar", "Birinci Dünya Savaşı ve Osmanlı Devleti|Mondros Ateşkes Antlaşması ve İşgaller|Cemiyetler|Kuvâ-yı Milliye|Mustafa Kemal'in Samsun'a Çıkışı|Amasya Genelgesi|Erzurum ve Sivas Kongreleri|Misak-ı Millî|TBMM'nin Açılması|Sevr Antlaşması"),
        U("Millî Bir Destan: Ya İstiklal Ya Ölüm!", "Doğu Cephesi|Güney Cephesi|Batı Cephesi|I. ve II. İnönü Muharebeleri|Kütahya-Eskişehir Muharebeleri ve Tekâlif-i Milliye|Sakarya Meydan Muharebesi|Büyük Taarruz|Mudanya Ateşkes Antlaşması|Lozan Barış Antlaşması"),
        U("Atatürkçülük ve Çağdaşlaşan Türkiye", "Saltanatın Kaldırılması|Cumhuriyetin İlanı|Halifeliğin Kaldırılması|Hukuk Alanındaki Gelişmeler|Eğitim ve Kültür Alanındaki Gelişmeler|Toplumsal Alanda Gelişmeler|Ekonomi Alanındaki Gelişmeler|Atatürk İlkeleri"),
        U("Demokratikleşme Çabaları", "Çok Partili Hayata Geçiş Denemeleri|Cumhuriyete Yönelik Tehditler"),
        U("Atatürk Dönemi Türk Dış Politikası", "Lozan'dan Kalan Sorunlar|Musul Sorunu ve Nüfus Mübadelesi|Montrö Boğazlar Sözleşmesi|Hatay Meselesi|Balkan Antantı ve Sadabat Paktı"),
        U("Atatürk'ün Ölümü ve Sonrası", "Atatürk'ün Ölümü|İkinci Dünya Savaşı ve Türkiye"),
    ];

    private static readonly OpticalTopicUnit[] TarihTyt =
    [
        U("Tarih", "Tarih ve Zaman|İnsanlığın İlk Dönemleri|İlk Çağ Uygarlıkları|Orta Çağ'da Dünya|İlk ve Orta Çağlarda Türk Dünyası|İslam Medeniyetinin Doğuşu|Türklerin İslamiyet'i Kabulü ve İlk Türk-İslam Devletleri|Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi|Beylikten Devlete Osmanlı Siyaseti (1302-1453)|Dünya Gücü Osmanlı (1453-1595)|Osmanlı Kültür ve Medeniyeti|Arayış Yılları (17. Yüzyıl)|18. Yüzyılda Değişim ve Diplomasi|En Uzun Yüzyıl (1800-1922)|20. Yüzyıl Başlarında Osmanlı Devleti ve Dünya|Millî Mücadele|Atatürkçülük ve Türk İnkılabı"),
    ];

    private static readonly OpticalTopicUnit[] TarihAyt =
    [
        U("Tarih", "Tarih ve Zaman|İnsanlığın İlk Dönemleri|İlk Çağ Uygarlıkları|Orta Çağ'da Dünya|İlk ve Orta Çağlarda Türk Dünyası|İslam Medeniyetinin Doğuşu|Türklerin İslamiyet'i Kabulü ve İlk Türk-İslam Devletleri|Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi|Beylikten Devlete Osmanlı Siyaseti (1302-1453)|Devletleşme Sürecinde Savaşçılar ve Askerler|Beylikten Devlete Osmanlı Medeniyeti|Dünya Gücü Osmanlı (1453-1595)|Sultan ve Osmanlı Merkez Teşkilatı|Klasik Çağda Osmanlı Toplum Düzeni|Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti (1595-1774)|Değişim Çağında Avrupa ve Osmanlı|Uluslararası İlişkilerde Denge Stratejisi (1774-1914)|Devrimler Çağında Değişen Devlet-Toplum İlişkileri|Sermaye ve Emek|19. ve 20. Yüzyılda Değişen Gündelik Hayat|20. Yüzyıl Başlarında Osmanlı Devleti ve Dünya|Millî Mücadele|Atatürkçülük ve Türk İnkılabı|İki Savaş Arasındaki Dönemde Türkiye ve Dünya|II. Dünya Savaşı Sürecinde Türkiye ve Dünya|II. Dünya Savaşı Sonrasında Türkiye ve Dünya|Toplumsal Devrim Çağında Dünya ve Türkiye|21. Yüzyılın Eşiğinde Türkiye ve Dünya"),
    ];

    private static readonly OpticalTopicUnit[] CografyaTyt =
    [
        U("Coğrafya", "Doğa ve İnsan|Dünya'nın Şekli ve Hareketleri|Coğrafi Konum|Harita Bilgisi|Atmosfer ve Sıcaklık|Basınç ve Rüzgârlar|Nem, Yağış ve Buharlaşma|İklim Tipleri|Türkiye'nin İklimi|İç ve Dış Kuvvetler|Türkiye'nin Yer Şekilleri|Su Kaynakları|Topraklar|Bitki Örtüsü|Nüfus|Göç|Yerleşme|Türkiye'de Nüfus ve Yerleşme|Ekonomik Faaliyetler|Bölgeler|Uluslararası Ulaşım Hatları|Çevre ve Toplum|Doğal Afetler"),
    ];

    private static readonly OpticalTopicUnit[] CografyaAyt =
    [
        U("Fiziki Coğrafya", "Ekosistemlerin İşleyişi|Biyoçeşitlilik|Madde Döngüleri ve Enerji Akışı|Su, Toprak ve Bitki Varlığı|İklim Elemanları ve İklim Tipleri|Yer Şekillerinin Oluşumu"),
        U("Beşerî ve Ekonomik Coğrafya", "Nüfus Politikaları|Türkiye'de Nüfus ve Yerleşme|Şehirlerin Fonksiyonları ve Etki Alanları|Ekonomik Faaliyetler ve Doğal Kaynaklar|Türkiye'de Tarım|Türkiye'de Hayvancılık|Türkiye'de Madenler ve Enerji Kaynakları|Türkiye'de Sanayi|Türkiye'de Ulaşım|Türkiye'de Ticaret|Türkiye'de Turizm|Türkiye'nin İşlevsel Bölgeleri ve Kalkınma Projeleri|Hizmet Sektörünün Ekonomideki Yeri|Küresel Ticaret"),
        U("Küresel Ortam", "Bölgeler ve Ülkeler|Kültür Bölgeleri|Jeopolitik Konum|Çatışma Bölgeleri|Ülkeler Arası Etkileşim|Uluslararası Örgütler"),
        U("Çevre ve Toplum", "Çevre Sorunları|Doğal Afetler|Doğal Kaynakların Sürdürülebilir Kullanımı|Ekolojik Ayak İzi"),
    ];

    private static readonly OpticalTopicUnit[] Felsefe =
    [
        U("Felsefe", "Felsefenin Anlamı ve Alanı|Bilgi Felsefesi|Varlık Felsefesi|Ahlak Felsefesi|Sanat Felsefesi|Din Felsefesi|Siyaset Felsefesi|Bilim Felsefesi|İlk Çağ Felsefesi|MÖ 6. Yüzyıl - MS 2. Yüzyıl Felsefesi|MS 2. Yüzyıl - MS 15. Yüzyıl Felsefesi|15. - 17. Yüzyıl Felsefesi|18. - 19. Yüzyıl Felsefesi|20. Yüzyıl Felsefesi"),
    ];

    private static readonly OpticalTopicUnit[] Psikoloji =
    [
        U("Psikoloji", "Psikoloji Bilimini Tanıyalım|Psikolojinin Temel Süreçleri|Duyum ve Algı|Öğrenme|Bellek|Düşünme ve Dil|Güdülenme ve Duygu|Kişilik|Ruh Sağlığının Temelleri"),
    ];

    private static readonly OpticalTopicUnit[] Sosyoloji =
    [
        U("Sosyoloji", "Sosyolojiye Giriş|Birey ve Toplum|Toplumsal Yapı|Toplumsal Değişme ve Gelişme|Toplum ve Kültür|Toplumsal Kurumlar"),
    ];

    private static readonly OpticalTopicUnit[] Mantik =
    [
        U("Mantık", "Mantığa Giriş|Klasik Mantık (Kavram, Önerme, Çıkarım)|Mantık ve Dil|Sembolik Mantık"),
    ];

    // ── Din Kültürü ──────────────────────────────────────────────────────────

    private static readonly OpticalTopicUnit[] Din5 =
    [
        U("Din Kültürü ve Ahlak Bilgisi", "Allah İnancı|Ramazan ve Oruç|Adap ve Nezaket|Hz. Muhammed ve Aile Hayatı|Çevremizde Dinin İzleri|Sure ve Dua Bilgisi"),
    ];

    private static readonly OpticalTopicUnit[] Din6 =
    [
        U("Din Kültürü ve Ahlak Bilgisi", "Peygamber ve İlahi Kitap İnancı|Namaz|Zararlı Alışkanlıklar|Hz. Muhammed'in Hayatı|Temel Değerlerimiz|Sure ve Dua Bilgisi"),
    ];

    private static readonly OpticalTopicUnit[] Din7 =
    [
        U("Din Kültürü ve Ahlak Bilgisi", "Melek ve Ahiret İnancı|Hac ve Kurban|Ahlaki Davranışlar|Allah'ın Kulu ve Elçisi Hz. Muhammed|İslam Düşüncesinde Yorumlar|Sure ve Dua Bilgisi"),
    ];

    private static readonly OpticalTopicUnit[] DinLgs =
    [
        U("Kader İnancı", "Kader ve Kaza İnancı|İnsan İradesi ve Kader|Kaderle İlgili Kavramlar|Ayet el-Kürsi"),
        U("Zekât ve Sadaka", "Zekât ve Sadaka|İslam'ın Paylaşma ve Yardımlaşmaya Verdiği Önem|Mâûn Suresi"),
        U("Din ve Hayat", "Din, Birey ve Toplum|Dinin Temel Gayesi|Asr Suresi"),
        U("Hz. Muhammed'in Örnekliği", "Hz. Muhammed'in Örnekliği|Hz. Muhammed'in Ahlaki Özellikleri"),
        U("Kur'an-ı Kerim ve Özellikleri", "Kur'an-ı Kerim'in Ana Konuları|Kur'an-ı Kerim'in Temel Özellikleri|Yasin Suresi (1-12. Ayetler)"),
    ];

    private static readonly OpticalTopicUnit[] DinTyt =
    [
        U("Din Kültürü ve Ahlak Bilgisi", "Bilgi ve İnanç|Din ve İslam|İslam ve İbadet|Gençlik ve Değerler|Gönül Coğrafyamız|Allah-İnsan İlişkisi|Hz. Muhammed|Vahiy ve Akıl|İslam Düşüncesinde Yorumlar ve Mezhepler|Din, Kültür ve Medeniyet|İslam ve Bilim, Estetik, Barış|Yaşayan Dinler"),
    ];

    private static readonly OpticalTopicUnit[] DinAyt =
    [
        U("Din Kültürü ve Ahlak Bilgisi", "Dünya ve Ahiret|Kur'an'a Göre Hz. Muhammed|Kur'an'da Bazı Kavramlar|İnançla İlgili Meseleler|Yahudilik ve Hristiyanlık|Hint ve Çin Dinleri|Anadolu'da İslam|İslam Düşüncesinde Tasavvufi Yorumlar|Güncel Dini Meseleler"),
    ];

    // ── Edebiyat ve yabancı dil ──────────────────────────────────────────────

    private static readonly OpticalTopicUnit[] EdebiyatAyt =
    [
        U("Anlam ve Dil", "Sözcükte ve Cümlede Anlam|Paragraf"),
        U("Edebiyat Bilgileri", "Güzel Sanatlar ve Edebiyat|Metinlerin Sınıflandırılması|Şiir Bilgisi (Nazım Birimi, Ölçü, Uyak, Redif)|Söz Sanatları|Edebi Akımlar|Dünya Edebiyatı"),
        U("Türlere Göre Metinler", "Hikâye|Roman|Tiyatro|Deneme, Makale, Fıkra ve Sohbet|Biyografi, Otobiyografi ve Anı|Gezi Yazısı, Mektup ve Günlük|Destan, Efsane, Masal ve Fabl"),
        U("Dönemler", "İslamiyet Öncesi Türk Edebiyatı|Geçiş Dönemi Türk Edebiyatı|Halk Edebiyatı|Divan Edebiyatı|Tanzimat Edebiyatı|Servet-i Fünun Edebiyatı|Fecr-i Âti Edebiyatı|Millî Edebiyat|Cumhuriyet Dönemi Türk Şiiri|Cumhuriyet Dönemi Roman ve Hikâye|Cumhuriyet Dönemi Tiyatro"),
    ];

    private static readonly OpticalTopicUnit[] IngilizceOrtaokul =
    [
        U("Beceriler", "Kelime Bilgisi (Vocabulary)|Dil Bilgisi (Grammar)|Okuduğunu Anlama (Reading)|Diyalog Tamamlama|Görsel Yorumlama|Günlük İfadeler (Functions)"),
    ];

    private static readonly OpticalTopicUnit[] IngilizceLgs =
    [
        U("Üniteler", "Friendship|Teen Life|In the Kitchen|On the Phone|The Internet|Adventures|Tourism|Chores|Science|Natural Forces"),
        U("Beceriler", "Kelime Bilgisi (Vocabulary)|Okuduğunu Anlama (Reading)|Diyalog Tamamlama|Görsel Yorumlama"),
    ];

    private static readonly OpticalTopicUnit[] Ydt =
    [
        U("YDT", "Kelime Bilgisi|Dil Bilgisi|Cloze Test|Cümle Tamamlama|İngilizce-Türkçe Çeviri|Türkçe-İngilizce Çeviri|Okuduğunu Anlama|Diyalog Tamamlama|Yakın Anlamlı Cümle|Paragraf Tamamlama|Anlam Bütünlüğünü Bozan Cümle"),
    ];

    private static readonly Dictionary<(string Level, string Subject), OpticalTopicUnit[]> Catalog = Build();

    private static Dictionary<(string, string), OpticalTopicUnit[]> Build()
    {
        var map = new Dictionary<(string, string), OpticalTopicUnit[]>();
        void Add(string level, OpticalTopicUnit[] units, params string[] subjects)
        {
            foreach (var subject in subjects) map[(level, subject)] = units;
        }

        const string English = "Yabancı Dil (İngilizce)";
        const string Din = "Din Kültürü ve Ahlak Bilgisi";

        Add("5", Turkce5, "Türkçe");
        Add("5", Matematik5, "Matematik");
        Add("5", Fen5, "Fen Bilimleri");
        Add("5", Sosyal5, "Sosyal Bilgiler");
        Add("5", Din5, Din);
        Add("5", IngilizceOrtaokul, English, "İngilizce");

        Add("6", Turkce6, "Türkçe");
        Add("6", Matematik6, "Matematik");
        Add("6", Fen6, "Fen Bilimleri");
        Add("6", Sosyal6, "Sosyal Bilgiler");
        Add("6", Din6, Din);
        Add("6", IngilizceOrtaokul, English, "İngilizce");

        Add("7", Turkce7, "Türkçe");
        Add("7", Matematik7, "Matematik");
        Add("7", Fen7, "Fen Bilimleri");
        Add("7", Sosyal7, "Sosyal Bilgiler");
        Add("7", Din7, Din);
        Add("7", IngilizceOrtaokul, English, "İngilizce");

        Add("LGS", TurkceLgs, "Türkçe");
        Add("LGS", MatematikLgs, "Matematik");
        Add("LGS", FenLgs, "Fen Bilimleri");
        Add("LGS", InkilapLgs, "T.C. İnkılap Tarihi ve Atatürkçülük");
        Add("LGS", DinLgs, Din);
        Add("LGS", IngilizceLgs, English, "İngilizce");

        Add("TYT", TurkceTyt, "Türkçe");
        Add("TYT", [.. MatematikTyt, .. GeometriTyt], "Temel Matematik", "Matematik");
        Add("TYT", GeometriTyt, "Geometri");
        Add("TYT", [.. Part("Fizik", FizikTyt), .. Part("Kimya", KimyaTyt), .. Part("Biyoloji", BiyolojiTyt)], "Fen Bilimleri");
        Add("TYT", FizikTyt, "Fizik");
        Add("TYT", KimyaTyt, "Kimya");
        Add("TYT", BiyolojiTyt, "Biyoloji");
        Add("TYT", [.. Part("Tarih", TarihTyt), .. Part("Coğrafya", CografyaTyt), .. Part("Felsefe", Felsefe), .. Part("Din Kültürü ve Ahlak Bilgisi", DinTyt)], "Sosyal Bilimler");
        Add("TYT", TarihTyt, "Tarih");
        Add("TYT", CografyaTyt, "Coğrafya");
        Add("TYT", Felsefe, "Felsefe");
        Add("TYT", DinTyt, Din);

        Add("AYT", MatematikAyt, "Matematik");
        Add("AYT", GeometriAyt, "Geometri");
        Add("AYT", FizikAyt, "Fizik");
        Add("AYT", KimyaAyt, "Kimya");
        Add("AYT", BiyolojiAyt, "Biyoloji");
        Add("AYT", EdebiyatAyt, "Türk Dili ve Edebiyatı");
        Add("AYT", TarihAyt, "Tarih-1", "Tarih-2", "Tarih");
        Add("AYT", [.. CografyaTyt, .. CografyaAyt], "Coğrafya-1", "Coğrafya-2", "Coğrafya");
        Add("AYT", [.. Part("Felsefe", Felsefe), .. Part("Psikoloji", Psikoloji), .. Part("Sosyoloji", Sosyoloji), .. Part("Mantık", Mantik)], "Felsefe Grubu");
        Add("AYT", Felsefe, "Felsefe");
        Add("AYT", Psikoloji, "Psikoloji");
        Add("AYT", Sosyoloji, "Sosyoloji");
        Add("AYT", Mantik, "Mantık");
        Add("AYT", DinAyt, Din);

        Add("YDT", Ydt, "Yabancı Dil (YDT)", English, "İngilizce");
        return map;
    }
}
