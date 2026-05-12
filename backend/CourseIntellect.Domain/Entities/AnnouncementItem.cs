namespace CourseIntellect.Domain.Entities;

public sealed class AnnouncementItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;

    // Hedefleme alanları: belirli bir sınıfa veya öğretmene yönlenen duyurular.
    // Boş ise Audience genel hedeflemesi geçerlidir.
    public string? ClassName { get; set; }
    public string? TeacherName { get; set; }
}
