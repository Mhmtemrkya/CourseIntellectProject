using System.Globalization;
using CourseIntellect.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// MEB'in matbu sürücü kursu evraklarını (EK-1 müracaat formu, imza sirküleri ve
/// kayıt sözleşmesi) kursiyerin dosyasındaki verilerle doldurup basar.
///
/// Belgelerin metni mevzuatla sabittir; bu yüzden şablon kod içinde tutulur ve
/// yalnızca kursiyere/kuruma göre değişen alanlar dışarıdan gelir. Boş kalan
/// alanlar tire yerine boş bırakılır — evrak elde tamamlanabilsin diye.
/// </summary>
public sealed class DrivingContractFormPdfService : IDrivingContractFormPdfService
{
    static DrivingContractFormPdfService() => QuestPDF.Settings.License = LicenseType.Community;

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private const string Ink = "#000000";
    private const string Line = "#000000";

    public byte[] Generate(DrivingContractFormKind kind, DrivingContractFormData data) =>
        Document.Create(doc =>
        {
            switch (kind)
            {
                case DrivingContractFormKind.Application: ComposeApplication(doc, data); break;
                case DrivingContractFormKind.SignatureCircular: ComposeSignatureCircular(doc, data); break;
                default: ComposeContract(doc, data); break;
            }
        }).GeneratePdf();

    public byte[] GenerateBundle(DrivingContractFormData data) =>
        Document.Create(doc =>
        {
            ComposeApplication(doc, data);
            ComposeSignatureCircular(doc, data);
            ComposeContract(doc, data);
        }).GeneratePdf();

