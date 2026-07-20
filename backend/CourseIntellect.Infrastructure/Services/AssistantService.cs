using System.Diagnostics;
using System.Text.Json;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AssistantService(
    CourseIntellectDbContext db,
    IAssistantIntentResolver resolver,
    IEntitlementService entitlementService,
    ILogger<AssistantService> logger) : IAssistantService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

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

    public Task<IReadOnlyList<AssistantSuggestionDto>> GetSuggestionsAsync(AssistantRequestContext context, CancellationToken cancellationToken)
    {
        IReadOnlyList<AssistantSuggestionDto> result = context.PrimaryRole.ToLowerInvariant() switch
        {
            "student" => Suggestions(("Bugünkü derslerim", "schedule", "Akademik"), ("Bekleyen ödevlerim", "homework", "Akademik"), ("Yaklaşan sınavlarım", "exam", "Akademik"), ("Devamsızlığım", "attendance", "Akademik"), ("Direksiyon derslerim", "driving_lessons", "Sürücü Kursu"), ("Kurs ilerlemem", "driving_progress", "Sürücü Kursu")),
            "parent" => Suggestions(("Çocuğumun devamsızlığı", "attendance", "Takip"), ("Son sınav sonuçları", "exam", "Takip"), ("Bekleyen ödevler", "homework", "Takip"), ("Yaklaşan ödemeler", "payment", "Finans"), ("Servis durumu", "transport", "Servis")),
            "teacher" => Suggestions(("Bugünkü derslerim", "schedule", "Ders"), ("Bugün devamsız olanlar", "absent", "Yoklama"), ("Öğrenci ara", "search", "Öğrenci"), ("Direksiyon dersleri", "driving_lessons", "Sürücü Kursu")),
            "accounting" => Suggestions(("Borcu olan öğrenciler", "debt", "Finans"), ("Ödeme durumunu göster", "payment", "Finans"), ("Öğrenci ara", "search", "Finans")),
            _ => Suggestions(("Öğrenci ara", "search", "Öğrenci"), ("Bugün devamsız olanlar", "absent", "Yoklama"), ("Borcu olan öğrenciler", "debt", "Finans"), ("Yaklaşan sınavlar", "exam", "Akademik"), ("Kursiyer ilerlemesi", "driving_progress", "Sürücü Kursu")),
        };
        return Task.FromResult(result);
    }

    public Task<AssistantResponseDto> ExecuteActionAsync(AssistantRequestContext context, AssistantActionRequest request, CancellationToken cancellationToken)
    {
        var message = request.Command.ToLowerInvariant() switch
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
        return SendInternalAsync(context, new SendAssistantMessageRequest(request.ConversationId, message, Guid.NewGuid(), null), request.StudentId, cancellationToken);
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
            var requiredModule = RequiredModule(parsed.Intent);
            if (isServiceDriver && parsed.Intent is not (AssistantIntent.Greeting or AssistantIntent.Help or AssistantIntent.Unknown or AssistantIntent.GetTransportStatus))
            {
                authorized = false;
                failureCode = "DRIVER_SCOPE_DENIED";
                response = Build(conversation.Id, "permission_denied", "Servis şoförü rolü yalnızca atanmış hattındaki servis bilgilerine erişebilir.", null, parsed.Intent);
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
                response = Build(conversation.Id, "text", "Merhaba! SchoolAsist Asistan olarak yalnızca yetkiniz kapsamındaki okul ve sürücü kursu bilgilerine güvenli biçimde erişmenize yardımcı olabilirim.", null, parsed.Intent, suggestions: (await GetSuggestionsAsync(context, cancellationToken)).Take(4).Select(x => x.Label).ToArray());
            else if (parsed.Intent is AssistantIntent.Help or AssistantIntent.Unknown)
                response = Build(conversation.Id, "quick_actions", "Öğrenci veya kursiyer arayabilir; devamsızlık, sınav, ödev, program, ödeme, servis ve sürücü kursu ilerleme bilgilerini gösterebilirim.", null, AssistantIntent.Help, suggestions: (await GetSuggestionsAsync(context, cancellationToken)).Select(x => x.Label).ToArray());
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
                    response = await ExecuteStudentIntentAsync(context, conversation.Id, parsed.Intent, student, cancellationToken);
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
    private static string? RequiredModule(AssistantIntent intent) => intent switch
    {
        AssistantIntent.GetAttendance or AssistantIntent.ListAbsentStudents => "attendance",
        AssistantIntent.GetExamResults or AssistantIntent.GetExamAverage or AssistantIntent.GetUpcomingExams or AssistantIntent.ListLowScoreStudents or AssistantIntent.GetDrivingExamStatus => "exams",
        AssistantIntent.GetHomework => "assignments",
        AssistantIntent.GetAnnouncements => "notifications",
        AssistantIntent.GetUnreadMessages => "chat",
        AssistantIntent.GetPaymentSummary or AssistantIntent.ListStudentsWithDebt => "finance",
        AssistantIntent.GetTransportStatus => "service",
        AssistantIntent.GetDrivingLessons => "schedule",
        AssistantIntent.GetDrivingProgress => "students",
        AssistantIntent.SearchStudent or AssistantIntent.GetStudentSummary or AssistantIntent.ListClassStudents => "students",
        _ => null,
    };
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
