namespace CourseIntellect.Domain.Services;

/// <summary>
/// Asistanın "nasıl yapılır / nerede" cevapları için elle yazılmış yardım makalesi.
/// Routes: portal → o portaldaki gerçek sayfa (masaüstü rotası). Makale yalnız Routes'ta
/// bulunan portallara gösterilir; böylece hiçbir rol açamayacağı bir sayfaya yönlendirilmez.
/// Keywords: aksansız, küçük harf anahtar kelimeler (eşleşme puanı için).
/// </summary>
public sealed record AssistantHelpArticle(
    string Id,
    string TitleTr,
    string TitleEn,
    IReadOnlyList<string> Keywords,
    IReadOnlyList<string> StepsTr,
    IReadOnlyList<string> StepsEn,
    IReadOnlyDictionary<string, string> Routes);

/// <summary>
/// Portal içi yardım kataloğu. Yapay zekâ cevap UYDURMAZ: soru bu listedeki bir makaleyle
/// eşleşir ya da asistan bilmediğini söyler. Yeni modül eklenince buraya makale eklenmeli;
/// rotaların gerçekten var olduğunu <c>AssistantHelpCatalogTests</c> doğrular.
/// </summary>
public static class AssistantHelpCatalog
{
    private static Dictionary<string, string> R(params (string Portal, string Route)[] routes) =>
        routes.ToDictionary(item => item.Portal, item => item.Route);

