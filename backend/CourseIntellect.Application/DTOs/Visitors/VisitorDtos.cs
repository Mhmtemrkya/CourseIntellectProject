namespace CourseIntellect.Application.DTOs.Visitors;

public sealed record VisitorDto(
    Guid Id,
    string FullName,
    string Phone,
    string IdentityLast4,
    string VisitorType,
    string Purpose,
    Guid? HostUserId,
    string HostName,
    Guid? StudentUserId,
    string StudentName,
    string BadgeNo,
    string VehiclePlate,
    int CompanionCount,
    string Note,
    DateTime CheckInAtUtc,
    DateTime? CheckOutAtUtc,
    /// <summary>Çıkış yapılmadıysa şu ana kadar geçen dakika.</summary>
    int DurationMinutes,
    string CreatedByName);

/// <summary>Giriş kaydı. Identity verilirse yalnız son 4 hanesi saklanır.</summary>
public sealed record CheckInVisitorRequest(
    string FullName,
    string? Phone,
    string? Identity,
    string? VisitorType,
    string Purpose,
    Guid? HostUserId,
    string? HostName,
    Guid? StudentUserId,
    string? BadgeNo,
    string? VehiclePlate,
    int? CompanionCount,
    string? Note,
    bool PrivacyNoticeShown);

public sealed record UpdateVisitorRequest(
    string FullName,
    string? Phone,
    string? VisitorType,
    string Purpose,
    Guid? HostUserId,
    string? HostName,
    Guid? StudentUserId,
    string? BadgeNo,
    string? VehiclePlate,
    int? CompanionCount,
    string? Note);

public sealed record VisitorTypeCountDto(string VisitorType, int Count);

public sealed record VisitorDaySummaryDto(
    int TodayCount,
    int InsideCount,
    int AverageMinutes,
    int OverstayCount,
    IReadOnlyList<VisitorTypeCountDto> ByType);

public sealed record VisitorListDto(
    VisitorDaySummaryDto Summary,
    IReadOnlyList<VisitorDto> Items,
    int RetentionDays);

public sealed record VisitorHostOptionDto(Guid UserId, string FullName, string Role);

/// <summary>Daha önce gelmiş ziyaretçi (hızlı doldurma); kimlik numarası döndürülmez.</summary>
public sealed record VisitorLookupDto(string FullName, string Phone, string VisitorType, string LastPurpose, DateTime LastVisitAtUtc, int VisitCount);

public sealed record VisitorStudentOptionDto(Guid UserId, string FullName, string ClassName);
