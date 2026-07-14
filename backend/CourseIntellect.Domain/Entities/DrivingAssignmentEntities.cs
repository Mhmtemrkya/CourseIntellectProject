using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Öğretmen-araç ataması. Bir öğretmen hangi aracı, hangi tarihlerde ve haftanın
/// hangi günlerinde kullanabilir? Randevu kurulurken bu atama aranır — rastgele
/// öğretmen-araç eşleşmesi kurulamaz.
/// </summary>
public sealed class DrivingInstructorVehicleAssignment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid InstructorProfileId { get; set; }
    public Guid VehicleId { get; set; }

    public VehicleAssignmentType AssignmentType { get; set; } = VehicleAssignmentType.Primary;

    /// <summary>Geçici atamalarda başlangıç/bitiş. Boşsa süresizdir.</summary>
    public DateTime? StartsOnUtc { get; set; }
    public DateTime? EndsOnUtc { get; set; }

    /// <summary>
    /// <see cref="VehicleAssignmentType.SpecificDays"/> için gün maskesi
    /// (Pazar=1, Pazartesi=2, Salı=4 … Cumartesi=64). 0 = tüm günler.
    /// </summary>
    public int DaysOfWeekMask { get; set; }

    /// <summary>Küçük değer önce önerilir (öneri motorunda sıralama).</summary>
    public int Priority { get; set; } = 100;

    /// <summary>Pasife alınır, silinmez — geçmiş randevuların dayanağı korunur.</summary>
    public bool IsActive { get; set; } = true;

    public string Note { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Öğretmenin haftalık çalışma penceresi (yerel saat). Randevu bu pencerenin
/// dışına taşamaz.
/// </summary>
public sealed class DrivingInstructorWorkingHour : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid InstructorProfileId { get; set; }

    public DayOfWeek DayOfWeek { get; set; }

    /// <summary>Gün başlangıcından itibaren dakika (ör. 09:00 → 540). Yerel saat.</summary>
    public int StartMinute { get; set; }
    public int EndMinute { get; set; }
}

/// <summary>Öğretmen izni — izinli öğretmene randevu verilemez.</summary>
public sealed class DrivingInstructorLeave : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid InstructorProfileId { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public string LeaveType { get; set; } = "Annual";
    public string Reason { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