    public static readonly IReadOnlyList<AssistantHelpArticle> Articles =
    [
        new("attendance-take", "Yoklama alma", "Taking attendance",
            ["yoklama", "yoklama al", "devamsizlik gir", "derse gelmedi", "take attendance"],
            ["Menüden Yoklama sayfasını açın.", "Sınıfı ve dersi seçin.", "Gelmeyen öğrencileri işaretleyip kaydedin; veliye bildirim otomatik gider."],
            ["Open the Attendance page from the menu.", "Choose the class and lesson.", "Mark absent students and save; parents are notified automatically."],
            R(("teacher", "/t/attendance"), ("admin", "/attendance"))),
        new("homework-assign", "Ödev verme", "Assigning homework",
            ["odev ver", "odev olustur", "odev ekle", "odev gonder", "assign homework", "create assignment"],
            ["Ödevler sayfasını açın.", "Yeni ödev oluşturun; sınıf, ders ve son teslim tarihini seçin.", "Kaydettiğinizde öğrencilere ve velilere bildirim gider."],
            ["Open the Assignments page.", "Create a new assignment; choose class, subject and due date.", "Students and parents are notified when you save."],
            R(("teacher", "/t/assignments"))),
        new("homework-view", "Ödevlerimi görme ve teslim etme", "Viewing and submitting homework",
            ["odevlerim", "odev teslim", "odevimi nasil", "odev yukle", "submit homework", "my homework", "hand in"],
            ["Menüden Ödevlerim sayfasını açın.", "Teslim edeceğiniz ödevi seçin.", "Dosyanızı ya da cevabınızı ekleyip teslim edin."],
            ["Open My Assignments from the menu.", "Choose the assignment.", "Attach your file or answer and submit."],
            R(("student", "/s/assignments"))),
        new("exam-create", "Sınav oluşturma", "Creating an exam",
            ["sinav olustur", "sinav hazirla", "deneme olustur", "online sinav", "create exam", "new exam"],
            ["Sınavlar sayfasında Yeni sınav'a tıklayın.", "Soru bankasından soru seçin ya da yeni soru ekleyin.", "Sınıfı ve tarih/saati seçip yayınlayın."],
            ["Click New exam on the Exams page.", "Pick questions from the question bank or add new ones.", "Choose the class and date/time, then publish."],
            R(("teacher", "/t/exams/create"), ("admin", "/exams/create"))),
        new("optical-import", "Optik deneme yükleme", "Uploading an optical mock exam",
            ["optik", "optik deneme", "optik form", "optik okuyucu", "deneme yukle", "cevap anahtari", "optical", "answer key"],
            ["Optik Denemeler sayfasını açın.", "İlk kullanımda optik şablonu bir kez tanımlayın (öğrenci no, ad ve cevap kolonları).", "Yeni deneme oluşturup cevap anahtarını ve her sorunun konusunu girin.", "Dosya yükle ile optik dosyasını seçin, önizlemeyi kontrol edip aktarın."],
            ["Open the Optical Mock Exams page.", "Define the optical template once (student no, name and answer columns).", "Create a mock exam and enter the answer key and topic of each question.", "Upload the optical file, check the preview and import."],
            R(("admin", "/optical-exams"), ("teacher", "/t/optical-exams"))),
        new("topic-insights", "Öğrenci konu analizi", "Student topic analysis",
            ["konu analizi", "zayif konu", "hangi konu", "konu bazli", "eksik konu", "topic analysis"],
            ["Konu Analizi sayfasını açın.", "Sınıfı seçin; öğrenciler en çok desteğe ihtiyacı olandan başlayarak sıralanır.", "Öğrenciye tıklayınca zayıf konular, nedenleri ve önerileri görünür."],
            ["Open the Topic Analysis page.", "Choose a class; students are listed starting with those who need the most support.", "Click a student to see weak topics, reasons and recommendations."],
            R(("admin", "/insights"), ("teacher", "/t/insights"))),
        new("my-topics", "Çalışmam gereken konular", "Topics I should study",
            ["calismam gereken", "zayif oldugum", "eksik konularim", "konularim", "topics should i study", "what should i study"],
            ["Sınav Sonuçlarım sayfasını açın.", "Çalışman gereken konular bölümünde zayıf konuların ve öneriler yer alır.", "Bana \"hangi konulara çalışmalıyım\" diye de sorabilirsin."],
            ["Open My Exam Results.", "The Topics you should study section lists weak topics and tips.", "You can also ask me \"which topics should I study\"."],
            R(("student", "/s/exam-results"), ("parent", "/p/weekly-report"))),
        new("club-create", "Kulüp açma", "Creating a club",
            ["kulup", "kulup ac", "kulup olustur", "kulup kur", "create club", "new club"],
            ["Kulüpler sayfasında Yeni kulüp'e tıklayın.", "Kategori, danışman öğretmen, kontenjan ve toplantı saatini girin.", "Kaydedin; öğrenciler katılma isteği gönderebilir."],
            ["Click New club on the Clubs page.", "Enter category, advisor, capacity and meeting time.", "Save; students can then send join requests."],
            R(("admin", "/clubs"), ("administrative", "/clubs"))),
        new("club-join", "Kulübe katılma", "Joining a club",
            ["kulube katil", "kulup uye", "kulupler", "join club", "join a club"],
            ["Kulüpler sayfasını açın.", "İlgilendiğin kulübü seçip Katılma isteği gönder.", "Danışman öğretmen onaylayınca üye olursun."],
            ["Open the Clubs page.", "Choose a club and send a join request.", "You become a member once the advisor approves."],
            R(("student", "/s/clubs"), ("parent", "/p/clubs"), ("teacher", "/t/clubs"))),
        new("subject-groups", "Zümre oluşturma", "Creating subject departments",
            ["zumre", "zumre baskani", "zumre olustur", "subject department"],
            ["Zümreler sayfasını açın.", "Önerilen zümrelerden birini seçin ya da Zümre oluştur'a tıklayın.", "Zümre başkanını ve üye öğretmenleri seçip kaydedin."],
            ["Open the Subject Departments page.", "Pick a suggested department or click Create Department.", "Choose the head and member teachers, then save."],
            R(("admin", "/admin/subject-groups"), ("teacher", "/t/subject-groups"))),
        new("visitor-log", "Ziyaretçi kaydı", "Logging a visitor",
            ["ziyaretci", "ziyaretci kaydi", "ziyaretci giris", "misafir", "visitor"],
            ["Ziyaretçi Takibi sayfasında Ziyaretçi girişi'ne tıklayın.", "Ad, ziyaret edilen kişi ve amacı girin; KVKK aydınlatmasını işaretleyin.", "Çıkışta Çıkış düğmesine basın; kayıtlar bir yıl sonra otomatik silinir."],
            ["Click Visitor check-in on the Visitor Tracking page.", "Enter name, host and purpose; confirm the privacy notice.", "Press Check out when they leave; records are deleted after one year."],
            R(("admin", "/visitors"), ("administrative", "/visitors"))),
        new("preference-robot", "Tercih robotu", "Preference robot",
            ["tercih robotu", "tercih", "lgs", "yks", "taban puan", "universite", "preference robot", "university"],
            ["Tercih Robotu sayfasını açın.", "YKS ya da LGS seçin; puanınızı girin veya netlerinizden hesaplatın.", "İl, üniversite ve bölüm seçip uygun programları görün; öğrenciler listesini kaydedebilir."],
            ["Open the Preference Robot page.", "Choose YKS or LGS; enter a score or calculate it from net counts.", "Pick province, university and department to see programs; students can save a list."],
            R(("student", "/s/preference-robot"), ("parent", "/p/preference-robot"), ("teacher", "/t/preference-robot"), ("admin", "/preference-robot"))),
        new("message-send", "Mesaj gönderme", "Sending a message",
            ["mesaj gonder", "mesaj at", "mesajlasma", "ogretmene yaz", "veliye yaz", "send message", "send a message"],
            ["Mesajlar sayfasını açın.", "Yeni sohbet başlatıp kişiyi seçin.", "Mesajınızı yazıp gönderin."],
            ["Open the Messages page.", "Start a new chat and choose the person.", "Type your message and send."],
            R(("teacher", "/t/chat"), ("student", "/s/chat"), ("parent", "/p/chat"), ("admin", "/chat"), ("administrative", "/chat"), ("accounting", "/chat"))),
        new("announcement-create", "Duyuru yayınlama", "Publishing an announcement",
            ["duyuru yap", "duyuru yayinla", "duyuru olustur", "duyuru gonder", "publish announcement", "new announcement"],
            ["Duyurular sayfasında Yeni duyuru'ya tıklayın.", "Başlık, metin ve hedef kitleyi seçin.", "Yayınladığınızda ilgili kişilere bildirim gider."],
            ["Click New announcement on the Announcements page.", "Enter title, text and audience.", "Recipients are notified when you publish."],
            R(("admin", "/admin/announcements"), ("teacher", "/t/announcements"))),
        new("excuse-request", "Mazeret bildirme", "Reporting an absence excuse",
            ["mazeret", "rapor bildir", "izin iste", "devamsizlik mazeret", "excuse", "report an absence", "report absence"],
            ["Mazeret Bildirimi sayfasını açın.", "Tarihi ve nedeni yazın, varsa belge ekleyin.", "Gönderdiğinizde okul onaylar."],
            ["Open the Excuse Request page.", "Enter the date and reason, attach a document if any.", "The school reviews it after you submit."],
            R(("parent", "/p/excuse-request"))),
        new("payments-view", "Ödemeleri görme", "Viewing payments",
            ["odemelerim", "taksit", "makbuz", "borcum", "odeme yap", "my payments", "receipt"],
            ["Ödemeler sayfasını açın.", "Taksitleri, ödenen ve kalan tutarı görebilirsiniz.", "Makbuzlar sayfasından ödeme belgelerini indirebilirsiniz."],
            ["Open the Payments page.", "You can see installments, paid and remaining amounts.", "Download receipts from the Receipts page."],
            R(("parent", "/p/payments"))),
        new("collection", "Tahsilat alma", "Recording a payment",
            ["tahsilat al", "tahsilat yap", "odeme al", "toplu tahsilat", "record payment", "bulk collection"],
            ["Tahsilatlar sayfasını açın.", "Öğrenciyi seçip tutar ve ödeme yöntemini girin.", "Birden fazla öğrenci için Toplu tahsilat'ı kullanabilirsiniz."],
            ["Open the Collections page.", "Choose the student and enter amount and method.", "Use Bulk collection for several students."],
            R(("accounting", "/finance/collections"), ("admin", "/finance/collections"))),
        new("day-close", "Gün sonu kapanışı", "Closing the cash day",
            ["gun sonu", "kasa kapat", "gun kapanis", "close the day", "day closing"],
            ["Kasa Raporu sayfasını açın.", "Günün tahsilat ve giderlerini kontrol edin.", "Gün sonunu kapatın; kapanan güne kayıt eklenemez."],
            ["Open the Cash Report page.", "Check the day's collections and expenses.", "Close the day; closed days can't be changed."],
            R(("accounting", "/finance/cash-report"), ("admin", "/finance/cash-report"))),
        new("salary", "Maaş girme ve ödeme", "Entering and paying salaries",
            ["maas", "maas gir", "maas ode", "bordro", "salary", "payroll"],
            ["Maaşlar sayfasını açın.", "Personeli seçip net maaşı girin.", "Ödendi olarak işaretlediğinizde gider kaydına yansır."],
            ["Open the Salaries page.", "Choose staff and enter the net salary.", "Marking it paid records it as an expense."],
            R(("accounting", "/finance/salary"), ("admin", "/finance/salary"))),
        new("student-registration", "Öğrenci kaydı", "Registering a student",
            ["ogrenci kaydi", "yeni ogrenci", "kayit yap", "ogrenci ekle", "register student", "enroll"],
            ["Öğrenci Kaydı sayfasını açın.", "Öğrenci ve veli bilgilerini girin; TC kimlik numarası doğrulanır.", "Kaydettiğinizde öğrenci ve veli hesapları oluşur."],
            ["Open the Student Registration page.", "Enter student and parent details; the ID number is validated.", "Student and parent accounts are created when you save."],
            R(("admin", "/admin/student-registration"))),
        new("schedule-view", "Ders programını görme", "Viewing the timetable",
            ["ders programi nerede", "program nerede", "ders programimi", "timetable"],
            ["Menüden Ders Programı sayfasını açın.", "Haftalık programı gün gün görebilirsiniz.", "Bana \"bugün hangi derslerim var\" diye de sorabilirsiniz."],
            ["Open the Timetable page from the menu.", "You can see the weekly schedule day by day.", "You can also ask me \"what lessons do I have today\"."],
            R(("student", "/s/schedule"), ("teacher", "/t/schedule"), ("admin", "/schedule"), ("administrative", "/admin/schedule"))),
        new("reports", "Rapor alma", "Getting reports",
            ["rapor al", "rapor indir", "pdf rapor", "raporlar", "report"],
            ["Raporlar sayfasını açın.", "Rapor türünü ve sınıfı seçin.", "PDF olarak indirebilirsiniz."],
            ["Open the Reports page.", "Choose the report type and class.", "You can download it as a PDF."],
            R(("admin", "/reports"), ("administrative", "/reports"), ("teacher", "/t/reports"))),
        new("password-change", "Şifre değiştirme", "Changing your password",
            ["sifre", "sifremi degistir", "parola", "password"],
            ["Ayarlar sayfasını açın.", "Güvenlik bölümünde mevcut ve yeni şifrenizi girin.", "Kaydettiğinizde diğer cihazlardaki oturumlar kapanır."],
            ["Open Settings.", "Enter your current and new password under Security.", "Sessions on other devices are signed out when you save."],
            R(("student", "/s/settings"), ("teacher", "/settings"), ("parent", "/settings"), ("admin", "/settings"), ("administrative", "/settings"), ("accounting", "/settings"))),
        new("language-theme", "Dil ve tema değiştirme", "Changing language and theme",
            ["ingilizce", "dil degistir", "karanlik tema", "koyu tema", "tema", "language", "dark mode", "theme"],
            ["Sol alt köşedeki güneş/ay simgesiyle açık ve koyu tema arasında geçiş yapın.", "Yanındaki TR/EN düğmesiyle dili değiştirin."],
            ["Use the sun/moon icon at the bottom left to switch between light and dark theme.", "Use the TR/EN button next to it to change the language."],
            R(("student", "/s/settings"), ("teacher", "/settings"), ("parent", "/settings"), ("admin", "/settings"), ("administrative", "/settings"), ("accounting", "/settings"))),
    ];

