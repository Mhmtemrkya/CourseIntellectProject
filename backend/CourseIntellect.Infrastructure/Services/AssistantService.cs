using System.Diagnostics;
using System.Text.Json;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AssistantService(
    CourseIntellectDbContext db,
    IAssistantIntentResolver resolver,
    IEntitlementService entitlementService,
    IDrivingNotifier drivingNotifier,
    IParentNotifier parentNotifier,
    ILogger<AssistantService> logger) : IAssistantService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Aktif kurumun türü. Asistanın kapsamı buna göre daralır: bir okul
    /// "kursiyer ilerlemesi" sormaz, bir sürücü kursu "servis nerede" sormaz.
    ///
    /// Claim'de taşınmadığı için tenant kaydından okunur (PK sorgusu). Tenant
    /// query filter'ı devre dışı bırakılır çünkü kurumun kendi kaydını okuyoruz.
    /// Kayıt bulunamazsa <see cref="InstitutionType.Other"/> döner — o durumda
    /// yalnız kurum türünden bağımsız niyetler açık kalır (güvenli taraf).
    /// </summary>
    private async Task<InstitutionType> ResolveInstitutionTypeAsync(AssistantRequestContext context, CancellationToken ct)
        => await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == context.TenantId)
            .Select(x => (InstitutionType?)x.InstitutionType)
            .FirstOrDefaultAsync(ct) ?? InstitutionType.Other;

    public async Task<AssistantConversationDto> CreateConversationAsync(AssistantRequestContext context, string? title, CancellationToken cancellationToken)
    {
        var entity = new AssistantConversation
        {
            TenantId = context.TenantId,
            BranchId = context.BranchId,
            UserId = context.UserId,
            Title = SanitizeTitle(title),
        };
        db.AssistantConversations.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<IReadOnlyList<AssistantConversationDto>> GetConversationsAsync(AssistantRequestContext context, CancellationToken cancellationToken) =>
        await db.AssistantConversations.AsNoTracking()
            .Where(x => x.UserId == context.UserId && !x.IsArchived)
            .OrderByDescending(x => x.LastMessageAtUtc ?? x.CreatedAtUtc)
            .Take(50)
            .Select(x => new AssistantConversationDto(x.Id, x.Title, x.CreatedAtUtc, x.UpdatedAtUtc, x.LastMessageAtUtc))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<AssistantMessageDto>?> GetMessagesAsync(AssistantRequestContext context, Guid conversationId, CancellationToken cancellationToken)
    {
        var owned = await db.AssistantConversations.AsNoTracking()
            .AnyAsync(x => x.Id == conversationId && x.UserId == context.UserId && !x.IsArchived, cancellationToken);
        if (!owned) return null;

        var rows = await db.AssistantMessages.AsNoTracking()
            .Where(x => x.ConversationId == conversationId && x.UserId == context.UserId)
            .OrderBy(x => x.CreatedAtUtc)
            .Take(500)
            .ToListAsync(cancellationToken);
        return rows.Select(x => new AssistantMessageDto(
            x.Id,
            x.SenderType == AssistantSenderType.User ? "user" : "assistant",
            ToResponseType(x.MessageType, x.StructuredPayloadJson),
            x.Text,
            x.Intent,
            ParseData(x.StructuredPayloadJson),
            x.CreatedAtUtc)).ToList();
    }

    public async Task<bool> DeleteConversationAsync(AssistantRequestContext context, Guid conversationId, CancellationToken cancellationToken)
    {
        var conversation = await db.AssistantConversations
            .SingleOrDefaultAsync(x => x.Id == conversationId && x.UserId == context.UserId && !x.IsArchived, cancellationToken);
        if (conversation is null) return false;
        conversation.IsArchived = true;
        conversation.SelectedStudentId = null;
        conversation.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<AssistantSuggestionDto>> GetSuggestionsAsync(AssistantRequestContext context, CancellationToken cancellationToken)
    {
        // Öneriler hem role hem kurum türüne göre daraltılır. Rol listesi neyin
        // ilgili olduğunu, kurum türü neyin MEVCUT olduğunu belirler: bir okul
        // yöneticisine "Kursiyer ilerlemesi" önermek anlamsızdı (eski davranış).
        var institutionType = await ResolveInstitutionTypeAsync(context, cancellationToken);

        var candidates = context.PrimaryRole.ToLowerInvariant() switch
        {
            "student" => Suggestions(
                ("Bugünkü derslerim", "schedule", "Akademik"), ("Bekleyen ödevlerim", "homework", "Akademik"),
                ("Yaklaşan sınavlarım", "exam", "Akademik"), ("Devamsızlığım", "attendance", "Akademik"),
                ("Direksiyon derslerim", "driving_lessons", "Sürücü Kursu"), ("Kurs ilerlemem", "driving_progress", "Sürücü Kursu"),
                ("Yaklaşan randevularım", "driving_appointments", "Sürücü Kursu"), ("Evrak durumum", "driving_documents", "Sürücü Kursu"),
                ("Üzerimdeki kitaplar", "library", "Kütüphane")),
            "parent" => Suggestions(
                ("Çocuğumun devamsızlığı", "attendance", "Takip"), ("Son sınav sonuçları", "exam", "Takip"),
                ("Bekleyen ödevler", "homework", "Takip"), ("Yaklaşan ödemeler", "payment", "Finans"),
                ("Servis durumu", "transport", "Servis"), ("Aldığı kitaplar", "library", "Kütüphane"),
                ("Evrak durumu", "driving_documents", "Sürücü Kursu")),
            "teacher" => Suggestions(
                ("Bugünkü derslerim", "schedule", "Ders"), ("Bugün devamsız olanlar", "absent", "Yoklama"),
                ("Öğrenci ara", "search", "Öğrenci"), ("Direksiyon dersleri", "driving_lessons", "Sürücü Kursu"),
                ("Yaklaşan randevular", "driving_appointments", "Sürücü Kursu")),
            "accounting" => Suggestions(
                ("Borcu olan öğrenciler", "debt", "Finans"), ("Ödeme durumunu göster", "payment", "Finans"),
                ("Öğrenci ara", "search", "Finans")),
            _ => Suggestions(
                ("Öğrenci ara", "search", "Öğrenci"), ("Bugün devamsız olanlar", "absent", "Yoklama"),
                ("Borcu olan öğrenciler", "debt", "Finans"), ("Yaklaşan sınavlar", "exam", "Akademik"),
                ("Kursiyer ilerlemesi", "driving_progress", "Sürücü Kursu"), ("Evrak durumu", "driving_documents", "Sürücü Kursu"),
                ("Yaklaşan randevular", "driving_appointments", "Sürücü Kursu"), ("Mezuniyet durumu", "driving_graduation", "Sürücü Kursu"),
                ("Gecikmiş kitaplar", "library", "Kütüphane")),
        };

        return candidates
            .Where(x => AssistantIntentCatalog.IsAvailableFor(CommandIntent(x.Command), institutionType))
            .ToList();
    }

    /// <summary>
    /// Yardım metni kuruma göre değişir: sürücü kursuna ödev/servis, okula
    /// direksiyon/kurs ilerlemesi vaat etmek kullanıcıyı boşuna uğraştırır.
    /// </summary>
    private static string HelpText(InstitutionType institutionType) => institutionType switch
    {
        InstitutionType.DrivingSchool =>
            "Kursiyer arayabilir; direksiyon dersleri, sınav durumu, kurs ilerlemesi, ödeme ve duyuru bilgilerini gösterebilirim.",
        _ =>
            "Öğrenci arayabilir; devamsızlık, sınav, ödev, ders programı, ödeme, servis ve duyuru bilgilerini gösterebilirim.",
    };

    /// <summary>
    /// Öneri komutunu niyete çevirir. Öneriler ile niyetler arasındaki tek
    /// bağdır; yeni bir öneri eklenirken buraya da eklenmezse kurum türü
    /// filtresinden geçemez ve her kurumda görünür.
    /// </summary>
    private static AssistantIntent CommandIntent(string command) => command switch
    {
        "schedule" => AssistantIntent.GetSchedule,
        "homework" => AssistantIntent.GetHomework,
        "exam" => AssistantIntent.GetExamResults,
        "attendance" => AssistantIntent.GetAttendance,
        "absent" => AssistantIntent.ListAbsentStudents,
        "search" => AssistantIntent.SearchStudent,
        "debt" => AssistantIntent.ListStudentsWithDebt,
        "payment" => AssistantIntent.GetPaymentSummary,
        "transport" => AssistantIntent.GetTransportStatus,
        "driving_lessons" => AssistantIntent.GetDrivingLessons,
        "driving_progress" => AssistantIntent.GetDrivingProgress,
        "driving_exam" => AssistantIntent.GetDrivingExamStatus,
        "driving_documents" => AssistantIntent.GetDrivingDocuments,
        "driving_appointments" => AssistantIntent.GetDrivingAppointments,
        "driving_graduation" => AssistantIntent.GetDrivingGraduation,
        "library" => AssistantIntent.GetLibraryLoans,
        _ => AssistantIntent.Unknown,
    };

    public async Task<AssistantResponseDto> ExecuteActionAsync(AssistantRequestContext context, AssistantActionRequest request, CancellationToken cancellationToken)
    {
        var command = request.Command.ToLowerInvariant();

        // "confirm:" ön eki yalnız onay kartındaki butondan gelir ve VERİ DEĞİŞTİRİR.
        // Bu yüzden buradan sonrası sorgu hattına düşmez; ayrı, denetimli bir yol.
        if (command.StartsWith("confirm:", StringComparison.Ordinal))
            return await ExecuteConfirmedActionAsync(context, request, command["confirm:".Length..], cancellationToken);

        if (command == "cancel_action")
            return Build(request.ConversationId, "text", "İşlem iptal edildi.", null, AssistantIntent.Unknown);

        var message = command switch
        {
            "attendance" or "get_attendance" => "Devamsızlığını göster",
            "exam" or "get_exam_results" => "Sınav sonuçlarını göster",
            "homework" or "get_homework" => "Bekleyen ödevlerini göster",
            "payment" or "get_payment" => "Ödeme durumunu göster",
            "transport" or "get_transport" => "Servis durumunu göster",
            "driving_lessons" => "Direksiyon derslerini göster",
            "driving_progress" => "Kurs ilerlemesini göster",
            _ => request.Command,
        };
        return await SendInternalAsync(context, new SendAssistantMessageRequest(request.ConversationId, message, Guid.NewGuid(), null), request.StudentId, cancellationToken);
    }

    /// <summary>
    /// Onaylanmış yazma eylemini yürütür.
    ///
    /// Kapılar ÖNERİ ANINDA DEĞİL BURADA tekrar kontrol edilir: onay kartı ile
    /// tıklama arasında rol, paket veya kurum değişmiş olabilir; ayrıca istemci
    /// kartı görmeden doğrudan "confirm:" komutu gönderebilir. Bu uç, kullanıcı
    /// girdisiyle veri değiştiren tek yer olduğu için hiçbir kontrolü atlamaz.
    /// </summary>
    private async Task<AssistantResponseDto> ExecuteConfirmedActionAsync(
        AssistantRequestContext context, AssistantActionRequest request, string actionCommand, CancellationToken ct)
    {
        var intent = WriteActionIntent(actionCommand);
        if (intent == AssistantIntent.Unknown || !AssistantIntentCatalog.IsWriteAction(intent))
            return Build(request.ConversationId, "error", "Tanımsız işlem.", null, AssistantIntent.Unknown);

        var conversation = await db.AssistantConversations
            .SingleOrDefaultAsync(x => x.Id == request.ConversationId && x.UserId == context.UserId && !x.IsArchived, ct);
        if (conversation is null)
            return Build(request.ConversationId, "error", "Sohbet bulunamadı.", null, intent);

        // Hedef öğrenci butonun parametresinden gelir; yoksa sohbetin seçili
        // öğrencisine düşeriz. İkisi de yoksa işlem yapılmaz.
        var studentId = request.StudentId ?? conversation.SelectedStudentId;
        if (studentId is null)
            return Build(request.ConversationId, "error", "İşlemin uygulanacağı öğrenci belirlenemedi.", null, intent);

        var institutionType = await ResolveInstitutionTypeAsync(context, ct);
        var authorized = true;
        var failureCode = string.Empty;
        AssistantResponseDto response;

        if (!AssistantIntentCatalog.IsAvailableFor(intent, institutionType))
        {
            authorized = false;
            failureCode = "INSTITUTION_SCOPE_DENIED";
            response = Build(request.ConversationId, "permission_denied",
                $"Bu işlem {AssistantIntentCatalog.DisplayName(institutionType)} kurumlarında yapılamaz.", null, intent);
        }
        else if (!AssistantIntentCatalog.IsAllowedForRole(intent, context.PrimaryRole))
        {
            authorized = false;
            failureCode = "ROLE_SCOPE_DENIED";
            response = Build(request.ConversationId, "permission_denied", "Rolünüz bu işlemi yapamıyor.", null, intent);
        }
        else if (AssistantIntentCatalog.RequiredModule(intent) is { } module
                 && !await entitlementService.IsAllowedAsync(context.Principal, module, "view", ct))
        {
            authorized = false;
            failureCode = "ENTITLEMENT_DENIED";
            response = Build(request.ConversationId, "permission_denied", "Bu işlem kurum paketiniz kapsamında değil.", null, intent);
        }
        else
        {
            // Öğrenciyi tenant kapsamı içinde doğrula: istemciden gelen id'ye güvenmeyiz.
            var student = await db.Students.AsNoTracking()
                .Where(x => x.Id == studentId.Value)
                .Select(ToStudentCandidate())
                .FirstOrDefaultAsync(ct);

            if (student is null)
            {
                authorized = false;
                failureCode = "STUDENT_NOT_FOUND";
                response = Build(request.ConversationId, "error", "Öğrenci bulunamadı.", null, intent);
            }
            else
            {
                try
                {
                    response = intent switch
                    {
                        AssistantIntent.SendDocumentReminder => await SendDocumentReminderAsync(request.ConversationId, student, ct),
                        AssistantIntent.NotifyParentAboutAbsence => await NotifyParentAboutAbsenceAsync(request.ConversationId, student, ct),
                        _ => Build(request.ConversationId, "error", "Tanımsız işlem.", null, intent),
                    };
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Asistan yazma eylemi başarısız: {Intent}", intent);
                    authorized = false;
                    failureCode = "ACTION_FAILED";
                    response = Build(request.ConversationId, "error", "İşlem tamamlanamadı. Lütfen ilgili ekrandan deneyin.", null, intent);
                }
            }
        }

        // Yazma eylemleri her hâlükârda denetim kaydına yazılır — reddedilenler dâhil.
        db.AssistantAuditLogs.Add(new AssistantAuditLog
        {
            TenantId = context.TenantId,
            UserId = context.UserId,
            ConversationId = conversation.Id,
            Intent = intent,
            ToolName = actionCommand,
            TargetStudentId = studentId,
            WasAuthorized = authorized,
            FailureReasonCode = failureCode,
            CorrelationId = context.CorrelationId,
            IpAddressMasked = MaskIp(context.IpAddress),
            UserAgent = Truncate(context.UserAgent, 250),
        });
        await db.SaveChangesAsync(ct);
        return response;
    }

    public Task<AssistantResponseDto> SendAsync(AssistantRequestContext context, SendAssistantMessageRequest request, CancellationToken cancellationToken) =>
        SendInternalAsync(context, request, null, cancellationToken);

    private async Task<AssistantResponseDto> SendInternalAsync(AssistantRequestContext context, SendAssistantMessageRequest request, Guid? explicitStudentId, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var rawMessage = (request.Message ?? string.Empty).Trim();
        if (rawMessage.Length is < 1 or > 1000)
            return await StandaloneErrorAsync(context, request.ConversationId, "error", "Mesaj 1-1000 karakter arasında olmalıdır.", AssistantIntent.Unknown, cancellationToken);

        var conversation = request.ConversationId.HasValue
            ? await db.AssistantConversations.SingleOrDefaultAsync(x => x.Id == request.ConversationId && x.UserId == context.UserId && !x.IsArchived, cancellationToken)
            : null;
        if (request.ConversationId.HasValue && conversation is null)
            return await StandaloneErrorAsync(context, null, "error", "Sohbet bulunamadı.", AssistantIntent.Unknown, cancellationToken);
        if (conversation is null)
        {
            conversation = new AssistantConversation { TenantId = context.TenantId, BranchId = context.BranchId, UserId = context.UserId, Title = SanitizeTitle(rawMessage) };
            db.AssistantConversations.Add(conversation);
            await db.SaveChangesAsync(cancellationToken);
        }

        var duplicate = await db.AssistantMessages.AsNoTracking()
            .Where(x => x.UserId == context.UserId && x.ClientMessageId == request.ClientMessageId && x.SenderType == AssistantSenderType.Assistant)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (duplicate is not null)
            return FromStored(duplicate, conversation.Id);

        db.AssistantMessages.Add(new AssistantMessage
        {
            TenantId = context.TenantId, ConversationId = conversation.Id, UserId = context.UserId,
            SenderType = AssistantSenderType.User, MessageType = AssistantMessageType.Text,
            Text = rawMessage, ClientMessageId = request.ClientMessageId,
        });

        var parsed = resolver.Resolve(rawMessage);
        AssistantResponseDto response;
        Guid? targetStudentId = explicitStudentId ?? conversation.SelectedStudentId;
        var authorized = true;
        var failureCode = string.Empty;
        try
        {
            var isServiceDriver = await db.ServiceDrivers.AsNoTracking().AnyAsync(x => x.UserId == context.UserId && x.IsActive, cancellationToken);
            var institutionType = await ResolveInstitutionTypeAsync(context, cancellationToken);
            var requiredModule = AssistantIntentCatalog.RequiredModule(parsed.Intent);
            if (isServiceDriver && parsed.Intent is not (AssistantIntent.Greeting or AssistantIntent.Help or AssistantIntent.Unknown or AssistantIntent.GetTransportStatus))
            {
                authorized = false;
                failureCode = "DRIVER_SCOPE_DENIED";
                response = Build(conversation.Id, "permission_denied", "Servis şoförü rolü yalnızca atanmış hattındaki servis bilgilerine erişebilir.", null, parsed.Intent);
            }
            // Kurum türü kapsamı yetkiden ÖNCE gelir: "bu bilgi kurumunuzda yok"
            // demek, "yetkiniz yok" demekten hem doğru hem daha az kafa karıştırıcı.
            else if (!AssistantIntentCatalog.IsAvailableFor(parsed.Intent, institutionType))
            {
                authorized = false;
                failureCode = "INSTITUTION_SCOPE_DENIED";
                response = Build(conversation.Id, "permission_denied",
                    $"Bu bilgi {AssistantIntentCatalog.DisplayName(institutionType)} kurumlarında bulunmuyor. Size yardımcı olabileceğim konular için aşağıdakileri deneyebilirsiniz.",
                    null, parsed.Intent,
                    suggestions: (await GetSuggestionsAsync(context, cancellationToken)).Take(5).Select(x => x.Label).ToArray());
            }
            else if (!AssistantIntentCatalog.IsAllowedForRole(parsed.Intent, context.PrimaryRole))
            {
                authorized = false;
                failureCode = "ROLE_SCOPE_DENIED";
                response = Build(conversation.Id, "permission_denied", "Rolünüz bu bilgiye erişemiyor.", null, parsed.Intent);
            }
            else if (requiredModule is not null && !await entitlementService.IsAllowedAsync(context.Principal, requiredModule, "view", cancellationToken))
            {
                authorized = false;
                failureCode = "ENTITLEMENT_DENIED";
                response = Build(conversation.Id, "permission_denied", "Bu bilgi kurum paketiniz veya özel rol yetkiniz kapsamında değil.", null, parsed.Intent);
            }
            else if (parsed.TcNo is not null && !RuleBasedAssistantIntentResolver.IsValidTurkishIdentityNumber(parsed.TcNo))
            {
                response = Build(conversation.Id, "error", "Geçerli bir TC kimlik numarası girin.", null, parsed.Intent);
                failureCode = "INVALID_TCKN";
            }
            else if (parsed.Intent is AssistantIntent.Greeting)
                response = Build(conversation.Id, "text",
                    $"Merhaba! SchoolAsist Asistan olarak yalnızca yetkiniz kapsamındaki {AssistantIntentCatalog.DisplayName(institutionType)} bilgilerine güvenli biçimde erişmenize yardımcı olabilirim.",
                    null, parsed.Intent, suggestions: (await GetSuggestionsAsync(context, cancellationToken)).Take(4).Select(x => x.Label).ToArray());
            else if (parsed.Intent is AssistantIntent.Help or AssistantIntent.Unknown)
                response = Build(conversation.Id, "quick_actions", HelpText(institutionType), null, AssistantIntent.Help,
                    suggestions: (await GetSuggestionsAsync(context, cancellationToken)).Select(x => x.Label).ToArray());
            else if (parsed.Intent is AssistantIntent.ListClassStudents or AssistantIntent.ListAbsentStudents or AssistantIntent.ListLowScoreStudents or AssistantIntent.ListStudentsWithDebt)
                response = await ExecuteListAsync(context, conversation.Id, parsed, cancellationToken);
            else if (parsed.Intent == AssistantIntent.GetSchedule && context.PrimaryRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase))
                response = await ScheduleAsync(context, conversation.Id, new StudentCandidate(Guid.Empty, Guid.Empty, context.Principal.FindFirst("name")?.Value ?? "Öğretmen", string.Empty, string.Empty, string.Empty), cancellationToken);
            else
            {
                var selection = await ResolveStudentAsync(context, parsed, targetStudentId, cancellationToken);
                if (selection.Denied)
                {
                    authorized = false;
                    failureCode = selection.FailureCode;
                    response = Build(conversation.Id, "permission_denied", selection.Message, null, parsed.Intent);
                }
                else if (selection.Candidates.Count > 1)
                {
                    var cards = selection.Candidates.Select(StudentCard).ToList();
                    response = Build(conversation.Id, "student_selection", "Aynı bilgilerle birden fazla öğrenci bulundu. Lütfen doğru kaydı seçin.", new { items = cards }, parsed.Intent);
                }
                else if (selection.Candidates.Count == 0)
                    response = Build(conversation.Id, "error", "Öğrenci bulunamadı. Ad soyad, sınıf veya numarayı kontrol ederek tekrar deneyin.", null, parsed.Intent);
                else
                {
                    var student = selection.Candidates[0];
                    conversation.SelectedStudentId = student.Id;
                    targetStudentId = student.Id;

                    // GÜVENLİK KAPISI: veri değiştiren niyetler burada ÇALIŞTIRILMAZ.
                    // Kullanıcıya ne olacağını anlatan bir onay kartı döner; işlem
                    // yalnızca onay butonuyla (ExecuteActionAsync) yürütülür.
                    response = AssistantIntentCatalog.IsWriteAction(parsed.Intent)
                        ? BuildConfirmation(conversation.Id, parsed.Intent, student)
                        : await ExecuteStudentIntentAsync(context, conversation.Id, parsed.Intent, student, cancellationToken);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Assistant request failed. CorrelationId={CorrelationId} Intent={Intent}", context.CorrelationId, parsed.Intent);
            authorized = false;
            failureCode = "PROCESSING_ERROR";
            response = Build(conversation.Id, "error", $"Şu anda bilgiler getirilemedi. Lütfen tekrar deneyin. Referans: {context.CorrelationId}", null, parsed.Intent);
        }

        if (response.Type == "permission_denied")
        {
            authorized = false;
            if (string.IsNullOrEmpty(failureCode)) failureCode = "ROLE_PERMISSION_DENIED";
        }

        stopwatch.Stop();
        conversation.LastIntent = parsed.Intent;
        conversation.LastMessageAtUtc = DateTime.UtcNow;
        conversation.UpdatedAtUtc = DateTime.UtcNow;
        var stored = new AssistantMessage
        {
            Id = response.MessageId, TenantId = context.TenantId, ConversationId = conversation.Id, UserId = context.UserId,
            SenderType = AssistantSenderType.Assistant, MessageType = ResponseMessageType(response.Type), Text = response.Text,
            Intent = response.Intent, StructuredPayloadJson = JsonSerializer.Serialize(new StoredPayload(response.Type, response.Data, response.Actions, response.Suggestions), JsonOptions),
            ClientMessageId = request.ClientMessageId, ProcessingDurationMs = stopwatch.ElapsedMilliseconds,
        };
        db.AssistantMessages.Add(stored);
        db.AssistantAuditLogs.Add(new AssistantAuditLog
        {
            TenantId = context.TenantId, UserId = context.UserId, ConversationId = conversation.Id, Intent = parsed.Intent,
            ToolName = ToolName(parsed.Intent), TargetStudentId = targetStudentId, WasAuthorized = authorized,
            FailureReasonCode = failureCode, CorrelationId = context.CorrelationId,
            IpAddressMasked = MaskIp(context.IpAddress), UserAgent = Truncate(context.UserAgent, 250),
        });
        await db.SaveChangesAsync(cancellationToken);
        return response;
    }

    private async Task<AssistantResponseDto> ExecuteStudentIntentAsync(AssistantRequestContext context, Guid conversationId, AssistantIntent intent, StudentCandidate student, CancellationToken ct)
    {
        var financeIntent = intent is AssistantIntent.GetPaymentSummary;
        var academicIntent = intent is AssistantIntent.GetAttendance or AssistantIntent.GetExamResults or AssistantIntent.GetExamAverage or AssistantIntent.GetHomework or AssistantIntent.GetSchedule;
        if (context.PrimaryRole.Equals("Accounting", StringComparison.OrdinalIgnoreCase) && academicIntent)
            return Build(conversationId, "permission_denied", "Muhasebe rolü akademik bilgilere erişemez.", null, intent);
        if (context.PrimaryRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase) && financeIntent)
            return Build(conversationId, "permission_denied", "Öğretmen rolü ödeme bilgilerine erişemez.", null, intent);

        return intent switch
        {
            AssistantIntent.SearchStudent or AssistantIntent.GetStudentSummary or AssistantIntent.OpenStudentDetail => await StudentSummaryAsync(conversationId, student, ct),
            AssistantIntent.GetAttendance => await AttendanceAsync(conversationId, student, ct),
            AssistantIntent.GetExamResults or AssistantIntent.GetExamAverage => await ExamResultsAsync(conversationId, student, ct),
            AssistantIntent.GetHomework => await HomeworkAsync(conversationId, student, ct),
            AssistantIntent.GetSchedule => await ScheduleAsync(context, conversationId, student, ct),
            AssistantIntent.GetAnnouncements => await AnnouncementsAsync(context, conversationId, student, ct),
            AssistantIntent.GetUnreadMessages => Build(conversationId, "text", "Mesajlarınız güvenli mesaj kutusundan görüntülenebilir.", null, intent, [new("navigate", "Mesajları Aç", RoleRoute(context.PrimaryRole, "chat"), null, null)]),
            AssistantIntent.GetPaymentSummary => await PaymentAsync(conversationId, student, ct),
            AssistantIntent.GetTransportStatus => await TransportAsync(conversationId, student, ct),
            AssistantIntent.GetDrivingLessons => await DrivingLessonsAsync(conversationId, student, ct),
            AssistantIntent.GetDrivingExamStatus => await DrivingExamAsync(conversationId, student, ct),
            AssistantIntent.GetDrivingProgress => await DrivingProgressAsync(conversationId, student, ct),
            AssistantIntent.GetDrivingDocuments => await DrivingDocumentsAsync(conversationId, student, ct),
            AssistantIntent.GetDrivingAppointments => await DrivingAppointmentsAsync(conversationId, student, ct),
            AssistantIntent.GetDrivingGraduation => await DrivingGraduationAsync(conversationId, student, ct),
            AssistantIntent.GetLibraryLoans => await LibraryLoansAsync(conversationId, student, ct),
            _ => Build(conversationId, "text", "Bu komut için henüz gösterilecek bir sonuç bulunamadı.", null, intent),
        };
    }

    private async Task<StudentSelection> ResolveStudentAsync(AssistantRequestContext context, ParsedAssistantQuery query, Guid? selectedId, CancellationToken ct)
    {
        var role = context.PrimaryRole.ToLowerInvariant();
        var candidatesQuery = db.Students.AsNoTracking();
        var serviceDriverId = await db.ServiceDrivers.AsNoTracking().Where(x => x.UserId == context.UserId && x.IsActive).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (serviceDriverId.HasValue)
        {
            var routeIds = db.ServiceRoutes.AsNoTracking().Where(x => x.DriverId == serviceDriverId && x.IsActive).Select(x => x.Id);
            var studentIds = db.StudentServiceAssignments.AsNoTracking().Where(x => x.IsActive && routeIds.Contains(x.RouteId)).Select(x => x.StudentId);
            candidatesQuery = candidatesQuery.Where(x => studentIds.Contains(x.Id));
        }
        if (role == "student")
        {
            candidatesQuery = candidatesQuery.Where(x => x.UserId == context.UserId);
            var own = await candidatesQuery.Select(ToStudentCandidate()).ToListAsync(ct);
            if (own.Count == 0) return new([], true, "Öğrenci profiliniz bulunamadı.", "STUDENT_PROFILE_NOT_FOUND");
            var searchTerms = query.SearchText.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var explicitlyTargetsPerson = query.TcNo is not null || query.StudentNumber is not null || searchTerms.Length >= 2;
            if (explicitlyTargetsPerson && !NameMatches(query.SearchText, own[0].FullName))
                return new([], true, "Başka öğrencilerin bilgilerine erişemezsiniz. Yalnızca kendi kurum bilgilerinizi görüntüleyebilirsiniz.", "STUDENT_SELF_SCOPE");
            return new(own, false, string.Empty, string.Empty);
        }
        if (role == "parent") candidatesQuery = candidatesQuery.Where(x => x.ParentUserId == context.UserId);
        if (role == "teacher")
        {
            var classes = await db.TeacherTimetableSlots.AsNoTracking().Where(x => x.TeacherUserId == context.UserId).Select(x => x.ClassName).Distinct().ToListAsync(ct);
            candidatesQuery = candidatesQuery.Where(x => classes.Contains(x.ClassName));
        }

        if (selectedId.HasValue) candidatesQuery = candidatesQuery.Where(x => x.Id == selectedId.Value);
        else if (query.TcNo is not null) candidatesQuery = candidatesQuery.Where(x => x.TcNo == query.TcNo);
        else if (query.StudentNumber is not null)
        {
            var drivingIds = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentNumber.ToString() == query.StudentNumber).Select(x => x.StudentId).ToListAsync(ct);
            candidatesQuery = candidatesQuery.Where(x => x.SchoolNumber == query.StudentNumber || drivingIds.Contains(x.Id));
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(query.SearchText))
            {
                var terms = query.SearchText.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var term in terms)
                {
                    var captured = term;
                    candidatesQuery = candidatesQuery.Where(x => x.FullName.ToLower()
                        .Replace("ç", "c").Replace("ğ", "g").Replace("ı", "i")
                        .Replace("ö", "o").Replace("ş", "s").Replace("ü", "u")
                        .Contains(captured));
                }
            }
            if (query.GradeLevel.HasValue && query.SectionName is not null)
            {
                var classA = $"{query.GradeLevel}-{query.SectionName}".ToLowerInvariant();
                var classB = $"{query.GradeLevel}/{query.SectionName}".ToLowerInvariant();
                candidatesQuery = candidatesQuery.Where(x => x.ClassName.ToLower() == classA || x.ClassName.ToLower() == classB);
            }
        }

        var candidates = await candidatesQuery.Take(11).Select(ToStudentCandidate()).ToListAsync(ct);
        if (role == "parent" && candidates.Count == 0 && string.IsNullOrWhiteSpace(query.SearchText) && !selectedId.HasValue)
            candidates = await db.Students.AsNoTracking().Where(x => x.ParentUserId == context.UserId).Take(11).Select(ToStudentCandidate()).ToListAsync(ct);
        return new(candidates, false, string.Empty, string.Empty);
    }

    private async Task<AssistantResponseDto> ExecuteListAsync(AssistantRequestContext context, Guid conversationId, ParsedAssistantQuery parsed, CancellationToken ct)
    {
        var role = context.PrimaryRole.ToLowerInvariant();
        if (role is "student" or "parent") return Build(conversationId, "permission_denied", "Toplu öğrenci listelerine erişim yetkiniz bulunmuyor.", null, parsed.Intent);
        if (role == "accounting" && parsed.Intent != AssistantIntent.ListStudentsWithDebt) return Build(conversationId, "permission_denied", "Muhasebe rolü akademik listelere erişemez.", null, parsed.Intent);
        if (role == "teacher" && parsed.Intent == AssistantIntent.ListStudentsWithDebt) return Build(conversationId, "permission_denied", "Öğretmen rolü borç bilgilerine erişemez.", null, parsed.Intent);

        if (parsed.Intent == AssistantIntent.ListStudentsWithDebt)
        {
            var debts = await db.FinanceInstallments.AsNoTracking().Where(x => x.Amount > x.PaidAmount)
                .GroupBy(x => new { x.StudentUserId, x.StudentName }).Select(g => new { studentId = g.Key.StudentUserId, fullName = g.Key.StudentName, remaining = g.Sum(x => x.Amount - x.PaidAmount), currency = "TRY" }).Take(50).ToListAsync(ct);
            return Build(conversationId, "student_list", $"Borcu bulunan {debts.Count} öğrenci listelendi.", new { items = debts }, parsed.Intent);
        }

        var students = db.Students.AsNoTracking();
        if (role == "teacher")
        {
            var classes = await db.TeacherTimetableSlots.AsNoTracking().Where(x => x.TeacherUserId == context.UserId).Select(x => x.ClassName).Distinct().ToListAsync(ct);
            students = students.Where(x => classes.Contains(x.ClassName));
        }
        if (parsed.Intent == AssistantIntent.ListClassStudents && parsed.GradeLevel.HasValue && parsed.SectionName is not null)
        {
            var className = $"{parsed.GradeLevel}-{parsed.SectionName}".ToLowerInvariant();
            students = students.Where(x => x.ClassName.ToLower() == className);
        }
        if (parsed.Intent == AssistantIntent.ListAbsentStudents)
        {
            var today = DateTime.UtcNow.Date;
            var absentNames = await db.AttendanceEntries.AsNoTracking().Where(x => x.LessonDate >= today && x.LessonDate < today.AddDays(1) && x.Status.ToLower().Contains("gelmedi")).Select(x => x.StudentName).Distinct().ToListAsync(ct);
            students = students.Where(x => absentNames.Contains(x.FullName));
        }
        if (parsed.Intent == AssistantIntent.ListLowScoreStudents)
        {
            var threshold = parsed.ScoreThreshold ?? 50;
            var names = await db.ExamResults.AsNoTracking().Where(x => x.Score < threshold).Select(x => x.StudentName).Distinct().ToListAsync(ct);
            students = students.Where(x => names.Contains(x.FullName));
        }
        var result = await students.OrderBy(x => x.FullName).Take(50).Select(x => new { studentId = x.Id, fullName = x.FullName, className = x.ClassName, studentNumberMasked = Mask(x.SchoolNumber) }).ToListAsync(ct);
        return Build(conversationId, "student_list", $"Yetki kapsamınızda {result.Count} öğrenci listelendi.", new { items = result }, parsed.Intent);
    }

    private async Task<AssistantResponseDto> StudentSummaryAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var driving = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentId == student.Id).Select(x => new { x.StudentNumber, x.LicenseClass, status = x.Status.ToString(), x.PurchasedDrivingMinutes, x.UsedDrivingMinutes }).FirstOrDefaultAsync(ct);
        var data = new { studentId = student.Id, student.FullName, student.ClassName, studentNumberMasked = Mask(student.SchoolNumber), photoUrl = student.PhotoUrl, institutionMode = driving is null ? "school" : "driving_school", driving };
        return Build(conversationId, "student_summary", "Öğrenci bulundu.", data, AssistantIntent.GetStudentSummary, StudentActions(student.Id));
    }

    private async Task<AssistantResponseDto> AttendanceAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var rows = await db.AttendanceEntries.AsNoTracking().Where(x => x.StudentName == student.FullName).OrderByDescending(x => x.LessonDate).Take(30).Select(x => new { date = x.LessonDate, x.Status, x.Lesson }).ToListAsync(ct);
        var data = new { studentId = student.Id, student.FullName, total = rows.Count, absent = rows.Count(x => x.Status.Contains("Gelmedi", StringComparison.OrdinalIgnoreCase)), late = rows.Count(x => x.Status.Contains("Geç", StringComparison.OrdinalIgnoreCase)), recent = rows };
        return Build(conversationId, "attendance_summary", $"{student.FullName} için devamsızlık özeti hazırlandı.", data, AssistantIntent.GetAttendance, StudentActions(student.Id));
    }

    private async Task<AssistantResponseDto> ExamResultsAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var rows = await db.ExamResults.AsNoTracking().Where(x => x.StudentName == student.FullName).OrderByDescending(x => x.DateLabel).Take(20).Select(x => new { x.ExamTitle, x.Subject, date = x.DateLabel, x.Score, x.Net }).ToListAsync(ct);
        return Build(conversationId, "exam_results", rows.Count == 0 ? "Sınav sonucu bulunamadı." : $"{student.FullName} için {rows.Count} sınav sonucu bulundu.", new { studentId = student.Id, student.FullName, average = rows.Count == 0 ? 0 : rows.Average(x => x.Score), items = rows }, AssistantIntent.GetExamResults, StudentActions(student.Id));
    }

    private async Task<AssistantResponseDto> HomeworkAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var submitted = db.HomeworkSubmissions.AsNoTracking().Where(x => x.StudentName == student.FullName).Select(x => x.AssignmentId);
        var rows = await db.HomeworkAssignments.AsNoTracking().Where(x => x.ClassName == student.ClassName && !submitted.Contains(x.Id)).OrderBy(x => x.DeadlineLabel).Take(30).Select(x => new { id = x.Id, x.Title, x.Subject, teacher = x.Teacher, deadline = x.DeadlineLabel, status = "pending" }).ToListAsync(ct);
        return Build(conversationId, "homework_list", $"{rows.Count} bekleyen ödev bulundu.", new { studentId = student.Id, student.FullName, items = rows }, AssistantIntent.GetHomework, StudentActions(student.Id));
    }

    private async Task<AssistantResponseDto> ScheduleAsync(AssistantRequestContext context, Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var query = db.TeacherTimetableSlots.AsNoTracking().AsQueryable();
        if (context.PrimaryRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase)) query = query.Where(x => x.TeacherUserId == context.UserId);
        else query = query.Where(x => x.ClassName == student.ClassName);
        var rows = await query.OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).Select(x => new { x.DayOfWeek, x.StartTime, x.EndTime, x.Lesson, x.TeacherName, x.ClassName }).ToListAsync(ct);
        return Build(conversationId, "schedule", $"{rows.Count} ders programı kaydı bulundu.", new { studentId = student.Id, student.FullName, items = rows }, AssistantIntent.GetSchedule);
    }

    private async Task<AssistantResponseDto> AnnouncementsAsync(AssistantRequestContext context, Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var role = context.PrimaryRole;
        var rows = await db.Announcements.AsNoTracking().Where(x => x.ClassName == null || x.ClassName == student.ClassName || x.Audience.ToLower().Contains(role.ToLower())).OrderByDescending(x => x.DateLabel).Take(20).Select(x => new { x.Title, x.Detail, date = x.DateLabel }).ToListAsync(ct);
        return Build(conversationId, "announcement_list", $"{rows.Count} duyuru bulundu.", new { items = rows }, AssistantIntent.GetAnnouncements);
    }

    private async Task<AssistantResponseDto> PaymentAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var rows = await db.FinanceInstallments.AsNoTracking().Where(x => x.StudentUserId == student.UserId || x.StudentName == student.FullName).OrderBy(x => x.DueDateUtc).Select(x => new { x.Label, dueDate = x.DueDateUtc, x.Amount, x.PaidAmount, remaining = x.Amount - x.PaidAmount, x.Status, x.Currency }).ToListAsync(ct);
        return Build(conversationId, "payment_summary", $"{student.FullName} için ödeme özeti hazırlandı.", new { studentId = student.Id, student.FullName, total = rows.Sum(x => x.Amount), paid = rows.Sum(x => x.PaidAmount), remaining = rows.Sum(x => x.remaining), items = rows.Take(12) }, AssistantIntent.GetPaymentSummary);
    }

    private async Task<AssistantResponseDto> TransportAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var row = await (from assignment in db.StudentServiceAssignments.AsNoTracking()
                         join route in db.ServiceRoutes.AsNoTracking() on assignment.RouteId equals route.Id
                         join stop in db.ServiceRouteStops.AsNoTracking() on assignment.StopId equals stop.Id
                         join vehicle in db.ServiceVehicles.AsNoTracking() on route.VehicleId equals vehicle.Id
                         where assignment.StudentId == student.Id && assignment.IsActive && route.IsActive
                         select new { routeName = route.Name, stopName = stop.Name, vehicle.PlateNumber, route.StartTime, route.EndTime }).FirstOrDefaultAsync(ct);
        return row is null
            ? Build(conversationId, "transport_status", "Aktif servis ataması bulunamadı.", null, AssistantIntent.GetTransportStatus)
            : Build(conversationId, "transport_status", "Servis bilgisi bulundu.", new { studentId = student.Id, student.FullName, route = row }, AssistantIntent.GetTransportStatus);
    }

    private async Task<AssistantResponseDto> DrivingLessonsAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var profileId = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentId == student.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (!profileId.HasValue) return Build(conversationId, "error", "Bu öğrenci için sürücü kursu kaydı bulunamadı.", null, AssistantIntent.GetDrivingLessons);
        var rows = await db.DrivingAppointments.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId).OrderByDescending(x => x.StartsAtUtc).Take(20).Select(x => new { x.Id, startsAt = x.StartsAtUtc, endsAt = x.EndsAtUtc, status = x.Status.ToString(), x.MeetingPoint }).ToListAsync(ct);
        return Build(conversationId, "schedule", $"{rows.Count} direksiyon dersi/randevusu bulundu.", new { studentId = student.Id, student.FullName, items = rows, mode = "driving_school" }, AssistantIntent.GetDrivingLessons);
    }

    /// <summary>
    /// Kursiyerin evrak dosyası. Durum <see cref="DrivingStudentRules.EffectiveStatus"/>
    /// ile hesaplanır — süresi dolmuş bir belge veritabanında hâlâ "Approved"
    /// görünür, ham durumu okumak yanıltıcı olurdu.
    /// </summary>
    private async Task<AssistantResponseDto> DrivingDocumentsAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var profileId = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentId == student.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (!profileId.HasValue) return Build(conversationId, "error", "Bu öğrenci için sürücü kursu kaydı bulunamadı.", null, AssistantIntent.GetDrivingDocuments);

        var now = DateTime.UtcNow;
        var stored = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.IsCurrent)
            .Select(x => new { x.DocumentType, x.Status, x.ExpiresAtUtc })
            .ToListAsync(ct);

        var items = stored.Select(x =>
        {
            var effective = DrivingStudentRules.EffectiveStatus(x.Status, x.ExpiresAtUtc, now);
            return new
            {
                title = DrivingStudentRules.DocumentLabel(x.DocumentType),
                status = effective switch
                {
                    StudentDocumentStatus.Approved => "Onaylı",
                    StudentDocumentStatus.PendingApproval => "Onay bekliyor",
                    StudentDocumentStatus.Expired => "Süresi geçti",
                    StudentDocumentStatus.Rejected => "Reddedildi",
                    _ => "Eksik",
                },
                deadline = x.ExpiresAtUtc.HasValue ? x.ExpiresAtUtc.Value.AddHours(3).ToString("dd.MM.yyyy") : null,
            };
        }).ToList();

        var problem = items.Count(x => x.status is "Süresi geçti" or "Reddedildi" or "Onay bekliyor");
        var summary = items.Count == 0
            ? $"{student.FullName} için yüklenmiş evrak bulunamadı."
            : problem == 0
                ? $"{student.FullName}: {items.Count} evrağın tamamı onaylı."
                : $"{student.FullName}: {items.Count} evrağın {problem} tanesi ilgi bekliyor.";

        return Build(conversationId, "driving_documents", summary,
            new { studentId = student.Id, student.FullName, items }, AssistantIntent.GetDrivingDocuments, StudentActions(student.Id));
    }

    /// <summary>Yalnız gelecekteki ve iptal edilmemiş randevular — geçmiş ders dökümü ayrı niyet.</summary>
    private async Task<AssistantResponseDto> DrivingAppointmentsAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var profileId = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentId == student.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (!profileId.HasValue) return Build(conversationId, "error", "Bu öğrenci için sürücü kursu kaydı bulunamadı.", null, AssistantIntent.GetDrivingAppointments);

        var now = DateTime.UtcNow;
        var rows = await (from appointment in db.DrivingAppointments.AsNoTracking()
                          join instructorProfile in db.DrivingInstructorProfiles.AsNoTracking() on appointment.InstructorProfileId equals instructorProfile.Id
                          join staff in db.Staff.AsNoTracking() on instructorProfile.StaffId equals staff.Id
                          join vehicle in db.DrivingVehicles.AsNoTracking() on appointment.VehicleId equals vehicle.Id
                          where appointment.StudentDrivingProfileId == profileId
                                && appointment.StartsAtUtc >= now
                                && appointment.Status != DrivingAppointmentStatus.Cancelled
                          orderby appointment.StartsAtUtc
                          select new
                          {
                              startsAt = appointment.StartsAtUtc,
                              endsAt = appointment.EndsAtUtc,
                              instructor = staff.FullName,
                              plate = vehicle.PlateNumber,
                              meetingPoint = appointment.MeetingPoint,
                              status = appointment.Status.ToString(),
                          })
                         .Take(10).ToListAsync(ct);

        var summary = rows.Count == 0
            ? $"{student.FullName} için planlanmış randevu bulunmuyor."
            : $"{student.FullName} için {rows.Count} yaklaşan randevu var.";
        return Build(conversationId, "driving_appointments", summary,
            new { studentId = student.Id, student.FullName, items = rows }, AssistantIntent.GetDrivingAppointments, StudentActions(student.Id));
    }

    private async Task<AssistantResponseDto> DrivingGraduationAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var profileId = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentId == student.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (!profileId.HasValue) return Build(conversationId, "error", "Bu öğrenci için sürücü kursu kaydı bulunamadı.", null, AssistantIntent.GetDrivingGraduation);

        var record = await db.DrivingGraduationRecords.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId)
            .OrderByDescending(x => x.CheckedAtUtc)
            .Select(x => new { x.Status, x.GraduatedAtUtc, x.RevokedAtUtc, x.RevocationReason })
            .FirstOrDefaultAsync(ct);

        if (record is null)
            return Build(conversationId, "text", $"{student.FullName} için henüz mezuniyet kaydı oluşturulmamış.", null, AssistantIntent.GetDrivingGraduation, StudentActions(student.Id));

        // Sertifika ayrı bir varlık (DrivingCertificate); mezuniyet kaydı ile
        // 1-N ilişkisi var, en güncel aktif olanı gösteriyoruz.
        var certificate = await db.DrivingCertificates.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.Status == DrivingCertificateStatus.Active)
            .OrderByDescending(x => x.IssuedAtUtc)
            .Select(x => new { x.DocumentNumber, x.MebbisCertificateNo, x.IssuedAtUtc, x.DeliveryStatus })
            .FirstOrDefaultAsync(ct);

        var summary = record.RevokedAtUtc.HasValue
            ? $"{student.FullName} mezuniyeti iptal edilmiş." + (string.IsNullOrWhiteSpace(record.RevocationReason) ? "" : $" Sebep: {record.RevocationReason}")
            : record.GraduatedAtUtc.HasValue
                ? certificate is null
                    ? $"{student.FullName} mezun edilmiş, sertifika henüz düzenlenmemiş."
                    : $"{student.FullName} mezun edilmiş. Sertifika no: {(string.IsNullOrWhiteSpace(certificate.MebbisCertificateNo) ? certificate.DocumentNumber : certificate.MebbisCertificateNo)}."
                : $"{student.FullName} için mezuniyet kontrolü sürüyor (durum: {record.Status}).";

        return Build(conversationId, "driving_graduation", summary,
            new
            {
                studentId = student.Id,
                student.FullName,
                status = record.Status.ToString(),
                graduatedAt = record.GraduatedAtUtc,
                certificateNumber = certificate is null
                    ? null
                    : string.IsNullOrWhiteSpace(certificate.MebbisCertificateNo) ? certificate.DocumentNumber : certificate.MebbisCertificateNo,
                certificateIssuedAt = certificate?.IssuedAtUtc,
                deliveryStatus = certificate?.DeliveryStatus.ToString(),
            },
            AssistantIntent.GetDrivingGraduation, StudentActions(student.Id));
    }

    /// <summary>
    /// Öğrencinin üzerindeki iade edilmemiş kitaplar. Kütüphane kayıtları öğrenciyi
    /// ADIYLA tutuyor (yabancı anahtar yok), o yüzden eşleşme ad üzerinden yapılır.
    /// </summary>
    private async Task<AssistantResponseDto> LibraryLoansAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var rows = await db.LibraryLoans.AsNoTracking()
            .Where(x => x.StudentName == student.FullName && x.ReturnedAtUtc == null)
            .OrderBy(x => x.DueAtUtc)
            .Take(20)
            .Select(x => new { title = x.BookTitle, dueAt = x.DueAtUtc, x.FineAmount })
            .ToListAsync(ct);

        var overdue = rows.Count(x => x.dueAt < now);
        var summary = rows.Count == 0
            ? $"{student.FullName} üzerinde iade edilmemiş kitap yok."
            : overdue > 0
                ? $"{student.FullName} üzerinde {rows.Count} kitap var; {overdue} tanesinin iadesi gecikti."
                : $"{student.FullName} üzerinde {rows.Count} kitap var, gecikme yok.";

        return Build(conversationId, "library_loans", summary,
            new
            {
                studentId = student.Id,
                student.FullName,
                items = rows.Select(x => new
                {
                    title = x.title,
                    deadline = x.dueAt.AddHours(3).ToString("dd.MM.yyyy"),
                    status = x.dueAt < now ? "Gecikti" : "Zamanında",
                    remaining = x.FineAmount > 0 ? (decimal?)x.FineAmount : null,
                }),
            },
            AssistantIntent.GetLibraryLoans, StudentActions(student.Id));
    }

    private async Task<AssistantResponseDto> DrivingExamAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var profileId = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentId == student.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (!profileId.HasValue) return Build(conversationId, "error", "Bu öğrenci için sürücü kursu kaydı bulunamadı.", null, AssistantIntent.GetDrivingExamStatus);
        var rows = await (from candidate in db.DrivingExamCandidates.AsNoTracking()
                          join session in db.DrivingExamSessions.AsNoTracking() on candidate.ExamSessionId equals session.Id
                          where candidate.StudentDrivingProfileId == profileId
                          orderby session.StartsAtUtc descending
                          select new { session.Title, examType = session.ExamType.ToString(), startsAt = session.StartsAtUtc, status = candidate.Status.ToString(), candidate.Score, candidate.AttemptNo }).Take(10).ToListAsync(ct);
        return Build(conversationId, "exam_results", $"{rows.Count} sürücü kursu sınav kaydı bulundu.", new { studentId = student.Id, student.FullName, items = rows, mode = "driving_school" }, AssistantIntent.GetDrivingExamStatus);
    }

    private async Task<AssistantResponseDto> DrivingProgressAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var profile = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentId == student.Id).Select(x => new { profileId = x.Id, x.StudentNumber, x.LicenseClass, transmission = x.TransmissionType.ToString(), status = x.Status.ToString(), x.PurchasedDrivingMinutes, x.UsedDrivingMinutes, remainingDrivingMinutes = Math.Max(0, x.PurchasedDrivingMinutes - x.UsedDrivingMinutes), x.MebbisEnteredAtUtc }).FirstOrDefaultAsync(ct);
        return profile is null
            ? Build(conversationId, "error", "Bu öğrenci için sürücü kursu kaydı bulunamadı.", null, AssistantIntent.GetDrivingProgress)
            : Build(conversationId, "student_summary", "Sürücü kursu ilerleme özeti hazırlandı.", new { studentId = student.Id, student.FullName, driving = profile, mode = "driving_school" }, AssistantIntent.GetDrivingProgress);
    }

    private async Task<AssistantResponseDto> StandaloneErrorAsync(AssistantRequestContext context, Guid? conversationId, string type, string text, AssistantIntent intent, CancellationToken ct)
    {
        var id = conversationId ?? (await CreateConversationAsync(context, "Yeni sohbet", ct)).Id;
        return Build(id, type, text, null, intent);
    }

    /// <summary>
    /// Kursiyere eksik evrak hatırlatması gönderir. Eksik belge yoksa bildirim
    /// GÖNDERİLMEZ — gereksiz bildirim kullanıcıyı bildirimlere karşı körleştirir.
    /// </summary>
    private async Task<AssistantResponseDto> SendDocumentReminderAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var profileId = await db.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.StudentId == student.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (!profileId.HasValue)
            return Build(conversationId, "error", "Bu öğrenci için sürücü kursu kaydı bulunamadı.", null, AssistantIntent.SendDocumentReminder);

        var now = DateTime.UtcNow;
        var stored = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.IsCurrent)
            .Select(x => new { x.DocumentType, x.Status, x.ExpiresAtUtc })
            .ToListAsync(ct);

        var problems = stored
            .Select(x => new { x.DocumentType, Effective = DrivingStudentRules.EffectiveStatus(x.Status, x.ExpiresAtUtc, now) })
            .Where(x => x.Effective is StudentDocumentStatus.Expired or StudentDocumentStatus.Rejected or StudentDocumentStatus.PendingApproval)
            .Select(x => DrivingStudentRules.DocumentLabel(x.DocumentType))
            .ToList();

        if (problems.Count == 0)
            return Build(conversationId, "text",
                $"{student.FullName} için eksik veya süresi geçmiş evrak yok — hatırlatma gönderilmedi.",
                null, AssistantIntent.SendDocumentReminder);

        await drivingNotifier.NotifyStudentAsync(
            profileId.Value,
            "Evrak hatırlatması",
            $"Dosyanızda ilgi bekleyen belgeler var: {string.Join(", ", problems)}. Lütfen kurs sekreterliğiyle iletişime geçin.",
            "driving.document.reminder",
            // Aynı gün içinde tekrar tetiklenirse kursiyere iki bildirim gitmesin.
            dedupeKey: $"assistant-doc-reminder-{profileId}-{now:yyyyMMdd}",
            relatedEntityType: "StudentDrivingProfile",
            relatedEntityId: profileId.Value.ToString(),
            cancellationToken: ct);

        return Build(conversationId, "action_result",
            $"{student.FullName} adlı kursiyere {problems.Count} eksik evrak için hatırlatma gönderildi.",
            new { studentId = student.Id, student.FullName, items = problems.Select(x => new { title = x }) },
            AssistantIntent.SendDocumentReminder);
    }

    /// <summary>
    /// Veliye devamsızlık bilgilendirmesi. Devamsızlık yoksa gönderilmez —
    /// veliye "çocuğunuz 0 gün devamsız" bildirimi göndermek anlamsızdır.
    ///
    /// Son 30 KAYIT üzerinden bakılır (tarih penceresi değil): mevcut
    /// <see cref="AttendanceAsync"/> ile aynı kalıp, böylece asistanın
    /// gösterdiği özet ile gönderdiği bildirim aynı veriyi anlatır.
    /// </summary>
    private async Task<AssistantResponseDto> NotifyParentAboutAbsenceAsync(Guid conversationId, StudentCandidate student, CancellationToken ct)
    {
        var rows = await db.AttendanceEntries.AsNoTracking()
            .Where(x => x.StudentName == student.FullName)
            .OrderByDescending(x => x.LessonDate)
            .Take(30)
            .Select(x => x.Status)
            .ToListAsync(ct);

        var absences = rows.Count(x => x.Contains("Gelmedi", StringComparison.OrdinalIgnoreCase));
        if (absences == 0)
            return Build(conversationId, "text",
                $"{student.FullName} için son kayıtlarda devamsızlık yok — bilgilendirme gönderilmedi.",
                null, AssistantIntent.NotifyParentAboutAbsence);

        await parentNotifier.NotifyStudentParentAsync(
            student.FullName,
            "Devamsızlık bilgilendirmesi",
            $"{student.FullName} adlı öğrencinin son {rows.Count} yoklama kaydındaki devamsızlık sayısı: {absences}. Ayrıntı için okul ile iletişime geçebilirsiniz.",
            "attendance.parent.notice",
            ct);

        return Build(conversationId, "action_result",
            $"{student.FullName} adlı öğrencinin velisine {absences} devamsızlık için bilgilendirme gönderildi.",
            new { studentId = student.Id, student.FullName, absences, examined = rows.Count },
            AssistantIntent.NotifyParentAboutAbsence);
    }

    /// <summary>
    /// Yazma eyleminin onay kartı. İşlem BURADA YAPILMAZ — kart yalnızca ne
    /// olacağını anlatır ve onay/vazgeç butonlarını taşır.
    ///
    /// Hedef öğrenci butonun parametresinde taşınır; onay adımı mesajı yeniden
    /// ayrıştırmaz. Aksi hâlde kullanıcı onaya basana kadar sohbette başka bir
    /// öğrenciye geçtiyse işlem yanlış kişiye uygulanırdı.
    /// </summary>
    private static AssistantResponseDto BuildConfirmation(Guid conversationId, AssistantIntent intent, StudentCandidate student)
    {
        var command = WriteActionCommand(intent);
        return Build(conversationId, "confirm_action",
            AssistantIntentCatalog.WriteActionDescription(intent, student.FullName) + " Onaylıyor musunuz?",
            new { studentId = student.Id, student.FullName, action = command },
            intent,
            [
                new("confirm_action", "Onayla ve gönder", null, $"confirm:{command}", new { studentId = student.Id }),
                new("cancel_action", "Vazgeç", null, "cancel_action", null),
            ]);
    }

    /// <summary>Yazma niyeti ↔ onay komutu eşlemesi. İki yönlü kullanılır.</summary>
    private static string WriteActionCommand(AssistantIntent intent) => intent switch
    {
        AssistantIntent.SendDocumentReminder => "send_document_reminder",
        AssistantIntent.NotifyParentAboutAbsence => "notify_parent_absence",
        _ => "unknown_action",
    };

    private static AssistantIntent WriteActionIntent(string command) => command switch
    {
        "send_document_reminder" => AssistantIntent.SendDocumentReminder,
        "notify_parent_absence" => AssistantIntent.NotifyParentAboutAbsence,
        _ => AssistantIntent.Unknown,
    };

    private static AssistantResponseDto Build(Guid conversationId, string type, string text, object? data, AssistantIntent intent, IReadOnlyList<AssistantActionDto>? actions = null, IReadOnlyList<string>? suggestions = null) =>
        new(conversationId, Guid.NewGuid(), type, text, data, actions ?? [], suggestions ?? [], intent);

    private static System.Linq.Expressions.Expression<Func<StudentProfile, StudentCandidate>> ToStudentCandidate() => x => new StudentCandidate(x.Id, x.UserId, x.FullName, x.ClassName, x.SchoolNumber, x.PhotoUrl);
    private static object StudentCard(StudentCandidate x) => new { studentId = x.Id, x.FullName, x.ClassName, studentNumberMasked = Mask(x.SchoolNumber) };
    private static IReadOnlyList<AssistantActionDto> StudentActions(Guid studentId) => [
        new("send_command", "Devamsızlığı Göster", null, "get_attendance", new { studentId }),
        new("send_command", "Sınav Sonuçları", null, "get_exam_results", new { studentId }),
        new("send_command", "Bekleyen Ödevler", null, "get_homework", new { studentId })];
    private static IReadOnlyList<AssistantSuggestionDto> Suggestions(params (string Label, string Command, string Category)[] values) => values.Select(x => new AssistantSuggestionDto(x.Label, x.Command, x.Category)).ToList();
    private static AssistantConversationDto Map(AssistantConversation x) => new(x.Id, x.Title, x.CreatedAtUtc, x.UpdatedAtUtc, x.LastMessageAtUtc);
    private static string SanitizeTitle(string? value) => string.IsNullOrWhiteSpace(value) ? "Yeni sohbet" : Truncate(value.Replace('\n', ' ').Replace('\r', ' ').Trim(), 80);
    private static string Truncate(string? value, int max) => string.IsNullOrEmpty(value) ? string.Empty : value.Length <= max ? value : value[..max];
    private static string Mask(string? value) => string.IsNullOrWhiteSpace(value) ? "-" : value.Length <= 2 ? new string('*', value.Length) : $"{value[..Math.Min(2, value.Length)]}{new string('*', Math.Max(2, value.Length - 2))}";
    private static string MaskIp(string value) => value.Contains(':') ? "ipv6" : string.Join('.', value.Split('.').Select((x, i) => i == 3 ? "0" : x));
    private static bool NameMatches(string search, string fullName) => fullName.ToLower(new System.Globalization.CultureInfo("tr-TR")).Split(' ', StringSplitOptions.RemoveEmptyEntries).All(part => search.Contains(part, StringComparison.OrdinalIgnoreCase));
    private static string ToolName(AssistantIntent intent) => $"{intent}Tool";
    // RequiredModule artik AssistantIntentCatalog.RequiredModule ile tek yerde.
    private static AssistantMessageType ResponseMessageType(string type) => type switch { "permission_denied" => AssistantMessageType.PermissionDenied, "error" => AssistantMessageType.Error, "text" => AssistantMessageType.Text, _ => AssistantMessageType.Structured };
    private static string ToResponseType(AssistantMessageType type, string payload)
    {
        try { return JsonSerializer.Deserialize<StoredPayload>(payload, JsonOptions)?.Type ?? (type == AssistantMessageType.Error ? "error" : "text"); }
        catch { return type == AssistantMessageType.Error ? "error" : "text"; }
    }
    private static JsonElement? ParseData(string payload)
    {
        try { return JsonSerializer.Deserialize<StoredPayload>(payload, JsonOptions)?.Data; }
        catch { return null; }
    }
    private static AssistantResponseDto FromStored(AssistantMessage message, Guid conversationId)
    {
        StoredPayload? payload = null;
        try { payload = JsonSerializer.Deserialize<StoredPayload>(message.StructuredPayloadJson, JsonOptions); } catch { }
        return new(conversationId, message.Id, payload?.Type ?? "text", message.Text, payload?.Data, payload?.Actions ?? [], payload?.Suggestions ?? [], message.Intent);
    }
    private static string RoleRoute(string role, string page) => role.ToLowerInvariant() switch { "student" => $"/s/{page}", "parent" => $"/p/{page}", "teacher" => $"/t/{page}", _ => $"/{page}" };

    private sealed record StudentCandidate(Guid Id, Guid UserId, string FullName, string ClassName, string SchoolNumber, string PhotoUrl);
    private sealed record StudentSelection(IReadOnlyList<StudentCandidate> Candidates, bool Denied, string Message, string FailureCode);
    private sealed record StoredPayload(string Type, JsonElement? Data, IReadOnlyList<AssistantActionDto> Actions, IReadOnlyList<string> Suggestions)
    {
        public StoredPayload(string type, object? data, IReadOnlyList<AssistantActionDto> actions, IReadOnlyList<string> suggestions)
            : this(type, data is null ? null : JsonSerializer.SerializeToElement(data, JsonOptions), actions, suggestions) { }
    }
}
