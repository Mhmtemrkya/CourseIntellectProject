using CourseIntellect.Domain.Services;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Randevu uygunluk kurallarının tek kapısı. Randevu oluşturma, yeniden planlama
/// ve öneri motoru aynı kontrolden geçer — kural kopyalanmaz.
/// </summary>
public interface IDrivingAvailabilityService
{
    /// <summary>
    /// Verilen randevu adayını tüm kurallardan geçirir. Boş liste = uygun.
    /// Dolu liste = ihlaller; her biri hangi override iznine tabi olduğunu söyler.
    /// </summary>
    Task<IReadOnlyList<AvailabilityViolation>> CheckAsync(
        AppointmentCandidate candidate,
        CancellationToken cancellationToken = default);

    /// <summary>Belirtilen zaman aralığı için uygun öğretmenler (öncelik sırasıyla).</summary>
    Task<IReadOnlyList<AvailableInstructor>> SuggestInstructorsAsync(
        Guid studentDrivingProfileId,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        CancellationToken cancellationToken = default);

    /// <summary>Belirtilen öğretmen ve zaman için uygun araçlar (atama önceliğiyle).</summary>
    Task<IReadOnlyList<AvailableVehicle>> SuggestVehiclesAsync(
        Guid studentDrivingProfileId,
        Guid instructorProfileId,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        CancellationToken cancellationToken = default);
}

/// <param name="ExcludeAppointmentId">Yeniden planlamada, kendi eski randevusu çakışma sayılmasın.</param>
public sealed record AppointmentCandidate(
    Guid StudentDrivingProfileId,
    Guid InstructorProfileId,
    Guid VehicleId,
    DateTime StartsAtUtc,
    DateTime EndsAtUtc,
    Guid? ExcludeAppointmentId = null);

public sealed record AvailableInstructor(Guid InstructorProfileId, string FullName, int Priority);

public sealed record AvailableVehicle(Guid VehicleId, string PlateNumber, string AssignmentType, int Priority);
