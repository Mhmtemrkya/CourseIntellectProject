namespace CourseIntellect.Application.DTOs.Students;

/// <summary>
/// Öğrenci/veli için görünür öğrenci kayıtları (yoklama, sınav sonucu) kapsamı:
/// profil kimlikleri (kimliğe bağlı kayıtlar) ve henüz bağlanmamış eski kayıtlar için adlar.
/// </summary>
public sealed record StudentRecordScope(
    IReadOnlyList<Guid> StudentIds,
    IReadOnlyList<string> StudentNames);
