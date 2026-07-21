namespace CourseIntellect.Application.DTOs.Staff;

public sealed record CreateStaffRequest(
    string FullName,
    string Role,
    string DepartmentOrBranch,
    string TcNo,
    string Phone,
    string Email,
    string Education,
    string StartDate,
    string Campus,
    string HomeroomClass,
    IReadOnlyList<string> AssignedClasses,
    string MaritalStatus,
    int ChildCount,
    string Note,
    // Şube müdürü (BranchManager) rolünde zorunlu: atanacağı şubenin (OrgUnit) kimliği.
    // Diğer rollerde opsiyonel; verilmezse şube otomatik-stamp ile belirlenir.
    Guid? BranchId = null,
    // Kurumun tanımladığı özel rol (opsiyonel). Verilirse Role = özel rolün BaseRole'ü
    // olmalı; kullanıcının modül erişimi bu rolün listesiyle sınırlanır.
    Guid? CustomRoleId = null,
    string? PhotoUrl = null
);

/// <summary>Var olan bir kullanıcının rol/şube/özel rol atamasını günceller.
/// Kaydedince kullanıcının EV grant'ı da yeni atamaya göre yenilenir.</summary>
public sealed record UpdateStaffAssignmentRequest(
    string? Role,
    Guid? BranchId,
    Guid? CustomRoleId,
    // true gönderilirse özel rol ataması kaldırılır (CustomRoleId=null ile karışmasın diye ayrı bayrak).
    bool ClearCustomRole = false);
