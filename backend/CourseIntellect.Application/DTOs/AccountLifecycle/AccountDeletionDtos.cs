namespace CourseIntellect.Application.DTOs.AccountLifecycle;

/// <summary>Kişisel hesap silme talebi oluşturma. Reauth için parola zorunlu.</summary>
public sealed class CreateAccountDeletionRequest
{
    /// <summary>Yeniden kimlik doğrulama: kullanıcının mevcut parolası.</summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>Açık onay kutusu (istemci zorunlu kılar; sunucu da doğrular).</summary>
    public bool Confirm { get; set; }

    /// <summary>
    /// Çağıran kurumun TEK yöneticisiyse, yönetimi devralacak kullanıcının kimliği.
    /// İsteğe bağlıdır; devir yapılmaması kişisel hesap silmeyi engellemez.
    /// </summary>
    public Guid? SuccessorAdminUserId { get; set; }
}

/// <summary>Kullanıcının kendi silme talebinin durumu + korunan kayıt açıklaması.</summary>
public sealed class AccountDeletionStatusDto
{
    public Guid? Id { get; set; }
    public string Status { get; set; } = "none";
    public DateTime? RequestedAtUtc { get; set; }
    public DateTime? FinalizeAtUtc { get; set; }
    public int? RemainingDays { get; set; }
    public bool CanCancel { get; set; }

    /// <summary>Kullanıcıya gösterilecek, hangi kayıtların anonim saklanacağına dair açıklama.</summary>
    public IReadOnlyList<string> RetainedRecordsExplanation { get; set; } = [];
}

/// <summary>Tek yönetici kendini silerken yönetimi devredebileceği aday kullanıcı.</summary>
public sealed class SuccessorCandidateDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

/// <summary>Yönetici/platform görünümünde bir silme talebi (yalnız görüntüleme/SLA).</summary>
public sealed class AccountDeletionQueueItemDto
{
    /// <summary>PII içermeyen hata kodu; eski kimlik eşlemesi için platform incelemesini belirtir.</summary>
    public string? FailureReason { get; set; }
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string UserDisplayName { get; set; } = string.Empty;
    public string RequesterRole { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime RequestedAtUtc { get; set; }
    public DateTime FinalizeAtUtc { get; set; }
    public int RemainingDays { get; set; }
    public bool RequiresPlatform { get; set; }
}