    /// <summary>
    /// Soruya en uygun makale. Önce bu portala açık makaleler; eşleşme yoksa başka portala
    /// ait bir makale (otherPortal=true) döner ki asistan "bu işlem X panelinden yapılıyor" diyebilsin.
    /// Eşleşme kelime bazlıdır ve Türkçe ekleri tolere eder: bir anahtar ifadenin her kelimesi
    /// metindeki bir kelimenin başına uymalı (kulüp/kulübe, katıl/katılırım). Puan: eşleşen
    /// ifadelerin kelime sayısı toplamı (uzun ifade daha belirleyici).
    /// </summary>
    public static (AssistantHelpArticle? Article, bool OtherPortal) Match(string foldedText, string portal)
    {
        var tokens = foldedText.Split([' ', ',', '.', '?', '!', '\'', '’'], StringSplitOptions.RemoveEmptyEntries);

        static bool WordMatches(string word, string token)
        {
            if (token.StartsWith(word, StringComparison.Ordinal)) return true;
            if (word.Length < 4 || token.Length < 4) return false;
            var common = 0;
            while (common < word.Length && common < token.Length && word[common] == token[common]) common++;
            // Ünsüz yumuşaması (kulüp → kulübe, kitap → kitabı): son harf değişebilir.
            return common >= Math.Max(4, word.Length - 1);
        }

        int Score(AssistantHelpArticle article) => article.Keywords
            .Select(keyword => keyword.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Where(words => words.All(word => tokens.Any(token => WordMatches(word, token))))
            .Sum(words => words.Length);

        var ranked = Articles
            .Select(article => (Article: article, Score: Score(article)))
            .Where(item => item.Score > 0)
            .OrderByDescending(item => item.Score)
            .ToList();
        var own = ranked.FirstOrDefault(item => item.Article.Routes.ContainsKey(portal));
        if (own.Article is not null) return (own.Article, false);
        return ranked.Count > 0 ? (ranked[0].Article, true) : (null, false);
    }
}
