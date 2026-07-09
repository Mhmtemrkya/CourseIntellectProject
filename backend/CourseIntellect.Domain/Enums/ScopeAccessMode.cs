namespace CourseIntellect.Domain.Enums;

/// <summary>
/// Bir grant'ın verdiği erişim türü. <see cref="ReadOnly"/> özellikle MEB/denetçi
/// gibi üst seviye görüntüleyiciler için: kapsamı görür ama değiştiremez.
/// </summary>
public enum ScopeAccessMode
{
    Manage = 1,
    ReadOnly = 2
}
