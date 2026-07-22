namespace CourseIntellect.Application.DTOs.Accounting;

// BranchName/CollectedByName sona eklendi ve opsiyonel: "kim, hangi şubeden tahsil etti"
// bilgisini listeye taşır. Opsiyonel olmaları eski çağrı noktalarını bozmaz.
public sealed record AccountingCollectionDto(
    string Id, string Name, string ClassName, string Amount, string Method, string Time, string Note,
    string? BranchName = null, string? CollectedByName = null);
