namespace CourseIntellect.Application.Exceptions;

/// <summary>
/// Herkese açık demo hesaplarının kimlik bilgileri (parola, kullanıcı adı/e-posta, durum)
/// hiçbir kanaldan değiştirilemez, sıfırlanamaz ve hesap/kurum silinemez. Parolaları
/// ziyaretçilere açıkça verildiği için biri değiştirirse herkes kilitlenirdi.
/// </summary>
public sealed class ProtectedDemoAccountException()
    : Exception("Demo hesaplarında parola, e-posta, durum değişikliği, sıfırlama ve silme kapalıdır.");

/// <summary>
/// Tarayıcıdan (web) giriş şimdilik yalnız demo hesaplara açıktır. Gerçek kurum hesapları
/// mobil ya da masaüstü uygulamasını kullanır.
/// </summary>
public sealed class WebDemoOnlyException()
    : Exception("Web girişi şimdilik yalnız demo hesaplara açıktır. Kendi hesabınızla mobil veya masaüstü uygulamasından giriş yapın.");
