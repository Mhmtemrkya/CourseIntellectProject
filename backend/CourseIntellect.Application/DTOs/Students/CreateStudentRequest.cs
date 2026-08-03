namespace CourseIntellect.Application.DTOs.Students;

public sealed record CreateStudentRequest(
    string FullName,
    string TcNo,
    string ClassName,
    string CurrentSchool,
    string SchoolNumber,
    string BirthDate,
    string ProgramType,
    string ParentName,
    string ParentPhone,
    string ParentEmail,
    string Address,
    string Note,
    // Öğrenci fotoğrafı (web kameradan veya yüklenen). Sürücü kursunda kullanılmaz;
    // okul öğrencisinde tek fotoğraf alanıdır.
    string? PhotoUrl = null,
    // Opsiyonel kayıt finansalı: doluysa kayıtta otomatik sözleşme + taksit planı üretilir.
    decimal? EnrollmentGrossAmount = null,
    decimal? EnrollmentDiscountAmount = null,
    string? EnrollmentDiscountReason = null,
    decimal? EnrollmentDownPayment = null,
    int? EnrollmentInstallmentCount = null,
    string? AcademicYear = null,
    // Peşinatın tahsil edildiği ödeme yöntemi (Nakit/Kart/Havale) — kasa dağılımına doğru düşmesi için.
    string? EnrollmentDownPaymentMethod = null,
    // Peşinat kayıt anında tahsil edildi mi? false → makbuz kesilmez, peşinat "bekliyor" olur.
    bool EnrollmentDownPaymentPaid = true,
    // Burs oranı (0–100). Doluysa bursun tutarı brüt üzerinden SUNUCUDA hesaplanıp
    // toplam indirime eklenir; istemci indirim tutarını zorlayamaz.
    decimal? EnrollmentScholarshipPercent = null
);
