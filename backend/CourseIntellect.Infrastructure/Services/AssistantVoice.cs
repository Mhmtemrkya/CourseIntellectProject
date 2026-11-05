using System.Globalization;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Asistanın konuşma dili. Bütün kullanıcıya görünen cümleler buradan çıkar; sayılar ve
/// adlar her zaman veritabanından gelir, model metin UYDURMAZ.
/// - Öğrenciye "sen", personel ve veliye "siz" ile hitap edilir.
/// - Selam ad ve günün saatiyle kişiselleşir.
/// - Aynı soruya birkaç doğal varyant vardır; seçim mesaj kimliğinden deterministik yapılır
///   (testler kararlı kalır, kullanıcı hep aynı robot cümlesini görmez).
/// - İngilizce arayüz için her cümlenin EN karşılığı vardır.
/// </summary>
public sealed class AssistantVoice
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private static readonly CultureInfo En = CultureInfo.GetCultureInfo("en-US");
    private readonly int seed;

    public AssistantVoice(string portal, string displayName, bool english, Guid seed, DateTime utcNow)
    {
        Portal = portal;
        English = english;
        this.seed = Math.Abs(BitConverter.ToInt32(seed.ToByteArray(), 0) % 997);
        FirstName = FirstNameOf(displayName);
        LocalHour = utcNow.AddHours(3).Hour;
    }

    public string Portal { get; }
    public bool English { get; }
    public string FirstName { get; }
    public int LocalHour { get; }
    private bool Informal => Portal == "student";
    private CultureInfo Culture => English ? En : Tr;

    private string T(string tr, string en) => English ? en : tr;
    /// <summary>Hitaba göre seçim: öğrenciye "sen", diğerlerine "siz".</summary>
    private string S(string sen, string siz) => Informal ? sen : siz;
    private string Pick(params string[] variants) => variants[seed % variants.Length];
    private string N(decimal value) => value.ToString("N0", Culture);
    private string Money(decimal value) => English ? $"₺{value.ToString("N0", En)}" : $"{value.ToString("N0", Tr)} ₺";

    private static string FirstNameOf(string displayName)
    {
        var first = (displayName ?? string.Empty).Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? string.Empty;
        if (first.Length == 0) return string.Empty;
        var lower = first.ToLower(Tr);
        return char.ToUpper(lower[0], Tr) + lower[1..];
    }

    /// <summary>Hitap: öğretmene "Hasan Hoca", diğerlerine ad.</summary>
    private string Address => FirstName.Length == 0 ? string.Empty
        : Portal == "teacher" && !English ? $"{FirstName} Hoca" : FirstName;

    private string TimeGreeting => LocalHour switch
    {
        >= 5 and < 12 => T("Günaydın", "Good morning"),
        >= 12 and < 18 => T("İyi günler", "Good afternoon"),
        >= 18 and < 23 => T("İyi akşamlar", "Good evening"),
        _ => T("Merhaba", "Hello"),
    };

    // ── Sohbet ───────────────────────────────────────────────────────────────

    public string Greeting(string folded = "")
    {
        // Kullanıcı "günaydın" dediyse saat ne olursa olsun aynı selamla karşılık verilir; insan da öyle yapar.
        var greeting = folded switch
        {
            _ when folded.Contains("gunaydin") || folded.Contains("good morning") => T("Günaydın", "Good morning"),
            _ when folded.Contains("iyi aksamlar") || folded.Contains("good evening") => T("İyi akşamlar", "Good evening"),
            _ when folded.Contains("iyi gunler") => T("İyi günler", "Good afternoon"),
            _ when folded.Contains("selam") => T("Selam", "Hi"),
            _ when $" {folded.TrimEnd('!', '.', ',')} ".Contains(" hi ") || folded.Contains("hello") => T("Merhaba", "Hi"),
            _ => TimeGreeting,
        };
        var hello = Address.Length > 0 ? $"{greeting} {Address}!" : $"{greeting}!";
        return $"{hello} " + Pick(
            T(S("Bugün sana nasıl yardımcı olabilirim?", "Size bugün nasıl yardımcı olabilirim?"), "How can I help you today?"),
            T(S("Ne öğrenmek istersin?", "Neye bakmamı istersiniz?"), "What would you like to know?"),
            T(S("Hazırım, ne soracaksın?", "Hazırım, ne sormak istersiniz?"), "I'm ready — what would you like to ask?"));
    }

    /// <summary>Sohbet cümlesine türüne göre insanca, kısa ve kibar cevap.</summary>
    public string Social(SocialKind kind, string folded) => kind switch
    {
        SocialKind.Greeting => Greeting(folded),
        SocialKind.HowAreYou => (AssistantSmallTalk.Has(folded, SocialKind.Greeting) ? HelloPrefix(folded) + " " : string.Empty) + HowAreYou(),
        SocialKind.Identity => AssistantSmallTalk.Has(folded, SocialKind.Identity)
            ? T($"İnsan değilim; ben {AssistantSmallTalk.Name}, SchoolAsist'in dijital asistanıyım. ", $"I'm not a person — I'm {AssistantSmallTalk.Name}, SchoolAsist's digital assistant. ") + IntroBody()
            : Intro(),
        SocialKind.Thanks => AssistantSmallTalk.Has(folded, SocialKind.Farewell)
            ? T(S("Rica ederim! Görüşmek üzere, kendine iyi bak.", "Rica ederim! Görüşmek üzere, iyi çalışmalar dilerim."), "You're welcome! See you soon, take care.")
            : folded.Contains("isime yaradi") || folded.Contains("yardimci oldu")
                ? T("Yardımcı olabildiysem ne mutlu bana! Başka bir şey olursa buradayım.", "Glad I could help! I'm here if you need anything else.")
                : Thanks(),
        SocialKind.Farewell => Farewell(folded),
        SocialKind.WellWish => folded.Contains("iyi calismalar") || folded.Contains("hayirli")
            ? T(S($"Sağ ol{Comma}, sana da iyi çalışmalar! Bir şey lazım olursa buradayım.", $"Sağ olun{Comma}, size de iyi çalışmalar! Bir şeye ihtiyacınız olursa buradayım."), "Thank you, have a productive day too! I'm here if you need anything.")
            : T(S($"Sağ ol{Comma}, sana da kolay gelsin! Bir şey lazım olursa buradayım.", $"Sağ olun{Comma}, size de kolay gelsin! Bir şeye ihtiyacınız olursa buradayım."), "Thank you, good luck with your work too! I'm here if you need anything."),
        SocialKind.Compliment => Pick(
            T(S("Çok naziksin, teşekkür ederim! Yardımcı olabildiğime sevindim.", "Çok naziksiniz, teşekkür ederim! Yardımcı olabildiğime sevindim."), "That's very kind of you, thank you! Glad I could help."),
            T(S("Bunu duymak çok güzel, teşekkürler! Başka neye bakalım?", "Bunu duymak çok güzel, teşekkür ederim! Başka neye bakalım?"), "That's lovely to hear, thanks! What else shall we look at?")),
        SocialKind.Apology => T(S("Hiç sorun değil! Nereden devam edelim?", "Hiç sorun değil, lütfen rahat olun! Nereden devam edelim?"), "No problem at all! Where shall we continue?"),
        SocialKind.Frustration => T(
            S("Kusura bakma, bu sefer seni doğru anlayamadım. Sorunu biraz farklı yazarsan tekrar deneyeyim; öğrenci adı, sınıf ya da tarih eklemek çok işe yarar.",
              "Kusura bakmayın, bu sefer sizi doğru anlayamadım. Sorunuzu biraz farklı yazarsanız tekrar deneyeyim; öğrenci adı, sınıf ya da tarih eklemek çok işe yarar."),
            "Sorry, I didn't get that right this time. If you rephrase it I'll try again — adding a student name, class or date helps a lot."),
        SocialKind.Acknowledge => Pick(
            T(S("Tamamdır! Başka bir şey olursa buradayım.", "Tamamdır! Başka bir şey olursa buradayım."), "Great! I'm here if you need anything else."),
            T(S("Süper. Başka neye bakmamı istersin?", "Harika. Başka neye bakmamı istersiniz?"), "Great. What else would you like me to check?")),
        _ => Unknown(),
    };

    private string Comma => Address.Length > 0 ? $" {Address}" : string.Empty;

    private string HelloPrefix(string folded)
    {
        var hello = Greeting(folded);
        var end = hello.IndexOf('!');
        return end > 0 ? hello[..(end + 1)] : hello;
    }

    public string Farewell(string folded) => folded.Contains("iyi geceler") || folded.Contains("good night")
        ? T($"İyi geceler{Comma}! Görüşmek üzere.", "Good night! See you soon.")
        : Pick(
            T(S($"Görüşmek üzere{Comma}! Kendine iyi bak.", $"Görüşmek üzere{Comma}! İyi çalışmalar dilerim."), "See you soon! Take care."),
            T(S($"Hoşça kal{Comma}! İhtiyacın olunca buradayım.", $"Hoşça kalın{Comma}! İhtiyacınız olunca buradayım."), "Bye for now! I'm here whenever you need me."));

    public string Thanks() => Pick(
        T(S("Rica ederim! Başka bir şey olursa buradayım.", "Rica ederim! Başka bir konuda yardımcı olabilirsem buradayım."), "You're welcome! I'm here if you need anything else."),
        T(S("Ne demek, her zaman! Kolay gelsin.", "Ne demek, her zaman! İyi çalışmalar dilerim."), "Anytime! Have a good day."),
        T(S("Memnuniyetle. Başka sorun olursa yaz yeter.", "Memnuniyetle. Başka sorunuz olursa yazmanız yeterli."), "Happy to help. Just write if you have another question."));

    public string HowAreYou() => Pick(
        T(S("İyiyim, sorduğun için teşekkürler! Senin için neye bakayım?", "İyiyim, sorduğunuz için teşekkürler! Sizin için neye bakayım?"), "I'm doing well, thanks for asking! What can I look up for you?"),
        T(S("Teşekkürler, her şey yolunda. Bugün ne yapıyoruz?", "Teşekkürler, her şey yolunda. Bugün nasıl yardımcı olabilirim?"), "All good, thank you. How can I help today?"));

    /// <summary>"Sen kimsin / neler yapabilirsin": portala özel tanıtım.</summary>
    public string Intro() => T($"Ben {AssistantSmallTalk.Name}, SchoolAsist'in asistanıyım. ", $"I'm {AssistantSmallTalk.Name}, SchoolAsist's assistant. ") + IntroBody();

    private string IntroBody() => Portal switch
    {
        "student" => T("Senin ders programını, ödevlerini, sınav sonuçlarını, devamsızlığını ve çalışman gereken konuları gösterebilirim. Bir şeyin nasıl yapıldığını da sorabilirsin; seni doğru sayfaya götürürüm.",
            "I can show your timetable, homework, exam results, attendance and the topics you should study. You can also ask how to do something and I'll take you to the right page."),
        "parent" => T("Çocuğunuzun devamsızlığını, sınav sonuçlarını, ödevlerini, ödemelerini, servis bilgisini ve çalışması gereken konuları anlatabilirim. Mazeret bildirme gibi işlemlerin nasıl yapıldığını da gösteririm.",
            "I can tell you about your child's attendance, exam results, homework, payments, school bus and the topics to study. I can also show how to do things like reporting an absence."),
        "teacher" => T("Ders programınızı, sınıflarınızdaki öğrencileri, devamsızları, notu düşük öğrencileri ve bir öğrencinin zayıf olduğu konuları getirebilirim. Yoklama, ödev, sınav ve optik deneme gibi işlemlerin adımlarını da anlatırım.",
            "I can bring up your timetable, students in your classes, absentees, low scorers and a student's weak topics. I can also walk you through attendance, homework, exams and optical mock exams."),
        "administrative" => T("Öğrenci arama, günlük devamsızlar, sınıf listeleri, servis ve kütüphane bilgileri konusunda yardımcı olabilirim; ziyaretçi kaydı ya da kulüp açma gibi işlemlerin adımlarını da gösteririm.",
            "I can help with student search, today's absentees, class lists, school bus and library info, and show the steps for things like logging visitors or creating clubs."),
        "accounting" => T("Borcu olan öğrencileri, bir öğrencinin ödeme durumunu ve bu ayki tahsilat özetini getirebilirim. Tahsilat, gün sonu ve maaş gibi işlemlerin adımlarını da anlatırım.",
            "I can list students with debt, show a student's payment status and this month's collections. I can also explain collections, day closing and salaries."),
        _ => T("Kurum özeti, tahsilat, devamsızlar, notu düşük öğrenciler, öğrenci arama ve konu analizi gibi her konuda yardımcı olabilirim. Bir işlemin nasıl yapıldığını sorarsanız sizi doğru sayfaya götürürüm.",
            "I can help with the institution summary, collections, absentees, low scorers, student search and topic analysis. Ask how to do something and I'll take you to the right page."),
    };

    public string Unknown() => Pick(
        T(S("Bunu tam anlayamadım. Aşağıdakilerden birini deneyebilir ya da biraz daha açık yazabilirsin.", "Bunu tam anlayamadım. Aşağıdakilerden birini deneyebilir ya da biraz daha açık yazabilirsiniz."),
            "I didn't quite get that. Try one of the suggestions below or rephrase a little."),
        T(S("Hmm, bunu çıkaramadım. Örneğin şunları sorabilirsin:", "Bunu çıkaramadım. Örneğin şunları sorabilirsiniz:"),
            "Hmm, I couldn't work that out. For example, you can ask:"));

    public string Help() => T(S("Şunlarda yardımcı olabilirim — birine dokunman yeterli:", "Şunlarda yardımcı olabilirim — birine tıklamanız yeterli:"),
        "Here's what I can help with — just tap one:");

    // ── Yetki ve kapsam ─────────────────────────────────────────────────────

    /// <summary>Bu portalın sorusu değil: kibarca kendi alanına yönlendirir.</summary>
    public string OutOfPortal() => Portal switch
    {
        "student" => T("Bu bilgi öğretmen ve yönetim panelinde yer alıyor, o yüzden paylaşamıyorum. Ama sana kendi derslerin, ödevlerin, sınavların ve devamsızlığın konusunda seve seve yardımcı olurum.",
            "That information is in the teacher and management panels, so I can't share it. I'm happy to help with your own lessons, homework, exams and attendance."),
        "parent" => T("Bu bilgi okul yönetiminin panelinde yer alıyor. Ben size çocuğunuzla ilgili her konuda yardımcı olabilirim.",
            "That information is in the school management panel. I can help you with anything about your child."),
        "teacher" => T("Bu bilgi muhasebe ya da yönetim panelinde yer alıyor, öğretmen portalından görüntülenemiyor. Sınıflarınız ve öğrencilerinizle ilgili her konuda yardımcı olabilirim.",
            "That information is in the accounting or management panel and isn't available in the teacher portal. I can help with anything about your classes and students."),
        "administrative" => T("Bu bilgi idari portalın kapsamında değil. Öğrenci arama, devamsızlar, sınıf listeleri ve servis gibi konularda yardımcı olabilirim.",
            "That isn't covered by the administrative portal. I can help with student search, absentees, class lists and the school bus."),
        "accounting" => T("Akademik bilgiler muhasebe portalının kapsamında değil. Ödemeler, borçlar ve tahsilat konusunda yardımcı olabilirim.",
            "Academic information isn't part of the accounting portal. I can help with payments, debts and collections."),
        _ => T("Bu bilgi rolünüzün kapsamında değil.", "That information isn't within your role."),
    };

    public string OtherStudentDenied() => T(
        "Başka bir öğrencinin bilgilerini paylaşamam; bu senin gizliliğin için de geçerli. Kendi bilgilerinle ilgili ne istersen sorabilirsin.",
        "I can't share another student's information — the same protects your privacy too. Ask me anything about your own records.");

    public string EntitlementDenied() => T(
        "Bu özellik kurumunuzun paketinde ya da rol yetkilerinizde açık değil. Yöneticinizle görüşebilirsiniz.",
        "This feature isn't enabled in your institution's plan or your role permissions. You can check with your administrator.");

    public string InstitutionDenied(string institutionName) => T(
        $"Bu bilgi {institutionName} kurumlarında bulunmuyor. Size yardımcı olabileceğim konulardan birini seçebilirsiniz.",
        "That information doesn't apply to this type of institution. Pick one of the topics I can help with.");

    public string DriverDenied() => T(
        "Servis şoförü olarak yalnız atanmış hattınızdaki servis bilgilerine bakabiliyorum.",
        "As a driver, I can only show information about your assigned route.");

    public string Error(string correlationId) => T(
        $"Şu anda bu bilgiyi getiremedim, kusura bakmayın. Birazdan tekrar dener misiniz? (Referans: {correlationId})",
        $"Sorry, I couldn't fetch that right now. Could you try again in a moment? (Reference: {correlationId})");

    public string InvalidTc() => T("Bu geçerli bir TC kimlik numarası değil gibi görünüyor; numarayı kontrol eder misiniz?", "That doesn't look like a valid ID number; could you check it?");

    // ── Öğrenci bulma ───────────────────────────────────────────────────────

    public string StudentNotFound() => Pick(
        T(S("Bu isimde bir kayıt bulamadım.", "Bu isimde bir öğrenci bulamadım. Adı ya da sınıfı farklı yazmayı dener misiniz?"), "I couldn't find a student with that name. Could you try a different spelling or the class?"),
        T(S("Aradığın kişiyi bulamadım.", "Yetki kapsamınızdaki öğrenciler arasında bu isimde birini bulamadım. Soyadını da yazar mısınız?"), "I couldn't find that name among the students you can see. Could you add the surname?"));

    public string AskWhichStudent() => T(
        "Hangi öğrenciden bahsediyorsunuz? Adını yazmanız yeterli, örneğin \"Ali Yılmaz devamsızlığı\".",
        "Which student do you mean? Just type the name, e.g. \"Ali Yılmaz attendance\".");

    public string MultipleStudents(int count) => T(
        $"Bu isimde {count} öğrenci var. Hangisini kastettiğinizi seçer misiniz?",
        $"There are {count} students with that name. Which one do you mean?");

    public string ChooseChild() => T("Hangi çocuğunuz için bakayım?", "Which of your children should I look at?");

    public string StudentFound(string name, string className) => Pick(
        T($"{name} ({className}) burada. Neye bakmamı istersiniz?", $"Here's {name} ({className}). What should I look at?"),
        T($"{name} — {className}. Devamsızlık, sınav sonuçları ya da zayıf konular gibi neye bakayım?", $"{name} — {className}. Shall I check attendance, exam results or weak topics?"));

    // ── Veri cevapları ──────────────────────────────────────────────────────

    public string Attendance(string name, bool self, int total, int absent, int late)
    {
        if (total == 0) return T(self ? "Henüz yoklama kaydın görünmüyor." : $"{name} için henüz yoklama kaydı yok.", self ? "You don't have any attendance records yet." : $"No attendance records yet for {name}.");
        var lateText = late > 0 ? T($", {late} kez geç kalınmış", $", {late} late") : string.Empty;
        if (self)
        {
            return absent == 0
                ? T($"Son {total} ders kaydının hiçbirinde devamsızlığın yok{(late > 0 ? $", yalnız {late} kez geç kalmışsın" : string.Empty)}. Harika gidiyorsun!", $"No absences in your last {total} lessons{(late > 0 ? $", just {late} late" : string.Empty)}. Great job!")
                : T($"Son {total} ders kaydının {absent} tanesinde yoktun{lateText}. Devamsızlık sınırını aşmamak için dikkat etmekte fayda var.", $"You were absent in {absent} of your last {total} lessons{lateText}. Keep an eye on the absence limit.");
        }
        return absent == 0
            ? T($"{name} son {total} ders kaydında hiç devamsızlık yapmamış{(late > 0 ? $"; {late} kez geç kalmış" : string.Empty)}.", $"{name} has no absences in the last {total} lessons{(late > 0 ? $"; {late} late" : string.Empty)}.")
            : T($"{name} son {total} ders kaydının {absent} tanesinde devamsız{lateText}.", $"{name} was absent in {absent} of the last {total} lessons{lateText}.");
    }

    public string ExamResults(string name, bool self, int count, double average, string? bestSubject, int? bestScore)
    {
        if (count == 0) return T(self ? "Henüz sisteme girilmiş bir sınav sonucun yok." : $"{name} için henüz sınav sonucu girilmemiş.", self ? "You don't have any exam results yet." : $"No exam results yet for {name}.");
        var avg = Math.Round(average).ToString(Culture);
        var best = bestSubject is null ? string.Empty : T($" En yüksek {S("notun", "not")} {bestSubject} ({bestScore}).", $" Best: {bestSubject} ({bestScore}).");
        return self
            ? T($"Son {count} sınavında ortalaman {avg}.{best}", $"Your average over the last {count} exams is {avg}.{best}")
            : T($"{name} son {count} sınavda ortalama {avg} almış.{best}", $"{name} averaged {avg} over the last {count} exams.{best}");
    }

    public string Homework(string name, bool self, int count, string? nearestTitle, string? nearestDeadline)
    {
        if (count == 0) return self ? T("Bekleyen ödevin yok, harika!", "No pending homework — nice!") : T($"{name} için bekleyen ödev yok.", $"No pending homework for {name}.");
        var next = nearestTitle is null ? string.Empty : T($" En yakın teslim: {nearestTitle}{(string.IsNullOrWhiteSpace(nearestDeadline) ? string.Empty : $" ({nearestDeadline})")}.", $" Next due: {nearestTitle}{(string.IsNullOrWhiteSpace(nearestDeadline) ? string.Empty : $" ({nearestDeadline})")}.");
        return self ? T($"{count} bekleyen ödevin var.{next}", $"You have {count} pending assignments.{next}") : T($"{name} için {count} bekleyen ödev var.{next}", $"{name} has {count} pending assignments.{next}");
    }

    public string Schedule(bool forTeacher, bool self, string name, int todayCount, string? firstToday, int weekCount)
    {
        if (weekCount == 0) return T(forTeacher ? "Size atanmış bir ders programı görünmüyor." : "Henüz ders programı girilmemiş.", forTeacher ? "No timetable is assigned to you yet." : "No timetable has been entered yet.");
        // Öğrenci kendisi: "dersin"; öğretmen kendisi: "dersiniz"; veli/personel bir öğrenci için: "Ali için … ders".
        var lessons = self ? "dersin" : forTeacher ? "dersiniz" : "ders";
        var whose = self || forTeacher ? string.Empty : $"{name} için ";
        if (todayCount == 0)
            return T($"Bugün {whose}{lessons} yok. Haftada toplam {weekCount} ders var.", $"No lessons today. There are {weekCount} lessons a week.");
        return T($"Bugün {whose}{todayCount} {lessons} var; ilki {firstToday}. Haftalık programın tamamı aşağıda.",
            $"{todayCount} lessons today; the first is {firstToday}. The full weekly timetable is below.");
    }

    public string Announcements(int count, string? latestTitle) => count == 0
        ? T("Şu an yeni bir duyuru yok.", "There are no new announcements.")
        : T($"{count} duyuru var. En yenisi: \"{latestTitle}\".", $"There are {count} announcements. Latest: \"{latestTitle}\".");

    public string Messages() => T(S("Mesajlarını güvenli mesaj kutusunda görebilirsin; seni oraya götüreyim.", "Mesajlarınızı güvenli mesaj kutusunda görebilirsiniz; sizi oraya yönlendireyim."), "You can read your messages in the secure inbox; let me take you there.");

    public string Payment(string name, bool self, decimal total, decimal paid, decimal remaining)
    {
        if (total == 0) return T(self ? "Sana ait bir ödeme planı görünmüyor." : $"{name} için bir ödeme planı görünmüyor.", self ? "There's no payment plan for you." : $"There's no payment plan for {name}.");
        return remaining <= 0
            ? T($"{(self ? "Ödemelerinin" : name + " için ödemelerin")} tamamı yapılmış ({Money(total)}). Teşekkürler!", $"All payments are complete ({Money(total)}). Thank you!")
            : T($"{(self ? "Toplam" : name + " için toplam")} {Money(total)} tutarın {Money(paid)} kısmı ödenmiş; kalan {Money(remaining)}.", $"{Money(paid)} of {Money(total)} has been paid; {Money(remaining)} remaining.");
    }

    public string TransportNone(string name, bool self) => T(self ? "Sana atanmış aktif bir servis görünmüyor." : $"{name} için aktif bir servis ataması yok.", self ? "You don't have an active school bus assignment." : $"{name} has no active school bus assignment.");

    public string Transport(string name, bool self, string route, string stop, string plate, string start) => T(
        $"{(self ? "Servisin" : name + " için servis")}: {route} hattı, {stop} durağı. Araç {plate}, hareket saati {start}.",
        $"School bus{(self ? string.Empty : " for " + name)}: route {route}, stop {stop}. Vehicle {plate}, departs at {start}.");

    public string Library(string name, bool self, int count, int overdue)
    {
        if (count == 0) return T(self ? "Üzerinde iade edilmemiş kitap yok." : $"{name} üzerinde iade edilmemiş kitap yok.", self ? "You have no books to return." : $"{name} has no books to return.");
        var late = overdue > 0 ? T($"; {overdue} tanesinin iade tarihi geçmiş", $"; {overdue} overdue") : T(", gecikme yok", ", none overdue");
        return T($"{(self ? "Üzerinde" : name + " üzerinde")} {count} kitap var{late}.", $"{(self ? "You have" : name + " has")} {count} books{late}.");
    }

    public string FinanceOverview(decimal collected, decimal openDebt, int overdue, string period) => T(
        $"{period} döneminde şu ana kadar {Money(collected)} tahsil edildi. Açık borç toplamı {Money(openDebt)}{(overdue > 0 ? $", vadesi geçmiş {overdue} taksit var" : string.Empty)}.",
        $"So far in {period}, {Money(collected)} has been collected. Open debt totals {Money(openDebt)}{(overdue > 0 ? $", with {overdue} overdue installments" : string.Empty)}.");

    public string InstitutionSummary(int total, int absentToday) => T(
        $"Kurumda şu an {N(total)} öğrenci kayıtlı; bugün {N(absentToday)} öğrenci devamsız.",
        $"There are {N(total)} students enrolled; {N(absentToday)} are absent today.");

    public string StudentList(AssistantIntent intent, int count, IReadOnlyList<string> sample, decimal? threshold)
    {
        var names = sample.Count == 0 ? string.Empty : $" {string.Join(", ", sample.Take(3))}{(count > 3 ? T(" ve diğerleri", " and others") : string.Empty)}.";
        return intent switch
        {
            AssistantIntent.ListAbsentStudents => count == 0 ? T("Bugün devamsız öğrenci yok.", "No one is absent today.") : T($"Bugün {count} öğrenci devamsız:{names}", $"{count} students are absent today:{names}"),
            AssistantIntent.ListLowScoreStudents => count == 0 ? T($"{threshold ?? 50} puanın altında sonucu olan öğrenci yok.", $"No students scored below {threshold ?? 50}.") : T($"{threshold ?? 50} puanın altında sonucu olan {count} öğrenci var:{names}", $"{count} students scored below {threshold ?? 50}:{names}"),
            AssistantIntent.ListStudentsWithDebt => count == 0 ? T("Borcu bulunan öğrenci yok.", "No students have outstanding debt.") : T($"Borcu bulunan {count} öğrenci var:{names}", $"{count} students have outstanding debt:{names}"),
            _ => count == 0 ? T("Bu sınıfta (yetki kapsamınızda) öğrenci bulamadım.", "I found no students in this class within your scope.") : T($"Bu sınıfta {count} öğrenci var. Birini seçerseniz ayrıntılarına bakabiliriz.", $"There are {count} students in this class. Pick one to see their details."),
        };
    }

    public string TopicInsight(string name, bool self, int solved, IReadOnlyList<string> weak, IReadOnlyList<string> strong, int? firstQuestions = null)
    {
        if (solved == 0)
            return self ? T("Henüz konu bilgisi taşıyan soru çözmedin. Online sınav ya da soru bankası çalıştıkça hangi konulara odaklanman gerektiğini söyleyebilirim.", "You haven't solved questions with topic data yet. As you practice, I can tell you which topics to focus on.")
                : T($"{name} henüz konu bilgisi taşıyan soru çözmemiş; analiz için veri biriksin.", $"{name} hasn't solved questions with topic data yet.");
        var strongText = strong.Count > 0 ? T($" Güçlü olduğu konular: {string.Join(", ", strong.Take(3))}.", $" Strong topics: {string.Join(", ", strong.Take(3))}.") : string.Empty;
        if (weak.Count == 0)
            return self ? T($"Belirgin bir zayıf konun yok, böyle devam!{strongText.Replace("olduğu", "olduğun")}", $"No clear weak topics — keep it up!{strongText}")
                : T($"{name} için belirgin bir zayıf konu yok.{strongText}", $"No clear weak topics for {name}.{strongText}");
        var list = string.Join(", ", weak.Take(3));
        // İlk konu öncelik sırasıdır: çok soru çözülüp en düşük kalan konu (sınav ağırlığı varsayılmaz).
        var first = weak[0];
        var plan = firstQuestions is int questions
            ? T($" İlk adım: bu hafta {first} konusundan {questions} soru, birkaç güne bölerek.", $" First step: {questions} questions on {first} this week, spread over a few days.")
            : string.Empty;
        return self
            ? T($"Öncelik sırasıyla şu konulara çalışmanı öneririm: {list}.{plan.Replace("bölerek", "bölerek çözebilirsin")} Her biri için ne yapabileceğin aşağıda.", $"In order of priority, I'd suggest: {list}.{plan} Tips for each are below.")
            : T($"{name} için öncelik sırası: {list}.{plan} Nedenleri ve önerileri aşağıda.{strongText}", $"Priority order for {name}: {list}.{plan} Reasons and tips are below.{strongText}");
    }

    // ── Yardım ──────────────────────────────────────────────────────────────

    public string HowTo(AssistantHelpArticle article) => T(
        $"{article.TitleTr} için şu adımları izleyebilirsiniz:".Replace("izleyebilirsiniz", S("izleyebilirsin", "izleyebilirsiniz")),
        $"Here's how to do it — {article.TitleEn}:");

    public string HowToOtherPortal(AssistantHelpArticle article) => T(
        $"\"{article.TitleTr}\" işlemi {S("senin", "sizin")} portalınızda değil, başka bir rolün panelinden yapılıyor.".Replace("portalınızda", S("portalında", "portalınızda")),
        $"\"{article.TitleEn}\" isn't done from your portal; it belongs to another role's panel.");

    public string HowToNotFound() => T(
        S("Bunun için hazır bir rehberim yok. Aşağıdakilerden birini sorabilir ya da öğretmenine danışabilirsin.", "Bunun için hazır bir rehberim yok. Aşağıdakilerden birini deneyebilir ya da destek ekibine yazabilirsiniz."),
        "I don't have a guide for that yet. Try one of the suggestions below or contact support.");

    public string OpenPage() => T("Sayfayı aç", "Open page");

    // ── Onaylı işlemler ─────────────────────────────────────────────────────

    public string ConfirmIntro() => T("Bunu yapmadan önce onayınızı almak istiyorum:", "Before I do this, I'd like your confirmation:");

    // ── Günlük brifing ──────────────────────────────────────────────────────

    public string BriefingGreeting() => Address.Length > 0
        ? T($"{TimeGreeting} {Address}! Ben {AssistantSmallTalk.Name}. Bugün için kısa bir özet:", $"{TimeGreeting} {Address}! I'm {AssistantSmallTalk.Name}. Here's a quick look at today:")
        : T($"{TimeGreeting}! Ben {AssistantSmallTalk.Name}. Bugün için kısa bir özet:", $"{TimeGreeting}! I'm {AssistantSmallTalk.Name}. Here's a quick look at today:");

    public string BriefingLessons(int count, string? first) => count == 0
        ? T(S("Bugün dersin görünmüyor.", "Bugün programınızda ders görünmüyor."), "No lessons on your timetable today.")
        : T(S($"Bugün {N(count)} dersin var; ilki {first}.", $"Bugün {N(count)} dersiniz var; ilki {first}."), $"You have {N(count)} lessons today; the first is {first}.");

    public string BriefingHomework(string? child, int count, string? nearest, string? deadline)
    {
        var when = string.IsNullOrWhiteSpace(deadline) ? string.Empty : T($" (teslim: {deadline})", $" (due {deadline})");
        return child is null
            ? T($"Bekleyen {N(count)} ödevin var; en yakını \"{nearest}\"{when}.", $"You have {N(count)} pending homework; the nearest is \"{nearest}\"{when}.")
            : T($"{child} için bekleyen {N(count)} ödev var; en yakını \"{nearest}\"{when}.", $"{child} has {N(count)} pending homework; the nearest is \"{nearest}\"{when}.");
    }

    public string BriefingWeakTopic(string topic, string subject) =>
        T($"Bu ara en çok {subject} - {topic} konusunda zorlanıyorsun; kısa bir tekrar iyi gelir.", $"Lately {subject} - {topic} has been the toughest for you; a short review would help.");

    public string BriefingChildAbsence(string child, int absent) =>
        T($"{child} son 7 günde {N(absent)} ders saati devamsız görünüyor.", $"{child} has missed {N(absent)} lesson hours in the last 7 days.");

    public string BriefingChildClear(string child) =>
        T($"{child} için bu hafta devamsızlık yok, ödevleri de güncel.", $"{child} has no absences this week and homework is up to date.");

    public string BriefingAbsentToday(int count, bool ownClasses) => count == 0
        ? T(ownClasses ? "Sınıflarınızda bugün devamsız öğrenci yok." : "Bugün devamsız öğrenci yok.", ownClasses ? "No absences in your classes today." : "No absences today.")
        : T(ownClasses ? $"Sınıflarınızda bugün {N(count)} öğrenci devamsız." : $"Bugün {N(count)} öğrenci devamsız.", ownClasses ? $"{N(count)} students are absent in your classes today." : $"{N(count)} students are absent today.");

    public string BriefingDueToday(int count, decimal amount) =>
        T($"Bugün vadesi gelen {N(count)} taksit var, toplam {Money(amount)}.", $"{N(count)} installments are due today, totalling {Money(amount)}.");

    public string BriefingOverdue(int count, decimal amount) =>
        T($"Vadesi geçmiş {N(count)} taksit bekliyor ({Money(amount)}).", $"{N(count)} overdue installments are waiting ({Money(amount)}).");

    public string BriefingCollected(decimal amount) =>
        T($"Bu ay şu ana kadar {Money(amount)} tahsil edildi.", $"{Money(amount)} has been collected so far this month.");

    public string BriefingAtRisk(int count, bool ownClasses) =>
        T(ownClasses ? $"Sınıflarınızda {N(count)} öğrenci erken uyarı listesinde (devamsızlık, düşen not ya da geciken ödev)." : $"{N(count)} öğrenci erken uyarı listesinde (devamsızlık, düşen not ya da geciken ödev).",
          ownClasses ? $"{N(count)} students in your classes are on the early-warning list." : $"{N(count)} students are on the early-warning list.");

    // ── Analiz ve rapor (yerel model ajanı) ─────────────────────────────────

    /// <summary>Uygulamayla ilgisi olmayan soru: kibarca kapsamı hatırlatır.</summary>
    public string OutOfScope() => T(
        S("Ben yalnız SchoolAsist'teki bilgilerinle ilgili yardımcı olabiliyorum: derslerin, ödevlerin, sınavların, devamsızlığın ve uygulamanın nasıl kullanıldığı gibi. Bunlardan birini sormak ister misin?",
          "Ben yalnız SchoolAsist'teki bilgiler ve uygulamanın kullanımıyla ilgili yardımcı olabiliyorum. Kurumunuzla ilgili bir şey sormak ister misiniz?"),
        "I can only help with information in SchoolAsist and how to use the app. Would you like to ask something about your school?");

    public string ClassNotFound(string requested, IReadOnlyList<string> available) => available.Count == 0
        ? T($"\"{requested}\" sınıfını bulamadım.", $"I couldn't find the class \"{requested}\".")
        : T($"\"{requested}\" sınıfını erişebildiğiniz sınıflar arasında bulamadım. Şunlardan birini yazabilirsiniz: {string.Join(", ", available.Take(12))}.",
            $"I couldn't find \"{requested}\" among the classes you can access. Try one of: {string.Join(", ", available.Take(12))}.");

    public string ReportEmpty() => T("Bu kriterlere uyan kayıt bulamadım.", "I couldn't find any records matching that.");

    public string ReportReady(string title) => T($"{title} hazır. Kartın altından PDF olarak indirebilirsiniz.", $"{title} is ready. You can download it as a PDF below the card.");

    public string BriefingAllClear() =>
        T(S("Bugün için dikkat etmen gereken bir şey görünmüyor. Bir şey sormak istersen buradayım.", "Bugün için öne çıkan bir konu görünmüyor. Bir şey sormak isterseniz buradayım."),
          "Nothing needs your attention today. I'm here if you have a question.");
}