    // ══════════════════════════════════════════════════════════════════════════
    // EK-1 — Müracaat formu
    // ══════════════════════════════════════════════════════════════════════════
    private static void ComposeApplication(IDocumentContainer doc, DrivingContractFormData d) =>
        doc.Page(page =>
        {
            SetupPage(page, 10);

            page.Content().Column(col =>
            {
                col.Item().AlignRight().Text("EK-1").Bold().FontSize(13);

                col.Item().PaddingTop(6).AlignCenter().Text("ÖZEL MOTORLU TAŞIT SÜRÜCÜLERİ KURSUNA").Bold().FontSize(13);
                col.Item().AlignCenter().Text("MÜRACAAT FORMU").Bold().FontSize(13);
                col.Item().PaddingTop(8).AlignCenter()
                    .Text($"{d.InstitutionName.ToUpper(Tr)} MÜDÜRLÜĞÜNE").Bold().FontSize(11);

                col.Item().PaddingTop(26).AlignCenter()
                    .Text($"( {Or(d.LicenseClass, "  ")} ) sınıfı sürücü sertifikası almak istiyorum. Gerekli işlemin yapılmasını arz ederim.");

                col.Item().PaddingTop(18).AlignRight().PaddingRight(60).Column(sign =>
                {
                    sign.Item().AlignCenter().Text("Adı ve Soyadı");
                    sign.Item().AlignCenter().Text(d.FullName.ToUpper(Tr));
                    sign.Item().PaddingTop(14).AlignCenter().Text("İmza");
                });

                col.Item().PaddingTop(34).Row(row =>
                {
                    // Sol kenardaki dikey başlık — matbu formdaki döndürülmüş şerit.
                    row.ConstantItem(26).Border(1).BorderColor(Line).AlignCenter().AlignMiddle()
                        .RotateLeft().Text("SÜRÜCÜ SERTİFİKASI TALEP EDENİN").FontSize(8).SemiBold();

                    row.RelativeItem().Table(t =>
                    {
                        t.ColumnsDefinition(c => { for (var i = 0; i < 6; i++) c.RelativeColumn(); });

                        Band(t, 6, "NÜFUS CÜZDANINDAKİ KAYITLARA GÖRE");

                        Pair(t, 3, "Adı Soyadı", d.FullName.ToUpper(Tr));
                        Pair(t, 3, "T.C. Kimlik No", d.IdentityNumber);
                        Pair(t, 3, "Baba Adı", d.FatherName.ToUpper(Tr));
                        Pair(t, 3, "Doğum Yeri", d.BirthPlace.ToUpper(Tr));
                        Pair(t, 3, "Ana Adı", d.MotherName.ToUpper(Tr));
                        Pair(t, 3, "Doğum Tarihi (Gün/Ay/Yıl)", BirthDateText(d.BirthDate));

                        Band(t, 6, "NÜFUSA KAYITLI OLDUĞU YER");

                        Pair(t, 2, "İl", d.RegistrationCity.ToUpper(Tr));
                        Pair(t, 2, "İlçe", d.RegistrationDistrict.ToUpper(Tr));
                        Pair(t, 2, "Köy-Mahalle", d.RegistrationNeighborhood.ToUpper(Tr));
                        Pair(t, 2, "Sokağı", d.RegistrationStreet);
                        Pair(t, 2, "Cilt No", d.RegistrationVolumeNo);
                        Pair(t, 2, "Aile Sıra No", d.RegistrationFamilyOrderNo);
                        Pair(t, 2, "Sıra No", d.RegistrationOrderNo);
                        Pair(t, 2, "Veriliş Tarihi", d.IdentityIssueDate);
                        Pair(t, 2, "Verildiği Yer", d.IdentityIssuePlace);

                        Pair(t, 3, "Öğrenim Durumu", d.EducationLevel.ToUpper(Tr));
                        Cell(t, 3).Text(string.Empty);

                        t.Cell().ColumnSpan(6).Border(1).BorderColor(Line).Padding(4).Column(addr =>
                        {
                            addr.Item().Text($"İkametgah Adresi ve Tel :  {d.ResidenceAddress}");
                            addr.Item().Text($"Ev Telefon: {PhoneText(d.HomePhone)} - Cep Telefon: {PhoneText(d.Phone)}");
                        });

                        Band(t, 6, "DAHA ÖNCE ALINMIŞ SÜRÜCÜ BELGESİ VARSA");

                        Pair(t, 3, "Verildiği İl", d.ExistingLicenseCity.ToUpper(Tr));
                        Pair(t, 3, "Sınıfı", d.ExistingLicenseClasses.ToUpper(Tr));
                        Pair(t, 3, "Tarihi", d.ExistingLicenseDate);
                        Pair(t, 3, "Süreli veya Süresiz Geri", string.Empty);
                        Pair(t, 3, "Sayısı", d.ExistingLicenseNumber);
                        Cell(t, 3).Text("Alınma Durumu");

                        t.Cell().ColumnSpan(6).Border(1).BorderColor(Line).Padding(6).Column(dec =>
                        {
                            dec.Item().AlignCenter().Text(
                                "2918 sayılı Karayolları Trafik Kanunu'nun 41 inci maddesindeki sürücü olacaklarda aranan şartlara haiz " +
                                "bulunmaktayım. Sürücü belgesi almama engel teşgil edecek bir sabıka kaydım bulunmamaktadır.");
                            dec.Item().AlignCenter().Text(
                                "Bir yıl içinde 3 defa 100 ceza puanımı doldurarak sürücü belgem süresiz olarak iptal edilmemiştir.");
                            dec.Item().AlignCenter().Text(
                                "İki yıllık aday sürücülük süresi içinde sürücü belgem iptal edilmemiştir.");
                            dec.Item().AlignCenter().Text(
                                "Yukarıda doldurmuş olduğum müracaat formundaki bütün bilgilerin doğru olduğunu kabul beyan ederim.");
                        });

                        t.Cell().ColumnSpan(6).Border(1).BorderColor(Line).Padding(6).Row(sign =>
                        {
                            sign.RelativeItem(3).Text($"Adı Soyadı: {d.FullName.ToUpper(Tr)}");
                            sign.RelativeItem(2).Text("İmza");
                            sign.RelativeItem(2).AlignRight().Text(Local(d.RegisteredAtUtc).ToString("dd.MM.yyyy"));
                        });

                        Band(t, 6, "AŞAĞIDAKİ BÖLÜM KURUM MÜDÜRLÜĞÜNCE DOLDURULACAKTIR.");

                        t.Cell().ColumnSpan(6).Border(1).BorderColor(Line).Padding(6).Column(office =>
                        {
                            office.Item().Text(
                                $"Bu müracaat formu {d.FullName.ToUpper(Tr)} tarafından huzurumda imzalanmış olup, beyanın doğrulu kontrol edilmiştir.");
                            office.Item().PaddingTop(12).Row(r =>
                            {
                                r.RelativeItem().Column(x =>
                                {
                                    x.Item().Text("EKLER:");
                                    x.Item().Text("1- Bu yönetmeliğin 11. maddesinde belirtilen belgeler.");
                                });
                                r.RelativeItem().AlignCenter().Column(x =>
                                {
                                    x.Item().AlignCenter().Text("Kurum Müdürü");
                                    x.Item().AlignCenter().Text("İmza");
                                    if (!string.IsNullOrWhiteSpace(d.DirectorName))
                                        x.Item().PaddingTop(14).AlignCenter().Text(d.DirectorName.ToUpper(Tr)).FontSize(9);
                                });
                            });
                        });

                        t.Cell().ColumnSpan(6).Border(1).BorderColor(Line).Padding(5)
                            .Text("NOT: Bu dilekçe dolma kalem veya tükenmez kalemle doldurulacaktır.");
                    });
                });
            });
        });

