namespace CourseIntellect.Application.DTOs.Students;

/// <summary>
/// Sınıf yükseltme (ör. 7-A → 8-A). Öğrenciler <see cref="StudentUserIds"/> ile
/// KULLANICI kimliğinden seçilir — liste ekranı da öğrenciyi bu kimlikle taşır.
/// </summary>
public sealed record PromoteStudentsRequest(
    IReadOnlyList<Guid> StudentUserIds,
    string TargetClassName
);

/// <param name="Promoted">Sınıfı değişen öğrenci sayısı.</param>
/// <param name="AlreadyInClass">Zaten hedef sınıfta olduğu için atlananlar.</param>
/// <param name="NotFound">Kurumda bulunamayan kimlikler.</param>
public sealed record PromoteStudentsResult(
    int Promoted,
    IReadOnlyList<string> AlreadyInClass,
    IReadOnlyList<Guid> NotFound
);
