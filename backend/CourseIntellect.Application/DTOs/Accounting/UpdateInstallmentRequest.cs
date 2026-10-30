namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record UpdateInstallmentRequest(
    string Amount,
    string Due,
    string Status,
    string Note,
    // "Ödendi" işaretlenince yazılan tahsilatın ödeme yöntemi; boşsa Nakit.
    string? Method = null
);
