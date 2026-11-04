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

public sealed partial class AssistantService(
    CourseIntellectDbContext db,
    IAssistantIntentResolver resolver,
    IEntitlementService entitlementService,
    IParentNotifier parentNotifier,
    ILogger<AssistantService> logger,
    IStudentInsightService insights,
    IAssistantChatModel? chatModel = null) : IAssistantService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly System.Globalization.CultureInfo TrCulture = new("tr-TR");

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
            Portal = AssistantIntentCatalog.PortalOf(context.PrimaryRole),
        };
        db.AssistantConversations.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<IReadOnlyList<AssistantConversationDto>> GetConversationsAsync(AssistantRequestContext context, string? portal, CancellationToken cancellationToken)
    {
        // Portal verilirse yalnız o portalda açılmış sohbetler: veli sohbeti öğretmen portalında listelenmez.
        var wanted = (portal ?? string.Empty).Trim().ToLowerInvariant();
        return await db.AssistantConversations.AsNoTracking()
            .Where(x => x.UserId == context.UserId && !x.IsArchived && x.LastMessageAtUtc != null)
            .Where(x => wanted.Length == 0 || x.Portal == wanted)
            .OrderByDescending(x => x.LastMessageAtUtc ?? x.CreatedAtUtc)
            .Take(50)
            .Select(x => new AssistantConversationDto(x.Id, x.Title, x.CreatedAtUtc, x.UpdatedAtUtc, x.LastMessageAtUtc, x.Portal))
            .ToListAsync(cancellationToken);
    }

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
        return rows.Select(x =>
        {
            var stored = FromStored(x, conversationId);
            return new AssistantMessageDto(
                x.Id,
                x.SenderType == AssistantSenderType.User ? "user" : "assistant",
                ToResponseType(x.MessageType, x.StructuredPayloadJson),
                x.Text,
                x.Intent,
                ParseData(x.StructuredPayloadJson),
                x.CreatedAtUtc,
                stored.Actions,
                stored.Suggestions,
                x.Feedback);
        }).ToList();
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

    /// <summary>
    /// Panel açılınca gösterilen hazır sorular: portala, kurum türüne, pakete ve rol izinlerine göre.
    /// Etiket doğrudan mesaj olarak gönderilir; kural motoru bu cümleleri anlar.
    /// </summary>
    public async Task<IReadOnlyList<AssistantSuggestionDto>> GetSuggestionsAsync(AssistantRequestContext context, CancellationToken cancellationToken)
    {
        var english = context.Language == "en";
        return (await AvailableSuggestionsAsync(context, AssistantIntentCatalog.PortalOf(context.PrimaryRole), cancellationToken))
            .Select(item => new AssistantSuggestionDto(english ? item.En : item.Tr, item.Command, item.Category))
            .ToList();
    }

    public async Task<AssistantResponseDto> ExecuteActionAsync(AssistantRequestContext context, AssistantActionRequest request, CancellationToken cancellationToken)
    {
        var command = request.Command.ToLowerInvariant();

        // "confirm:" ön eki yalnız onay kartındaki butondan gelir ve VERİ DEĞİŞTİRİR.
        // Bu yüzden buradan sonrası sorgu hattına düşmez; ayrı, denetimli bir yol.
        if (command.StartsWith("confirm:", StringComparison.Ordinal))
            return await ExecuteConfirmedActionAsync(context, request, command["confirm:".Length..], cancellationToken);

        if (command == "cancel_action")
            return Build(request.ConversationId, "text", context.Language == "en" ? "Okay, I cancelled it." : "Tamam, işlemi iptal ettim.", null, AssistantIntent.Unknown);

        var message = command switch
        {
            // Seçim/liste kartında bir öğrenciye tıklandı: kimlik StudentId'den gelir, rol kapsamı hedef çözümde yine denetlenir.
            "summary" or "get_summary" => "Öğrenci bilgisi göster",
            "attendance" or "get_attendance" => "Devamsızlığını göster",
            "exam" or "get_exam_results" => "Sınav sonuçlarını göster",
            "homework" or "get_homework" => "Bekleyen ödevlerini göster",
            "payment" or "get_payment" => "Ödeme durumunu göster",
            "transport" or "get_transport" => "Servis durumunu göster",
            "topics" or "get_topics" => "Zayıf olduğu konular",
            "institution_summary" => "Kurum özetini göster",
            "finance_overview" => "Bu ay tahsilat özeti",
            _ => request.Command,
        };
        return await SendInternalAsync(context, new SendAssistantMessageRequest(request.ConversationId, message, Guid.NewGuid(), request.Context), request.StudentId, cancellationToken);
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
            conversation = new AssistantConversation { TenantId = context.TenantId, BranchId = context.BranchId, UserId = context.UserId, Title = SanitizeTitle(rawMessage), Portal = AssistantIntentCatalog.PortalOf(context.PrimaryRole) };
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

        // Hitap edilen ad ("Maydi, …") soru metninden çıkarılır; kayıtlı mesaj olduğu gibi kalır.
        var query = AssistantSmallTalk.WithoutName(rawMessage);
        var parsed = await resolver.ResolveAsync(query, cancellationToken);
        AssistantResponseDto response;
        // Hedef önceliği: butondaki öğrenci > ekranda bakılan öğrenci > sohbette en son konuşulan.
        // Ekran ipucu yalnız aday seçer; rol kapsamı ResolveTargetAsync'te yine uygulanır.
        var focusName = request.Context?.SelectedStudentName?.Trim();
        Guid? targetStudentId = explicitStudentId ?? request.Context?.SelectedStudentId ?? conversation.SelectedStudentId;
        var authorized = true;
        var failureCode = string.Empty;
        try
        {
            var voice = Voice(context, request.ClientMessageId);
            var portal = voice.Portal;
            var folded = RuleBasedAssistantIntentResolver.Fold(query);
            var intent = parsed.Intent;
            var isServiceDriver = await db.ServiceDrivers.AsNoTracking().AnyAsync(x => x.UserId == context.UserId && x.IsActive, cancellationToken);
            var institutionType = await ResolveInstitutionTypeAsync(context, cancellationToken);
            var requiredModule = AssistantIntentCatalog.RequiredModule(intent);
            var conversational = intent is AssistantIntent.Greeting or AssistantIntent.Thanks or AssistantIntent.SmallTalk or AssistantIntent.Help or AssistantIntent.HowTo or AssistantIntent.Unknown;

            // Yerel model ajanı: kuralın anlamadığı ya da analiz/rapor isteyen sorular. Model kapalı ya da
            // cevap veremezse analiz ifadeleri doğrudan ilgili araca gider (yorumsuz), kalanı kural motoruna.
            var agentState = new AgentState(context, conversation, voice, query, folded, parsed, targetStudentId, explicitStudentId is null ? focusName : null);
            AssistantResponseDto? routed = null;
            if (ShouldUseAgent(intent, folded, portal, isServiceDriver, explicitStudentId))
                routed = await RunAgentAsync(agentState, cancellationToken);
            if (routed is null && portal.Length > 0 && !isServiceDriver && explicitStudentId is null
                && intent is not (AssistantIntent.Greeting or AssistantIntent.Thanks or AssistantIntent.SmallTalk or AssistantIntent.Help)
                && intent != AssistantIntent.HowTo && !AssistantIntentCatalog.IsWriteAction(intent) && HasAnalyticCue(folded))
                routed = await RunRuleToolAsync(agentState, cancellationToken);

            if (routed is not null)
            {
                response = routed;
                targetStudentId = conversation.SelectedStudentId ?? targetStudentId;
            }
            else if (portal.Length == 0)
            {
                authorized = false;
                failureCode = "PORTAL_UNKNOWN";
                response = Build(conversation.Id, "permission_denied", voice.OutOfPortal(), null, intent);
            }
            else if (isServiceDriver && !(conversational || intent == AssistantIntent.GetTransportStatus))
            {
                authorized = false;
                failureCode = "DRIVER_SCOPE_DENIED";
                response = Build(conversation.Id, "permission_denied", voice.DriverDenied(), null, intent);
            }
            // ── Sohbet ──
            else if (intent is AssistantIntent.Greeting or AssistantIntent.Thanks or AssistantIntent.SmallTalk)
            {
                // Tür, cevabın tonunu seçer; vedalaşmada öneri gösterilmez (sohbet kapanıyor).
                var social = AssistantSmallTalk.Classify(folded) switch
                {
                    SocialKind.None => intent == AssistantIntent.Thanks ? SocialKind.Thanks : intent == AssistantIntent.Greeting ? SocialKind.Greeting : SocialKind.Identity,
                    var kind => kind,
                };
                var suggestionCount = social switch { SocialKind.Farewell => 0, SocialKind.Thanks or SocialKind.WellWish or SocialKind.Apology or SocialKind.Acknowledge => 3, _ => 4 };
                response = Build(conversation.Id, "text", voice.Social(social, folded), null, intent,
                    suggestions: suggestionCount > 0 ? await SuggestionLabelsAsync(context, voice, suggestionCount, cancellationToken) : null);
            }
            else if (intent is AssistantIntent.Help)
                response = Build(conversation.Id, "quick_actions", voice.Help(), null, intent, suggestions: await SuggestionLabelsAsync(context, voice, 8, cancellationToken));
            else if (intent is AssistantIntent.HowTo)
                response = await HowToAsync(context, conversation.Id, folded, voice, cancellationToken);
            // ── Kapsam kapıları ──
            // Kurum türü kapsamı yetkiden ÖNCE gelir: "bu bilgi kurumunuzda yok" demek,
            // "yetkiniz yok" demekten hem doğru hem daha az kafa karıştırıcı.
            else if (intent != AssistantIntent.Unknown && !AssistantIntentCatalog.IsAvailableFor(intent, institutionType))
            {
                authorized = false;
                failureCode = "INSTITUTION_SCOPE_DENIED";
                response = Build(conversation.Id, "permission_denied", voice.InstitutionDenied(AssistantIntentCatalog.DisplayName(institutionType)), null, intent,
                    suggestions: await SuggestionLabelsAsync(context, voice, 4, cancellationToken));
            }
            else if (intent != AssistantIntent.Unknown && !AssistantIntentCatalog.IsAllowedForRole(intent, context.PrimaryRole))
            {
                // Her rol yalnız kendi portalının sorularını sorabilir: kibarca kendi alanına yönlendir.
                authorized = false;
                failureCode = "ROLE_SCOPE_DENIED";
                response = Build(conversation.Id, "permission_denied", voice.OutOfPortal(), null, intent,
                    suggestions: await SuggestionLabelsAsync(context, voice, 4, cancellationToken));
            }
            else if (requiredModule is not null && !await entitlementService.IsAllowedAsync(context.Principal, requiredModule, "view", cancellationToken))
            {
                authorized = false;
                failureCode = "ENTITLEMENT_DENIED";
                response = Build(conversation.Id, "permission_denied", voice.EntitlementDenied(), null, intent);
            }
            else if (parsed.TcNo is not null && !RuleBasedAssistantIntentResolver.IsValidTurkishIdentityNumber(parsed.TcNo))
            {
                response = Build(conversation.Id, "error", voice.InvalidTc(), null, intent);
                failureCode = "INVALID_TCKN";
            }
            // ── Öğrenci gerektirmeyen veri soruları ──
            else if (intent is AssistantIntent.ListClassStudents or AssistantIntent.ListAbsentStudents or AssistantIntent.ListLowScoreStudents or AssistantIntent.ListStudentsWithDebt)
                response = await ExecuteListAsync(context, conversation.Id, parsed, voice, cancellationToken);
            else if (intent == AssistantIntent.GetFinanceOverview)
                response = await FinanceOverviewAsync(conversation.Id, voice, cancellationToken);
            else if (intent == AssistantIntent.GetInstitutionSummary)
                response = await InstitutionSummaryAsync(conversation.Id, voice, cancellationToken);
            else if (intent == AssistantIntent.GetUnreadMessages)
                response = Build(conversation.Id, "text", voice.Messages(), null, intent, [new("navigate", voice.English ? "Open messages" : "Mesajları aç", RoleRoute(portal, "chat"), null, null)]);
            else if (intent == AssistantIntent.GetSchedule && portal == "teacher")
                response = await ScheduleAsync(context, conversation.Id, new StudentCandidate(Guid.Empty, Guid.Empty, context.Principal.FindFirst("name")?.Value ?? "Öğretmen", string.Empty, string.Empty, string.Empty), voice, cancellationToken);
            else if (intent == AssistantIntent.GetAnnouncements && portal is not ("student" or "parent"))
                response = await AnnouncementsAsync(context, conversation.Id, null, voice, cancellationToken);
            // ── Öğrenci hedefli sorular (ya da yalnız bir ad yazıldı) ──
            else
            {
                var selection = await ResolveTargetAsync(context, parsed, folded, targetStudentId, intent != AssistantIntent.Unknown, voice, cancellationToken,
                    explicitStudentId is null ? focusName : null);
                if (selection.Denied)
                {
                    authorized = false;
                    failureCode = selection.FailureCode;
                    response = Build(conversation.Id, "permission_denied", selection.Message, null, intent,
                        suggestions: await SuggestionLabelsAsync(context, voice, 3, cancellationToken));
                }
                else if (selection.Candidates.Count > 1)
                {
                    var cards = selection.Candidates.Select(StudentCard).ToList();
                    response = Build(conversation.Id, "student_selection", portal == "parent" ? voice.ChooseChild() : voice.MultipleStudents(selection.Candidates.Count), new { items = cards }, intent);
                }
                else if (selection.Candidates.Count == 0)
                {
                    if (intent == AssistantIntent.Unknown)
                        response = Build(conversation.Id, "quick_actions", voice.Unknown(), null, AssistantIntent.Unknown, suggestions: await SuggestionLabelsAsync(context, voice, 5, cancellationToken));
                    else if (selection.NeedsName && portal == "teacher" && (await TeacherClassesAsync(context, cancellationToken)).Count == 0)
                        response = Build(conversation.Id, "text", voice.English
                            ? "No classes are assigned to you in the timetable yet, so I can't reach your students. Your administrator can add your timetable."
                            : "Ders programınızda size atanmış sınıf görünmediği için öğrencilerinize ulaşamıyorum. Yöneticiniz ders programınızı girdiğinde yardımcı olabilirim.", null, intent);
                    else
                        response = Build(conversation.Id, "error", selection.NeedsName ? voice.AskWhichStudent() : voice.StudentNotFound(), null, intent);
                }
                else
                {
                    var student = selection.Candidates[0];
                    conversation.SelectedStudentId = student.Id;
                    targetStudentId = student.Id;
                    var effective = intent == AssistantIntent.Unknown ? AssistantIntent.GetStudentSummary : intent;

                    // GÜVENLİK KAPISI: veri değiştiren niyetler burada ÇALIŞTIRILMAZ.
                    // Kullanıcıya ne olacağını anlatan bir onay kartı döner; işlem
                    // yalnızca onay butonuyla (ExecuteActionAsync) yürütülür.
                    response = AssistantIntentCatalog.IsWriteAction(effective)
                        ? BuildConfirmation(conversation.Id, effective, student)
                        : await ExecuteStudentIntentAsync(context, conversation.Id, effective, student, voice, cancellationToken);
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
            Intent = response.Intent, StructuredPayloadJson = JsonSerializer.Serialize(StoredPayload.Of(response.Type, response.Data, response.Actions, response.Suggestions), JsonOptions),
            ClientMessageId = request.ClientMessageId, ProcessingDurationMs = stopwatch.ElapsedMilliseconds,
        };
        db.AssistantMessages.Add(stored);
        db.AssistantAuditLogs.Add(new AssistantAuditLog
        {
            TenantId = context.TenantId, UserId = context.UserId, ConversationId = conversation.Id, Intent = parsed.Intent,
            ToolName = ToolName(response.Intent), TargetStudentId = targetStudentId, WasAuthorized = authorized,
            FailureReasonCode = failureCode, CorrelationId = context.CorrelationId,
            IpAddressMasked = MaskIp(context.IpAddress), UserAgent = Truncate(context.UserAgent, 250),
        });
        await db.SaveChangesAsync(cancellationToken);
        return response;
    }

    private async Task<AssistantResponseDto> ExecuteStudentIntentAsync(AssistantRequestContext context, Guid conversationId, AssistantIntent intent, StudentCandidate student, AssistantVoice voice, CancellationToken ct)
    {
        var self = voice.Portal == "student";
        var response = intent switch
        {
            AssistantIntent.SearchStudent or AssistantIntent.GetStudentSummary or AssistantIntent.OpenStudentDetail => StudentSummary(conversationId, student, voice),
            AssistantIntent.GetAttendance => await AttendanceAsync(conversationId, student, self, voice, ct),
            AssistantIntent.GetExamResults or AssistantIntent.GetExamAverage or AssistantIntent.GetUpcomingExams => await ExamResultsAsync(conversationId, student, self, voice, ct),
            AssistantIntent.GetHomework => await HomeworkAsync(conversationId, student, self, voice, ct),
            AssistantIntent.GetSchedule => await ScheduleAsync(context, conversationId, student, voice, ct),
            AssistantIntent.GetAnnouncements => await AnnouncementsAsync(context, conversationId, student, voice, ct),
            AssistantIntent.GetPaymentSummary => await PaymentAsync(conversationId, student, self, voice, ct),
            AssistantIntent.GetTransportStatus => await TransportAsync(conversationId, student, self, voice, ct),
            AssistantIntent.GetLibraryLoans => await LibraryLoansAsync(conversationId, student, self, voice, ct),
            AssistantIntent.GetTopicInsight => await TopicInsightAsync(conversationId, student, self, voice, ct),
            _ => Build(conversationId, "quick_actions", voice.Unknown(), null, AssistantIntent.Unknown),
        };
        // Her cevabın sonunda doğal takip soruları (seçili öğrenci üzerinden çalışır).
        return response.Suggestions.Count > 0 ? response : response with { Suggestions = FollowUps(voice, intent, context.PrimaryRole) };
    }

    /// <summary>
    /// Bu ayki tahsilat + açık borç toplamı. Ay penceresi UTC+3 yerel ayın
    /// başından şimdiye kadar; kurum "bu ay ne kazandık" sorusunu bekler.
    /// Tenant izolasyonu sorgu filtresiyle sağlanır — elle tenant koşulu yok.
    /// </summary>
    private async Task<AssistantResponseDto> FinanceOverviewAsync(Guid conversationId, AssistantVoice voice, CancellationToken ct)
    {
        var localNow = DateTime.UtcNow.AddHours(3);
        // Postgres timestamptz yalnız UTC kabul eder; Kind=Unspecified tarih sorguyu düşürüyordu
        // (SQLite testleri bunu yakalamaz). Türkiye ayının başı UTC'ye çevrilip Kind=Utc verilir.
        var monthStartUtc = DateTime.SpecifyKind(new DateTime(localNow.Year, localNow.Month, 1, 0, 0, 0).AddHours(-3), DateTimeKind.Utc);

        var collectedThisMonth = await db.FinancePayments.AsNoTracking()
            .Where(x => x.PaidAtUtc >= monthStartUtc)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;

        var openDebt = await db.FinanceInstallments.AsNoTracking()
            .Where(x => x.Amount > x.PaidAmount)
            .SumAsync(x => (decimal?)(x.Amount - x.PaidAmount), ct) ?? 0m;

        var overdueCount = await db.FinanceInstallments.AsNoTracking()
            .Where(x => x.Amount > x.PaidAmount && x.DueDateUtc < DateTime.UtcNow)
            .CountAsync(ct);

        var period = localNow.ToString("MMMM yyyy", voice.English ? System.Globalization.CultureInfo.GetCultureInfo("en-US") : TrCulture);
        return Build(conversationId, "finance_overview",
            voice.FinanceOverview(collectedThisMonth, openDebt, overdueCount, period),
            new
            {
                collectedThisMonth,
                openDebt,
                overdueInstallments = overdueCount,
                currency = "TRY",
                periodLabel = period,
            },
            AssistantIntent.GetFinanceOverview,
            suggestions: voice.English ? ["Students with debt"] : ["Borcu olan öğrenciler"]);
    }

    /// <summary>
    /// Kuruma özel sayım panosu. Sürücü kursu ve okul FARKLI metrikler ister,
    /// o yüzden kurum türüne göre ayrışır.
    /// </summary>
    private async Task<AssistantResponseDto> InstitutionSummaryAsync(Guid conversationId, AssistantVoice voice, CancellationToken ct)
    {
        var today = AssistantDates.TodayTr;
        var totalStudents = await db.Students.AsNoTracking().CountAsync(ct);
        var absentNames = await db.AttendanceEntries.AsNoTracking()
            .Where(x => x.LessonDate >= today && x.LessonDate < today.AddDays(1) && AttendanceStatusMatcher.AbsentStatuses.Contains(x.Status))
            .Select(x => x.StudentName).Distinct().CountAsync(ct);

        return Build(conversationId, "institution_summary",
            voice.InstitutionSummary(totalStudents, absentNames),
            new
            {
                mode = "school",
                metrics = new[]
                {
                    new { label = voice.English ? "Total students" : "Toplam öğrenci", value = totalStudents },
                    new { label = voice.English ? "Absent today" : "Bugün devamsız", value = absentNames },
                },
            },
            AssistantIntent.GetInstitutionSummary,
            suggestions: voice.English ? ["Absent today", "Collections this month"] : ["Bugün devamsız olanlar", "Bu ay tahsilat"]);
    }

    private async Task<AssistantResponseDto> ExecuteListAsync(AssistantRequestContext context, Guid conversationId, ParsedAssistantQuery parsed, AssistantVoice voice, CancellationToken ct)
    {
        // Portal kapsamı katalogda (izin listesi) kontrol edildi; burada ikinci savunma hattı.
        var role = voice.Portal;
        if (!AssistantIntentCatalog.IsAllowedForRole(parsed.Intent, context.PrimaryRole)) return Build(conversationId, "permission_denied", voice.OutOfPortal(), null, parsed.Intent);

        if (parsed.Intent == AssistantIntent.ListStudentsWithDebt)
        {
            var debts = await db.FinanceInstallments.AsNoTracking().Where(x => x.Amount > x.PaidAmount)
                .GroupBy(x => new { x.StudentUserId, x.StudentName }).Select(g => new { studentId = g.Key.StudentUserId, fullName = g.Key.StudentName, remaining = g.Sum(x => x.Amount - x.PaidAmount), currency = "TRY" }).Take(50).ToListAsync(ct);
            return Build(conversationId, "student_list", voice.StudentList(parsed.Intent, debts.Count, debts.Select(x => x.fullName).ToList(), null), new { items = debts }, parsed.Intent);
        }

        var students = db.Students.AsNoTracking();
        if (role == "teacher")
        {
            var classes = await TeacherClassesAsync(context, ct);
            if (classes.Count == 0)
            {
                return Build(conversationId, "text", voice.English
                    ? "No classes are assigned to you in the timetable yet, so I can't list your students."
                    : "Ders programınızda size atanmış sınıf görünmediği için öğrenci listesi çıkaramıyorum. Yöneticiniz programınızı girdiğinde yardımcı olabilirim.", null, parsed.Intent);
            }
            students = students.Where(x => classes.Contains(x.ClassName));
        }
        if (parsed.Intent == AssistantIntent.ListClassStudents && parsed.GradeLevel.HasValue && parsed.SectionName is not null)
        {
            var className = $"{parsed.GradeLevel}-{parsed.SectionName}".ToLowerInvariant();
            students = students.Where(x => x.ClassName.ToLower() == className);
        }
        if (parsed.Intent == AssistantIntent.ListAbsentStudents)
        {
            var today = AssistantDates.TodayTr;
            var absentNames = await db.AttendanceEntries.AsNoTracking().Where(x => x.LessonDate >= today && x.LessonDate < today.AddDays(1) && AttendanceStatusMatcher.AbsentStatuses.Contains(x.Status)).Select(x => x.StudentName).Distinct().ToListAsync(ct);
            students = students.Where(x => absentNames.Contains(x.FullName));
        }
        if (parsed.Intent == AssistantIntent.ListLowScoreStudents)
        {
            var threshold = parsed.ScoreThreshold ?? 50;
            var names = await db.ExamResults.AsNoTracking().Where(x => x.Score < threshold).Select(x => x.StudentName).Distinct().ToListAsync(ct);
            students = students.Where(x => names.Contains(x.FullName));
        }
        var result = await students.OrderBy(x => x.FullName).Take(50).Select(x => new { studentId = x.Id, fullName = x.FullName, className = x.ClassName, studentNumberMasked = Mask(x.SchoolNumber) }).ToListAsync(ct);
        return Build(conversationId, "student_list", voice.StudentList(parsed.Intent, result.Count, result.Select(x => x.fullName).ToList(), parsed.ScoreThreshold), new { items = result }, parsed.Intent);
    }

    private AssistantResponseDto StudentSummary(Guid conversationId, StudentCandidate student, AssistantVoice voice)
    {
        var data = new { studentId = student.Id, student.FullName, student.ClassName, studentNumberMasked = Mask(student.SchoolNumber), photoUrl = student.PhotoUrl, institutionMode = "school" };
        return Build(conversationId, "student_summary", voice.StudentFound(student.FullName, student.ClassName), data, AssistantIntent.GetStudentSummary, StudentActions(student.Id, voice));
    }

    private async Task<AssistantResponseDto> AttendanceAsync(Guid conversationId, StudentCandidate student, bool self, AssistantVoice voice, CancellationToken ct)
    {
        var rows = await db.AttendanceEntries.AsNoTracking().Where(x => x.StudentId == student.Id || (x.StudentId == null && x.StudentName == student.FullName)).OrderByDescending(x => x.LessonDate).Take(30).Select(x => new { date = x.LessonDate, x.Status, x.Lesson }).ToListAsync(ct);
        var data = new { studentId = student.Id, student.FullName, total = rows.Count, absent = rows.Count(x => AttendanceStatusMatcher.IsAbsent(x.Status)), late = rows.Count(x => AttendanceStatusMatcher.IsLate(x.Status)), recent = rows };
        return Build(conversationId, "attendance_summary", voice.Attendance(student.FullName, self, data.total, data.absent, data.late), data, AssistantIntent.GetAttendance);
    }

    private async Task<AssistantResponseDto> ExamResultsAsync(Guid conversationId, StudentCandidate student, bool self, AssistantVoice voice, CancellationToken ct)
    {
        // DateLabel metindir ("05.11.2026"); metin sıralaması son sınavları kaçırır, tarih ayrıştırılarak sıralanır.
        var rows = (await db.ExamResults.AsNoTracking().Where(x => x.StudentId == student.Id || (x.StudentId == null && x.StudentName == student.FullName)).Select(x => new { x.ExamTitle, x.Subject, date = x.DateLabel, x.Score, x.Net }).ToListAsync(ct)).OrderByDescending(x => AssistantDates.TryParse(x.date) ?? DateTime.MinValue).Take(20).ToList();
        var best = rows.OrderByDescending(x => x.Score).FirstOrDefault();
        var average = rows.Count == 0 ? 0 : rows.Average(x => x.Score);
        return Build(conversationId, "exam_results", voice.ExamResults(student.FullName, self, rows.Count, average, best?.Subject, best?.Score),
            new { studentId = student.Id, student.FullName, average, items = rows }, AssistantIntent.GetExamResults);
    }

    private async Task<AssistantResponseDto> HomeworkAsync(Guid conversationId, StudentCandidate student, bool self, AssistantVoice voice, CancellationToken ct)
    {
        var submitted = db.HomeworkSubmissions.AsNoTracking().Where(x => x.StudentName == student.FullName).Select(x => x.AssignmentId);
        // Teslim tarihi metin olarak saklanır; sıralama tarihe çevrilerek yapılır (yaklaşanlar önce, gecikenler sonra).
        var today = AssistantDates.TodayTr;
        var rows = (await db.HomeworkAssignments.AsNoTracking().Where(x => x.ClassName == student.ClassName && !submitted.Contains(x.Id)).Take(200).Select(x => new { id = x.Id, x.Title, x.Subject, teacher = x.Teacher, deadline = x.DeadlineLabel }).ToListAsync(ct))
            .Select(x => (Row: x, Due: AssistantDates.TryParse(x.deadline)))
            .OrderBy(x => x.Due is null ? 2 : x.Due < today ? 1 : 0).ThenBy(x => x.Due)
            .Take(30)
            .Select(x => new { x.Row.id, x.Row.Title, x.Row.Subject, x.Row.teacher, deadline = x.Due is DateTime due ? AssistantDates.Short(due) : x.Row.deadline, status = x.Due < today ? "overdue" : "pending" })
            .ToList();
        var nearest = rows.FirstOrDefault();
        return Build(conversationId, "homework_list", voice.Homework(student.FullName, self, rows.Count, nearest?.Title, nearest?.deadline),
            new { studentId = student.Id, student.FullName, items = rows }, AssistantIntent.GetHomework);
    }

    private async Task<AssistantResponseDto> ScheduleAsync(AssistantRequestContext context, Guid conversationId, StudentCandidate student, AssistantVoice voice, CancellationToken ct)
    {
        var query = db.TeacherTimetableSlots.AsNoTracking().AsQueryable();
        var forTeacher = voice.Portal == "teacher";
        if (forTeacher) query = query.Where(x => x.TeacherUserId == context.UserId);
        else query = query.Where(x => x.ClassName == student.ClassName);
        var rows = await query.OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime).Select(x => new { x.DayOfWeek, x.StartTime, x.EndTime, x.Lesson, x.TeacherName, x.ClassName }).ToListAsync(ct);
        // Ders programında gün 1=Pazartesi .. 7=Pazar; bugün Türkiye saatine göre.
        var localDay = (int)DateTime.UtcNow.AddHours(3).DayOfWeek;
        var todayIndex = localDay == 0 ? 7 : localDay;
        var today = rows.Where(x => x.DayOfWeek == todayIndex).ToList();
        var first = today.FirstOrDefault();
        return Build(conversationId, "schedule",
            voice.Schedule(forTeacher, voice.Portal == "student", student.FullName, today.Count, first is null ? null : $"{first.StartTime} {first.Lesson}", rows.Count),
            new { studentId = student.Id, student.FullName, today = todayIndex, items = rows }, AssistantIntent.GetSchedule);
    }

    private async Task<AssistantResponseDto> AnnouncementsAsync(AssistantRequestContext context, Guid conversationId, StudentCandidate? student, AssistantVoice voice, CancellationToken ct)
    {
        var role = context.PrimaryRole;
        var className = student?.ClassName;
        var rows = await db.Announcements.AsNoTracking().Where(x => x.ClassName == null || (className != null && x.ClassName == className) || x.Audience.ToLower().Contains(role.ToLower())).Select(x => new { x.Title, x.Detail, date = x.DateLabel }).ToListAsync(ct);
        // Metin etiketi değil tarih sırası: en yeni duyuru önce.
        rows = rows.OrderByDescending(x => AssistantDates.TryParse(x.date) ?? DateTime.MinValue).Take(20).ToList();
        return Build(conversationId, "announcement_list", voice.Announcements(rows.Count, rows.FirstOrDefault()?.Title), new { items = rows }, AssistantIntent.GetAnnouncements);
    }

    private async Task<AssistantResponseDto> PaymentAsync(Guid conversationId, StudentCandidate student, bool self, AssistantVoice voice, CancellationToken ct)
    {
        var rows = await db.FinanceInstallments.AsNoTracking().Where(x => x.StudentUserId == student.UserId || x.StudentName == student.FullName).OrderBy(x => x.DueDateUtc).Select(x => new { x.Label, dueDate = x.DueDateUtc, x.Amount, x.PaidAmount, remaining = x.Amount - x.PaidAmount, x.Status, x.Currency }).ToListAsync(ct);
        var total = rows.Sum(x => x.Amount);
        var paid = rows.Sum(x => x.PaidAmount);
        var remaining = rows.Sum(x => x.remaining);
        return Build(conversationId, "payment_summary", voice.Payment(student.FullName, self, total, paid, remaining),
            new { studentId = student.Id, student.FullName, total, paid, remaining, items = rows.Take(12) }, AssistantIntent.GetPaymentSummary);
    }

    private async Task<AssistantResponseDto> TransportAsync(Guid conversationId, StudentCandidate student, bool self, AssistantVoice voice, CancellationToken ct)
    {
        var row = await (from assignment in db.StudentServiceAssignments.AsNoTracking()
                         join route in db.ServiceRoutes.AsNoTracking() on assignment.RouteId equals route.Id
                         join stop in db.ServiceRouteStops.AsNoTracking() on assignment.StopId equals stop.Id
                         join vehicle in db.ServiceVehicles.AsNoTracking() on route.VehicleId equals vehicle.Id
                         where assignment.StudentId == student.Id && assignment.IsActive && route.IsActive
                         select new { routeName = route.Name, stopName = stop.Name, vehicle.PlateNumber, route.StartTime, route.EndTime }).FirstOrDefaultAsync(ct);
        return row is null
            ? Build(conversationId, "transport_status", voice.TransportNone(student.FullName, self), null, AssistantIntent.GetTransportStatus)
            : Build(conversationId, "transport_status", voice.Transport(student.FullName, self, row.routeName, row.stopName, row.PlateNumber, row.StartTime.ToString()), new { studentId = student.Id, student.FullName, route = row }, AssistantIntent.GetTransportStatus);
    }

    /// <summary>
    /// Öğrencinin üzerindeki iade edilmemiş kitaplar. Kütüphane kayıtları öğrenciyi
    /// ADIYLA tutuyor (yabancı anahtar yok), o yüzden eşleşme ad üzerinden yapılır.
    /// </summary>
    private async Task<AssistantResponseDto> LibraryLoansAsync(Guid conversationId, StudentCandidate student, bool self, AssistantVoice voice, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var rows = await db.LibraryLoans.AsNoTracking()
            .Where(x => x.StudentName == student.FullName && x.ReturnedAtUtc == null)
            .OrderBy(x => x.DueAtUtc)
            .Take(20)
            .Select(x => new { title = x.BookTitle, dueAt = x.DueAtUtc, x.FineAmount })
            .ToListAsync(ct);

        var overdue = rows.Count(x => x.dueAt < now);
        var summary = voice.Library(student.FullName, self, rows.Count, overdue);

        return Build(conversationId, "library_loans", summary,
            new
            {
                studentId = student.Id,
                student.FullName,
                items = rows.Select(x => new
                {
                    title = x.title,
                    deadline = x.dueAt.AddHours(3).ToString("dd.MM.yyyy"),
                    status = x.dueAt < now ? (voice.English ? "Overdue" : "Gecikti") : (voice.English ? "On time" : "Zamanında"),
                    remaining = x.FineAmount > 0 ? (decimal?)x.FineAmount : null,
                }),
            },
            AssistantIntent.GetLibraryLoans);
    }

    private async Task<AssistantResponseDto> StandaloneErrorAsync(AssistantRequestContext context, Guid? conversationId, string type, string text, AssistantIntent intent, CancellationToken ct)
    {
        var id = conversationId ?? (await CreateConversationAsync(context, "Yeni sohbet", ct)).Id;
        return Build(id, type, text, null, intent);
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
            .Where(x => x.StudentId == student.Id || (x.StudentId == null && x.StudentName == student.FullName))
            .OrderByDescending(x => x.LessonDate)
            .Take(30)
            .Select(x => x.Status)
            .ToListAsync(ct);

        var absences = rows.Count(AttendanceStatusMatcher.IsAbsent);
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
    private static IReadOnlyList<AssistantActionDto> StudentActions(Guid studentId, AssistantVoice voice)
    {
        var portalRole = voice.Portal;
        var actions = new List<AssistantActionDto>();
        void Add(AssistantIntent intent, string tr, string en, string command)
        {
            if (AssistantIntentCatalog.IsAllowedForRole(intent, portalRole)) actions.Add(new("send_command", voice.English ? en : tr, null, command, new { studentId }));
        }
        Add(AssistantIntent.GetAttendance, "Devamsızlık", "Attendance", "get_attendance");
        Add(AssistantIntent.GetExamResults, "Sınav sonuçları", "Exam results", "get_exam_results");
        Add(AssistantIntent.GetTopicInsight, "Zayıf konular", "Weak topics", "get_topics");
        Add(AssistantIntent.GetHomework, "Bekleyen ödevler", "Pending homework", "get_homework");
        Add(AssistantIntent.GetPaymentSummary, "Ödeme durumu", "Payment status", "get_payment");
        return actions;
    }
    private static AssistantConversationDto Map(AssistantConversation x) => new(x.Id, x.Title, x.CreatedAtUtc, x.UpdatedAtUtc, x.LastMessageAtUtc);
    private static string SanitizeTitle(string? value) => string.IsNullOrWhiteSpace(value) ? "Yeni sohbet" : Truncate(value.Replace('\n', ' ').Replace('\r', ' ').Trim(), 80);
    private static string Truncate(string? value, int max) => string.IsNullOrEmpty(value) ? string.Empty : value.Length <= max ? value : value[..max];
    private static string Mask(string? value) => string.IsNullOrWhiteSpace(value) ? "-" : value.Length <= 2 ? new string('*', value.Length) : $"{value[..Math.Min(2, value.Length)]}{new string('*', Math.Max(2, value.Length - 2))}";
    private static string MaskIp(string value) => value.Contains(':') ? "ipv6" : string.Join('.', value.Split('.').Select((x, i) => i == 3 ? "0" : x));
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
        // Bozuk/eski biçimli kayıt yalnız metin olarak gösterilir; yapısal kısım düşer.
        try { payload = JsonSerializer.Deserialize<StoredPayload>(message.StructuredPayloadJson, JsonOptions); } catch (JsonException) { payload = null; }
        return new(conversationId, message.Id, payload?.Type ?? "text", message.Text, payload?.Data, payload?.Actions ?? [], payload?.Suggestions ?? [], message.Intent);
    }
    private static string RoleRoute(string portal, string page) => portal switch { "student" => $"/s/{page}", "parent" => $"/p/{page}", "teacher" => $"/t/{page}", _ => $"/{page}" };

    private sealed record StudentCandidate(Guid Id, Guid UserId, string FullName, string ClassName, string SchoolNumber, string PhotoUrl);
    // Tek kurucu bilerek: iki kurucu olunca System.Text.Json kaydı geri okuyamıyordu
    // (NotSupportedException) ve geçmişteki kartlar düz metne düşüyordu.
    private sealed record StoredPayload(string Type, JsonElement? Data, IReadOnlyList<AssistantActionDto> Actions, IReadOnlyList<string> Suggestions)
    {
        public static StoredPayload Of(string type, object? data, IReadOnlyList<AssistantActionDto> actions, IReadOnlyList<string> suggestions) =>
            new(type, data is null ? null : JsonSerializer.SerializeToElement(data, JsonOptions), actions, suggestions);
    }
}