    // ══════════════════════════════════════════════════════════════════════════
    // Kursiyerin imza sirküleri
    // ══════════════════════════════════════════════════════════════════════════
    private static void ComposeSignatureCircular(IDocumentContainer doc, DrivingContractFormData d) =>
        doc.Page(page =>
        {
            SetupPage(page, 10.5f);

            page.Content().Column(col =>
            {
                col.Item().PaddingTop(20).AlignCenter().Text("KURSİYERİN İMZA SİRKÜLERİ").Bold().FontSize(15);

                col.Item().PaddingTop(20).Text(t =>
                {
                    t.Justify();
                    t.Span("20.12.2013 Tarihli ve 28857 sayılı Resmi Gazete'de Yayımlanan Karayolları Trafik Yönetmeliği'nin 81. " +
                           "Maddesi \"Sürücü belgesinin düzenlenebilmesi için; geçerli motorlu taşıt sürücü sertifikası, adli sicil kaydı, " +
                           "sürücü olur sağlık raporu, sürücü belgesi harcı, sürücü belgesi değerli kâğıt bedeli, diğer kanuni paylar, " +
                           "parmak izi, kan grubu belgesi ile sertifika sahibinin fotoğraf ve imzası Emniyet Genel Müdürlüğünce, " +
                           "Milli Eğitim Bakanlığı ve ilgili kamu kurum ve kuruluşları ile gerçek veya özel hukuk tüzel kişilerden " +
                           "güvenli elektronik sistem üzerinden alınır ve sürücü adayının trafik tescil birimlerine bizzat müracaat " +
                           "şartı aranmadan, sürücü belgesi merkezi sistemle kişiselleştirilerek basılır, ilgililerin beyan etmiş " +
                           "oldukları adreslerine posta yoluyla gönderilir.\"");
                });

                col.Item().PaddingTop(14).Text("Hükmü Gereğince;").Bold();
                col.Item().PaddingTop(2).Text(t =>
                {
                    t.Justify();
                    t.Span("Kursiyerin imza örneği alınıp, taranarak MEBBİS Modülü'ne kaydedilmesi gerekmektedir. MEBBİS Modülüne " +
                           "yüklenen imza örneği, tekrarı yapılmaksızın ve kontrol edilmeksizin Emniyet Genel Müdürlüğü ile paylaşılacak " +
                           "ve kursiyerin sürücü belgelerinde bulunan \"İMZA\" bölümüne işlenerek, Sürücü Belgeleri Kursiyerin beyan " +
                           "etmiş oldukları adreslerine posta yoluyla gönderilecektir.");
                });

                col.Item().PaddingTop(16).Text("ÜSTEKİ YAZIYI OKUYARAK").Bold();
                col.Item().Text("ALT'TA BULUNAN İMZANIN BANA AİT OLDUĞUNU BEYAN EDERİM.").Bold();
                col.Item().PaddingTop(6).AlignCenter()
                    .Text(Local(d.RegisteredAtUtc).ToString("dd.MM.yyyy"));

                col.Item().PaddingTop(34).Table(t =>
                {
                    t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });

                    t.Cell().ColumnSpan(2).Border(1).BorderColor(Line).Padding(6)
                        .AlignCenter().Text("KURSİYERİN İMZA ÖRNEĞİ").Bold().FontSize(11);

                    t.Cell().Border(1).BorderColor(Line).Padding(6)
                        .AlignCenter().Text("KURSİYERİN ADI SOYADI").Bold().FontSize(11);
                    t.Cell().Border(1).BorderColor(Line).Padding(6)
                        .AlignCenter().Text("KURSİYERİN İMZASI").Bold().FontSize(11);

                    t.Cell().Border(1).BorderColor(Line).MinHeight(150).Padding(6)
                        .AlignCenter().AlignMiddle().Column(x =>
                        {
                            x.Item().AlignCenter().Text(d.IdentityNumber).FontSize(13);
                            x.Item().AlignCenter().Text(d.FullName.ToUpper(Tr)).FontSize(13);
                        });
                    t.Cell().Border(1).BorderColor(Line).MinHeight(150).Text(string.Empty);
                });

                col.Item().PaddingTop(3).PaddingLeft(10).Text(PhoneText(d.Phone)).FontSize(9);
            });
        });

    // ══════════════════════════════════════════════════════════════════════════
    // Kayıt sözleşmesi — ön ve arka yüz
    // ══════════════════════════════════════════════════════════════════════════
    private static void ComposeContract(IDocumentContainer doc, DrivingContractFormData d)
    {
        var total = Money(d.TotalFee);
        var drivingHourly = Money(d.DrivingHourlyFee);
        var theoryHourly = Money(d.TheoryHourlyFee);

        // ── Ön yüz ──────────────────────────────────────────────────────────
        doc.Page(page =>
        {
            SetupPage(page, 9.5f);

            page.Content().Column(col =>
            {
                col.Item().PaddingTop(10).AlignCenter()
                    .Text($"{d.InstitutionName.ToUpper(Tr)} MOTORLU TAŞIT SÜRÜCÜ KURSLARI KAYIT SÖZLEŞMESİ").Bold().FontSize(11);
                col.Item().PaddingTop(4).AlignCenter()
                    .Text("( Milli Eğitim Bakanlığı Özel Öğretim Kurumları Yönetmeliğinin 53 incü maddesi hükmü gereği düzenlenmiştir. )")
                    .Italic().FontSize(9.5f);

                col.Item().PaddingTop(12).Table(t =>
                {
                    t.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });

                    t.Cell().Border(1).BorderColor(Line).Padding(5).AlignCenter().Text("KURSİYERİN").Bold().FontSize(12);
                    t.Cell().Border(1).BorderColor(Line).Padding(5).AlignCenter().Text("KURSUN").Bold().FontSize(12);

                    Field(t, "Adı ve Soyadı", d.FullName.ToUpper(Tr));
                    Field(t, "Adı", d.InstitutionName.ToUpper(Tr));

                    Field(t, "T.C. Kimlik No", d.IdentityNumber);
                    Field(t, "İli-İlçesi", JoinDash(d.InstitutionCity, d.InstitutionDistrict).ToUpper(Tr));

                    Field(t, "Ev Adresi", d.ResidenceAddress);
                    Field(t, "Adresi", d.InstitutionAddress.ToUpper(Tr));

                    Field(t, "Tel No", PhoneText(d.Phone));
                    Field(t, "Tel No", d.InstitutionPhone);

                    Field(t, "Almak İstediği Sertifika Sınıfı", d.LicenseClass.ToUpper(Tr));
                    Field(t, "Müdür/Kurucu Adı", d.DirectorName.ToUpper(Tr));

                    Field(t, "Mevcut Sertifika Sınıfı (varsa)", d.ExistingLicenseClasses.ToUpper(Tr));
                    Field(t, "Banka Adı ve Hesap No", JoinDash(d.BankName, d.BankAccountNo));
                });

                col.Item().PaddingTop(10).AlignCenter()
                    .Text("Kursiyer ile özel motorlu taşıt sürücüleri kursu işbu kayıt sözleşmesi kapsamında aşağıdaki maddelerde anlaşmışlardır.");

                col.Item().PaddingTop(8).AlignCenter().Text("BİRİNCİ BÖLÜM").Bold().FontSize(11);
                col.Item().PaddingTop(8).Text("SÜRÜCÜ KURSUNUN GÖREV VE SORUMLULUKLARI:").Bold().FontSize(10);

                Clause(col, "a)", $"Özel motorlu taşıt sürücü kursu Yönetmeliği'nin 43 üncü maddesi ikinci fıkrasına göre belirlenen İş bu " +
                    $"sözleşmede yazılı toplam asgari {total} TL kurs ücretine karşılık kursiyere verilmesi zorunlu teorik ve direksiyon " +
                    "eğitimi derslerini tam ve eksiksiz olarak vereceğimi,");

                Clause(col, "b)", "Direksiyon eğitimlerinde; eğitim alanında veya simülatörde bir ders saati 50 dakikadan az olmamak " +
                    "kaydı ile en az 2 (iki) saat eğitim verdikten sonra direksiyon usta öğreticisi tarafından kursiyerin akan trafikte " +
                    "eğitim alacak düzeye ulaştığına karar verilinceye kadar direksiyon eğitim alanında veya simülatör üzerinde eğitim " +
                    $"vermeye devam edeceğimi ve verdiğim bu eğitimin saat ücretini {drivingHourly} TL'den fazla almayacağımı,");

                col.Item().PaddingTop(6).PaddingLeft(16).Column(list =>
                {
                    list.Item().Text("Akan trafikte direksiyon eğitimi ders sürelerinin bir ders saati 50 dakikadan az olmamak kaydıyla;");
                    foreach (var item in new[]
                    {
                        "1) \"M\",\"A1\",\"A2\",\"A (24 yaşını doldurup iki yıllık deneyim şartı aranmayan)\" ve \"B1\" sınıfı sertifikalar için 12 saat,",
                        "2) \"A\" sınıfı sertifikalar için 6 saat,",
                        "3) \"B\" sınıfı sertifikalar için 14 saat,",
                        "4) \"D1\" sınıfı sertifikalar için 7 saat,",
                        "5) \"D\" sınıfı sertifikalar için 14 saat,",
                        "6) \"C1\" sınıfı sertifikalar için 10 saat,",
                        "7) \"C\" sınıfı sertifikalar için 20 saat,",
                        "8) \"BE\",\"C1E\",\"CE\",\"D1E\" ve \"DE\" sınıfı sertifikalar için 6 saat,",
                        "9) \"F\" sınıfı sertifikalar için 12 saat olduğunu,",
                    }) list.Item().Text(item);
                });

                Clause(col, "c)", "Yukarıda belirtilen saat kadar direksiyon eğitimi dersi verilmesine rağmen kendisini yetersiz bulup " +
                    "ek eğitim talep eden kursiyere ilan ettiğim ders saati ücreti üzerinden ücret tahakkuk ettireceğimi,");

                Clause(col, "ç)", "Teorik ve direksiyon eğitimi dersleri tamamlandıktan sonra ön sınava alacağımı, ön sınavda başarılı olan " +
                    "kursiyerleri Özel MTSK Modülünde tanımlanan ilk sınavdan başlamak üzere direksiyon eğitimi dersi sınavına alacağımı, " +
                    "bu hususta gerekli iletişimi kuracağımı, ön sınavda başarısız olanları üç defa daha ön sınava alacağımı, tekrar " +
                    "başarısız olanlara sertifika sınıfına göre alması gereken direksiyon eğitimi dersini ücretini alıp 45 gün içerisinde " +
                    "vererek tekrar ön sınava alacağımı,");

                Clause(col, "d)", "Mevcut sürücü belgesi dışında farklı bir sınıfın sürücü sertifikasını almak isteyenlere Millî Eğitim " +
                    "Bakanlığı Özel Motorlu Taşıt Sürücüleri Kursu Yönetmeliğinin 39 uncu maddesinde belirtilen süreler kadar direksiyon " +
                    "eğitimi dersi vereceğimi,");

                Clause(col, "e)", "İl/ilçe milli eğitim müdürlüğünce direksiyon eğitimi dersi sınavında 4 üncü hakkında da başarısız " +
                    "olunması halinde ikinci 4 üncü hak için devam etme isteğine göre tarafınıza verilecek en az Birinci Bölüm (b) " +
                    "bendinde belirtilen saat kadar direksiyon eğitimi dersini ücretini almak kaydı ile 45 gün içerisinde vereceğimi,");

                Clause(col, "f)", $"{Local(d.RegisteredAtUtc).Year} yılı için teorik sınav için {Money(d.TheoryExamFee)} TL'yi, direksiyon " +
                    $"sınav ücreti olarak {Money(d.DrivingExamFee)} TL'yi sonraki yıllar için ise Bakanlıkça belirlenen tutar dışında " +
                    "sınavlar için başka bir ücret talep etmeyeceğimi, kursiyerin bu ücretleri bankaya yatırarak dekontunun kursa " +
                    "verilmesini sağlayacağımı veya kursa verilen direksiyon sınav ücretini bankaya yatırarak kursiyerin sınava " +
                    "girmesini sağlayacağımı,");

                Clause(col, "g)", $"Kursiyerden peşin/taksitli olarak aldığım/alacağım toplam {total} TL kurs ücretinin, verilmesi zorunlu " +
                    $"{d.TheoryHours} saat teorik ders ile verilmesi zorunlu {d.DrivingHours} saat direksiyon eğitimi dersi karşılığı " +
                    $"olduğunu, teorik dersin bir saatlik ücretinin {theoryHourly} TL, direksiyon eğitimi dersinin bir saatlik ücretinin " +
                    $"{drivingHourly} TL olduğunu,");

                col.Item().PaddingTop(4).PaddingLeft(16).Text("kabul ve taahhüt ederim.");
            });
        });

        // ── Arka yüz ────────────────────────────────────────────────────────
        doc.Page(page =>
        {
            // Arka yüz ön yüzden daha uzun; imza bloğunun aynı sayfada kalması için
            // punto bir tık küçük tutulur (matbu formda da öyle).
            SetupPage(page, 9f);

            page.Content().Column(col =>
            {
                col.Item().AlignCenter().Text("İKİNCİ BÖLÜM").Bold().FontSize(11);
                col.Item().PaddingTop(6).Text("KURSİYERİN GÖREV VE SORUMLULUKLARI:").Bold().FontSize(10);

                Clause(col, "a)", "Teorik ve direksiyon eğitimlerinin tamamına gireceğimi, devamsızlık yapmayacağımı, kurs tarafından " +
                    "tarafıma verilecek direksiyon eğitimi dersi ile teorik eğitimler de her teorik ders için ayrı ayrı olmak üzere " +
                    "ders saati sayısının 1/5'inden fazla derse devam etmediğim taktirde kurstan kaydımın silineceğini,");

                Clause(col, "b)", "Direksiyon eğitimi ders saati sayısının 1/5'i veya daha az devam etmediğim taktirde bir defaya mahsus " +
                    "olmak üzere kendi durumum da dikkate alınarak o dönemde kurs müdürünün uygun göreceği bir zamanda devam etmediğim " +
                    "süre kadar telafi programı uygulanabileceğini ve bu telafi programları için devam ettiğim derslerin ücretini ayrıca " +
                    "ödeyeceğimi, telafi derslerine devam etmediğim taktirde kurstan kaydımın silineceğini bildiğimi,");

                Clause(col, "c)", "Teorik ve direksiyon eğitimi derslerinin sınavlarına herhangi bir nedenle girmemem veya teorik sınavda " +
                    "başarısız olmam halinde yeniden kursa devam etmeksizin ve kurs ücreti ödemeden aralıksız üç dönem daha sınavlara " +
                    "girebileceğimi,");

                Clause(col, "ç)", "Direksiyon eğitimi dersi sınavından önce ön sınava gireceğimi, bu sınavda başarılı olmam durumunda " +
                    "direksiyon eğitimi dersi sınavına girebileceğim bildiğimi, direksiyon eğitimi dersi sınavında başarısız olduğum her " +
                    "sınavdan sonra, ayrıca ücretini ödeyerek kurstan en az iki saat direksiyon eğitimi dersi almam şartıyla toplam üç " +
                    "dönem daha direksiyon eğitimi dersi sınavına girebileceğimi,");

                Clause(col, "d)", "Direksiyon eğitimi dersi sınavında 4 üncü hakkımda da başarısız olmam halinde ikinci 4 üncü hak için " +
                    "devam etme isteğimi kursa bildirdikten sonra tarafıma verilecek en az Birinci Bölüm (b) bendinde belirtilen saat " +
                    $"kadar direksiyon eğitimi dersi karşılığında {Money(d.FailedFourthAttemptFee)} TL ödeme yapacağımı,");

                Clause(col, "d)", "Yukarıda belirtilen saatlerde direksiyon eğitimi almama rağmen kendimi yetersiz bulup ek eğitim talep " +
                    "etmem halinde ilan edilen ders saati ücreti üzerinden ücret ödeyeceğimi,");

                Clause(col, "e)", "Teorik derslerin eğitimini ve direksiyon eğitimi dersini tamamladıktan sonra tanımlanan ilk sınavdan " +
                    "başlamak üzere direksiyon eğitimi dersi sınavına girmek zorunda olduğumu,");

                Clause(col, "f)", "Direksiyon eğitimi dersi sınavına randevu saatimde gelerek sınava gireceğimi,");

                Clause(col, "ğ)", $"Toplam {total} TL kurs ücretini peşin/… taksit olarak belirtilen tarih/tarihlerde kurs tarafından " +
                    "belirtilen hesap numarasına ödeyeceğimi,");

                // ── Ödeme planı ──
                col.Item().PaddingTop(10).PaddingHorizontal(40).Table(t =>
                {
                    t.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(2); });

                    foreach (var head in new[] { "İşlem", "Tutar", "Vade Tarihi", "Ödeme Tarihi" })
                        t.Cell().Border(1).BorderColor(Line).Padding(4).AlignCenter().Text(head).Bold().FontSize(10.5f);

                    // Peşinat satırı her zaman basılır; kalan satırlar taksitlerden gelir,
                    // matbu formdaki gibi en az 7 taksit satırı boş da olsa çizilir.
                    PlanRow(t, "Peşinat", d.DownPayment > 0 ? Money(d.DownPayment) + " TL" : string.Empty, null, null);

                    for (var i = 0; i < Math.Max(7, d.Installments.Count); i++)
                    {
                        var inst = i < d.Installments.Count ? d.Installments[i] : null;
                        PlanRow(t,
                            inst?.Label is { Length: > 0 } label ? label : $"{i + 1}. Taksit",
                            inst is null ? string.Empty : Money(inst.Amount) + " TL",
                            inst?.DueDateUtc,
                            inst?.PaidAtUtc);
                    }
                });

                Clause(col, "h)", $"Kursa peşin/taksitli olarak ödediğim/ödeyeceğim toplam {total} kurs ücretinin, tarafıma verilmesi " +
                    $"zorunlu {d.TheoryHours} saat teorik dersin bir saatlik ücretinin {theoryHourly}, tarafıma verilmesi zorunlu " +
                    $"{d.DrivingHours} saat direksiyon eğitimi dersinin bir saatlik ücretinin {drivingHourly} olduğunu,");

                Clause(col, "l)", "Direksiyon eğitimi dersi sınavında komisyonların veya diğer görevlilerin çalışmasını tehdit veya zor " +
                    "kullanarak engellemem ya da engellettirmem halinde iki yıl süre ile sınav hakkımı kullanamayacağımı, kaydımın iki " +
                    "yıl süreyle dondurulduğunu, bu konuda kazanılmış haklarımı kaybedeceğimi, başka bir kursa kayıt yaptıramayacağımı, " +
                    "iki yıl bitiminde tekrar sürücü kurslarına kayıt yaptırabileceğimi bildiğimi,");

                col.Item().PaddingLeft(16).Text("kabul ve taahhüt ederim.");

                col.Item().PaddingTop(6).AlignCenter().Text("ORTAK HÜKÜMLER").Bold().FontSize(11);

                col.Item().PaddingTop(6).PaddingLeft(10).Column(common =>
                {
                    common.Item().Text("a) Bu sözleşmede aksine hüküm bulunmayan hâllerde veya eksik kalan hususlarda 5580 sayılı Özel " +
                                       "Öğretim Kurumları Kanunu ve ilgili diğer mevzuat hükümlerinin uygulanacağını,");
                    common.Item().PaddingTop(3).Text($"b) Bu sözleşmenin uygulanmasından doğacak anlaşmazlıklar için, " +
                                                     $"{d.JurisdictionCity.ToUpper(Tr)} mahkemelerinin yetkili olduğunu,");
                    common.Item().PaddingTop(3).Text("c) Millî Eğitim Bakanlığı Özel Öğretim Kurumları Yönetmeliği'nin 53 üncü maddesi " +
                                                     "hükmü gereği düzenlenen işbu kayıt sözleşmesinin imza tarihi itibari ile yürürlüğe gireceğini");
                    common.Item().PaddingTop(3).Text("kabul ve taahhüt ederiz.");
                });

                col.Item().PaddingTop(12).PaddingLeft(10).Text(t =>
                {
                    t.Justify();
                    t.Span($"Bu sözleşme kurs müdürü ve kursiyer tarafından bütün maddeleri okunup müzakere edildikten sonra " +
                           $"{Local(d.RegisteredAtUtc):dd.MM.yyyy} tarihinde 1 nüsha olarak düzenlenmiş fotokopisi kursiyere verilmiş olup " +
                           "düzenlenen nüsha MEBBİS modülüne yüklenerek kursta muhafaza edilmektedir.");
                });

                col.Item().PaddingTop(22).Row(row =>
                {
                    row.RelativeItem().AlignCenter().Column(x =>
                    {
                        x.Item().AlignCenter().Text("Kursiyer");
                        x.Item().AlignCenter().Text(d.FullName.ToUpper(Tr));
                        x.Item().AlignCenter().Text("İmzası");
                    });
                    row.RelativeItem().AlignCenter().Column(x =>
                    {
                        x.Item().AlignCenter().Text("Kurs Müdürü");
                        x.Item().AlignCenter().Text(d.DirectorName);
                    });
                });
            });
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Ortak yardımcılar
    // ══════════════════════════════════════════════════════════════════════════
    private static void SetupPage(PageDescriptor page, float fontSize)
    {
        page.Size(PageSizes.A4);
        page.Margin(30);
        // Yazı tipi bilerek belirtilmiyor: sunucuda (Linux) sistem fontu bulunmayabilir,
        // QuestPDF'in gömülü fontu Türkçe karakterlerin tamamını karşılıyor.
        page.DefaultTextStyle(x => x.FontSize(fontSize).FontColor(Ink));
    }

    /// <summary>Tablo içinde tam genişlik kaplayan, ortalanmış kalın başlık şeridi.</summary>
    private static void Band(TableDescriptor t, int span, string title) =>
        t.Cell().ColumnSpan((uint)span).Border(1).BorderColor(Line).Padding(4)
            .AlignCenter().Text(title).Bold().FontSize(10);

    /// <summary>"Etiket : değer" biçimindeki kimlik hücresi.</summary>
    private static void Pair(TableDescriptor t, int span, string label, string value) =>
        Cell(t, span).Row(row =>
        {
            row.RelativeItem(5).Text(label);
            row.RelativeItem(7).Text($": {value}");
        });

    /// <summary>Sözleşmedeki iki sütunlu künye satırı — etiket sabit genişlikte.</summary>
    private static void Field(TableDescriptor t, string label, string value) =>
        t.Cell().Border(1).BorderColor(Line).Padding(4).Row(row =>
        {
            row.RelativeItem(4).Text(label);
            row.RelativeItem(6).Text($": {value}");
        });

    private static IContainer Cell(TableDescriptor t, int span) =>
        t.Cell().ColumnSpan((uint)span).Border(1).BorderColor(Line).Padding(4);

    /// <summary>Girintili, iki yana yaslı sözleşme maddesi.</summary>
    private static void Clause(ColumnDescriptor col, string marker, string body) =>
        col.Item().PaddingTop(4).Text(t =>
        {
            t.Justify();
            t.Span($"        {marker} ");
            t.Span(body);
        });

    private static void PlanRow(TableDescriptor t, string label, string amount, DateTime? dueUtc, DateTime? paidUtc)
    {
        t.Cell().Border(1).BorderColor(Line).Padding(4).AlignCenter().Text(label);
        t.Cell().Border(1).BorderColor(Line).Padding(4).AlignCenter().Text(amount);
        t.Cell().Border(1).BorderColor(Line).Padding(4).AlignCenter()
            .Text(dueUtc is null ? string.Empty : Local(dueUtc.Value).ToString("dd.MM.yyyy"));
        t.Cell().Border(1).BorderColor(Line).Padding(4).AlignCenter()
            .Text(paidUtc is null ? string.Empty : Local(paidUtc.Value).ToString("dd.MM.yyyy"));
    }

    private static string Money(decimal value) => value.ToString("N2", Tr);

    private static DateTime Local(DateTime utc) => utc.AddHours(3);

    /// <summary>
    /// Kursiyer dosyasındaki serbest metin doğum tarihini matbu formun beklediği
    /// gün/ay/yıl düzenine çevirir. Kayıt "2000-04-15" olarak saklanıyor ve forma
    /// aynen basılıyordu; alan başlığı "Gün/Ay/Yıl" olduğu için yanlış okunuyordu.
    /// Çözümlenemeyen değer olduğu gibi bırakılır (veri kaybolmasın).
    /// </summary>
    private static string BirthDateText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var text = value.Trim();
        string[] formats = ["yyyy-MM-dd", "yyyy/MM/dd", "dd.MM.yyyy", "dd/MM/yyyy", "yyyy-MM-ddTHH:mm:ss", "o"];
        return DateTime.TryParseExact(text, formats, Tr, DateTimeStyles.None, out var parsed)
            || DateTime.TryParse(text, Tr, DateTimeStyles.None, out parsed)
            ? parsed.ToString("dd/MM/yyyy", Tr)
            : text;
    }

    /// <summary>
    /// Telefonu "0533 111 22 33" biçiminde okunur hâle getirir; ham "905331112233"
    /// matbu evrakta okunmuyordu. Tanınmayan biçim olduğu gibi bırakılır.
    /// </summary>
    private static string PhoneText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("90", StringComparison.Ordinal) && digits.Length == 12) digits = digits[2..];
        else if (digits.Length == 11 && digits[0] == '0') digits = digits[1..];
        if (digits.Length != 10) return value.Trim();
        return $"0{digits[..3]} {digits[3..6]} {digits[6..8]} {digits[8..]}";
    }

    private static string Or(string value, string fallback) => string.IsNullOrWhiteSpace(value) ? fallback : value;

    /// <summary>İki parçayı tire ile birleştirir; biri boşsa yalnız doluyu döndürür.</summary>
    private static string JoinDash(string left, string right)
    {
        if (string.IsNullOrWhiteSpace(left)) return right.Trim();
        if (string.IsNullOrWhiteSpace(right)) return left.Trim();
        return $"{left.Trim()}-{right.Trim()}";
    }
}
