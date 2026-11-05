using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Parents;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AcademicQueryService(
    CourseIntellectDbContext dbContext,
    IPasswordHasher passwordHasher,
    UsernameGenerator usernameGenerator,
    ITenantContext tenantContext,
    IParentNotifier parentNotifier,
    IAuditLogService auditLogService) : IAcademicQueryService
{
    public async Task<IReadOnlyList<StudentSummaryDto>> GetStudentsAsync(CancellationToken cancellationToken = default)
    {
        var currentTenantId = ResolveCurrentTenantId();
        var usersQuery = dbContext.Users.AsQueryable();
        if (currentTenantId.HasValue)
        {
            usersQuery = usersQuery.Where(x => x.TenantId == currentTenantId.Value);
        }

        var users = await usersQuery.ToDictionaryAsync(x => x.Id, cancellationToken);
        var userIds = users.Keys.ToList();
        var studentsQuery = dbContext.Students.AsQueryable();
        if (currentTenantId.HasValue)
        {
            studentsQuery = studentsQuery.Where(x => userIds.Contains(x.UserId));
        }

        // Pasif öğrenciler HİÇBİR listede/seçimde görünmez — yalnız "Pasif Kayıtlar"
        // ekranında (GetPassiveAccountsAsync). Bu uç tüm öğrenci seçicilerinin kaynağı
        // olduğu için filtreyi burada uygulamak her yeri (sınıf atama, rapor, mobil…) kapsar.
        var students = (await studentsQuery
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken))
            .Where(x => users.TryGetValue(x.UserId, out var u) && u.Status != UserStatus.Passive)
            .ToList();

        return students
            .Select(student => new StudentSummaryDto(
                student.Id,
                student.UserId,
                student.FullName,
                student.TcNo,
                student.ClassName,
                student.CurrentSchool,
                student.SchoolNumber,
                student.BirthDate,
                student.ProgramType,
                student.ParentName,
                student.ParentPhone,
                student.ParentEmail,
                student.Address,
                student.Note,
                student.PhotoUrl,
                users[student.UserId].Username,
                users[student.UserId].Status.ToString(),
                users[student.UserId].LastLoginAtUtc,
                users[student.UserId].ExtraRoles.Select(r => r.ToString()).ToList()))
            .ToList();
    }

    public async Task<IReadOnlyList<ExamResultDto>> GetExamResultsAsync(
        string? studentName,
        string? className,
        Guid? studentId = null,
        StudentRecordScope? scope = null,
        CancellationToken cancellationToken = default)
    {
        var rankingPool = await dbContext.ExamResults
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        IEnumerable<ExamResult> query = rankingPool;

        if (studentId is { } id)
        {
            // Kimlikle bağlı sonuçlar + henüz bağlanamamış (eski) sonuçlarda aynı ad.
            var profileName = await dbContext.Students.AsNoTracking()
                .Where(x => x.Id == id)
                .Select(x => x.FullName)
                .FirstOrDefaultAsync(cancellationToken);
            if (profileName is null) return [];
            var key = StudentIdentityResolver.NameKey(profileName);
            query = query.Where(x => x.StudentId == id || (x.StudentId == null && StudentIdentityResolver.NameKey(x.StudentName) == key));
        }
        else if (!string.IsNullOrWhiteSpace(studentName))
        {
            // Öğrenci/veli kapsamında ad birebir eşleşir. Eskiden "içeriyor" aranıyordu:
            // "Ali Kaya" adlı öğrenci "Ali Kayaoğlu"nun sonuçlarını da görüyordu.
            // Personelin arama kutusu için kısmi eşleşme korunur.
            var key = StudentIdentityResolver.NameKey(studentName);
            query = scope is null
                ? query.Where(x => StudentIdentityResolver.NameKey(x.StudentName).Contains(key, StringComparison.Ordinal))
                : query.Where(x => StudentIdentityResolver.NameKey(x.StudentName) == key);
        }

        if (scope is not null)
        {
            // Kimliğe bağlı sonuçta yalnız kimlik geçerlidir; aynı adlı başka ailenin
            // çocuğunun sonucu veliye görünmez. Bağlanmamış eski kayıtta ada düşülür.
            var allowedIds = scope.StudentIds.ToHashSet();
            var allowedNames = scope.StudentNames.Select(StudentIdentityResolver.NameKey).ToHashSet();
            query = query.Where(x => x.StudentId is { } linked
                ? allowedIds.Contains(linked)
                : allowedNames.Contains(StudentIdentityResolver.NameKey(x.StudentName)));
        }

        if (!string.IsNullOrWhiteSpace(className))
        {
            query = query.Where(x => string.Equals(x.ClassName, className, StringComparison.OrdinalIgnoreCase));
        }

        // DateLabel metindir ("05.11.2026", "13 Mart 2026"); metin sıralaması en yeni
        // sınavı başa getirmez (velinin "son sınav" kartı yanlış sınavı gösteriyordu).
        var results = query
            .OrderByDescending(x => AssistantDates.TryParse(x.DateLabel) ?? DateTime.MinValue)
            .ToList();

        return results.Select(result => ToExamResultDto(result, rankingPool)).ToList();
    }

    public async Task<ExamResultDto> CreateExamResultAsync(CreateExamResultRequest request, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeExamScoring(request.Score, request.Net, request.CorrectCount, request.WrongCount, request.TotalQuestions);
        var identity = (await StudentIdentityResolver.ResolveAsync(
                dbContext, [request], x => x.StudentId, x => x.StudentName, x => x.ClassName, cancellationToken))
            .Select(x => x.Identity)
            .FirstOrDefault();
        var result = new ExamResult
        {
            StudentId = identity?.StudentId,
            ExamTitle = request.ExamTitle.Trim(),
            Type = ParseExamType(request.Type),
            Subject = request.Subject.Trim(),
            DateLabel = string.IsNullOrWhiteSpace(request.DateLabel)
                ? DateTime.UtcNow.AddHours(3).ToString("dd MMMM yyyy")
                : request.DateLabel.Trim(),
            StudentName = identity?.Name ?? request.StudentName.Trim(),
            ClassName = request.ClassName.Trim(),
            Score = normalized.ScorePercent,
            Net = normalized.Net
        };

        await dbContext.ExamResults.AddAsync(result, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Sınav sonucu girilince veliye anlık bildirim. Kimlik biliniyorsa veli onunla
        // bulunur; aynı adlı başka öğrencinin velisine gitmez.
        await parentNotifier.NotifyStudentParentAsync(
            identity?.UserId,
            result.StudentName,
            "Sınav sonucu açıklandı",
            $"{result.ExamTitle}: {result.Score} puan / {result.Net} net",
            "ExamResult",
            null,
            cancellationToken);

        var rankingPool = await dbContext.ExamResults
            .AsNoTracking()
            .Where(item => item.Subject == result.Subject && item.ExamTitle == result.ExamTitle)
            .ToListAsync(cancellationToken);
        return ToExamResultDto(result, rankingPool);
    }

    /// <summary>
    /// Sonucu günceller. Puan/net yeniden normalize edilir; sınav künyesi
    /// (başlık/ders/sınıf/tarih) da düzeltilebilir — yanlış sınıfa veya yanlış
    /// başlıkla girilen sonuçlar silinip yeniden girilmek zorunda kalmasın.
    /// Tenant izolasyonu global query filter'dan gelir: başka kurumun kaydı
    /// zaten bulunamaz (null döner).
    /// </summary>
    public async Task<ExamResultDto?> UpdateExamResultAsync(
        Guid id,
        UpdateExamResultRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = await dbContext.ExamResults.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (result is null)
        {
            return null;
        }

        var normalized = NormalizeExamScoring(request.Score, request.Net, request.CorrectCount, request.WrongCount, request.TotalQuestions);
        var previousScore = result.Score;

        if (!string.IsNullOrWhiteSpace(request.ExamTitle)) result.ExamTitle = request.ExamTitle.Trim();
        if (!string.IsNullOrWhiteSpace(request.Subject)) result.Subject = request.Subject.Trim();
        if (!string.IsNullOrWhiteSpace(request.ClassName)) result.ClassName = request.ClassName.Trim();
        if (!string.IsNullOrWhiteSpace(request.DateLabel)) result.DateLabel = request.DateLabel.Trim();
        if (!string.IsNullOrWhiteSpace(request.Type)) result.Type = ParseExamType(request.Type);
        result.Score = normalized.ScorePercent;
        result.Net = normalized.Net;

        await dbContext.SaveChangesAsync(cancellationToken);

        // Not değiştiyse veli yeniden bilgilendirilir; aynı puan tekrar kaydedilince
        // gereksiz bildirim gitmez.
        if (previousScore != result.Score)
        {
            var studentUserId = result.StudentId is { } linkedId
                ? await dbContext.Students.AsNoTracking().Where(x => x.Id == linkedId).Select(x => (Guid?)x.UserId).FirstOrDefaultAsync(cancellationToken)
                : null;
            await parentNotifier.NotifyStudentParentAsync(
                studentUserId,
                result.StudentName,
                "Sınav sonucu güncellendi",
                $"{result.ExamTitle}: {result.Score} puan / {result.Net} net",
                "ExamResult",
                null,
                cancellationToken);
        }

        await auditLogService.LogAsync(
            "Sınav sonucu güncellendi",
            "Academic",
            nameof(ExamResult),
            result.Id.ToString(),
            $"{result.StudentName} · {result.ExamTitle} · {previousScore} → {result.Score}",
            cancellationToken);

        var rankingPool = await dbContext.ExamResults
            .AsNoTracking()
            .Where(item => item.Subject == result.Subject && item.ExamTitle == result.ExamTitle)
            .ToListAsync(cancellationToken);
        return ToExamResultDto(result, rankingPool);
    }

    public async Task<bool> DeleteExamResultAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var result = await dbContext.ExamResults.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (result is null)
        {
            return false;
        }

        dbContext.ExamResults.Remove(result);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            "Sınav sonucu silindi",
            "Academic",
            nameof(ExamResult),
            id.ToString(),
            $"{result.StudentName} · {result.ExamTitle} · {result.Score} puan",
            cancellationToken);
        return true;
    }

    private static ExamResultDto ToExamResultDto(ExamResult result, IReadOnlyList<ExamResult> scope)
    {
        var comparable = scope
            .Where(item => string.Equals(item.Subject, result.Subject, StringComparison.OrdinalIgnoreCase)
                           && string.Equals(item.ExamTitle, result.ExamTitle, StringComparison.OrdinalIgnoreCase))
            .ToList();
        var classRank = RankWithin(comparable.Where(item => string.Equals(item.ClassName, result.ClassName, StringComparison.OrdinalIgnoreCase)), result);
        var overallRank = RankWithin(comparable, result);

        return new ExamResultDto(
            result.Id,
            result.ExamTitle,
            result.Type.ToString(),
            result.Subject,
            result.DateLabel,
            result.StudentName,
            result.ClassName,
            Math.Clamp(result.Score, 0, 100),
            decimal.Round(result.Net, 2),
            Math.Clamp(result.Score, 0, 100),
            classRank,
            overallRank,
            result.StudentId);
    }

    private static int? RankWithin(IEnumerable<ExamResult> rows, ExamResult result)
    {
        var comparable = rows.ToList();
        if (comparable.All(item => item.Id != result.Id))
        {
            return null;
        }

        return 1 + comparable.Count(item =>
            item.Score > result.Score
            || (item.Score == result.Score && item.Net > result.Net));
    }

    private static (int ScorePercent, decimal Net) NormalizeExamScoring(
        int requestedScore,
        decimal requestedNet,
        int? correctCount,
        int? wrongCount,
        int? totalQuestions)
    {
        if (correctCount.HasValue && totalQuestions.GetValueOrDefault() > 0)
        {
            var total = Math.Max(1, totalQuestions!.Value);
            var correct = Math.Clamp(correctCount.Value, 0, total);
            var wrong = Math.Clamp(wrongCount.GetValueOrDefault(), 0, total - correct);
            var score = (int)Math.Round((decimal)correct / total * 100, MidpointRounding.AwayFromZero);
            var net = correct - wrong / 4m;
            return (Math.Clamp(score, 0, 100), decimal.Round(net, 2));
        }

        return (Math.Clamp(requestedScore, 0, 100), decimal.Round(requestedNet, 2));
    }

    public async Task<StudentCredentialsDto> CreateStudentAsync(
        CreateStudentRequest request,
        CancellationToken cancellationToken = default,
        bool requireTcNo = false,
        bool linkExistingParent = false,
        bool validateParentPhone = false)
    {
        var fullName = PersonNameFormatter.FormatFullName(request.FullName);
        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");
        var tcNo = SchoolRegistrationRules.NormalizeTcNo(request.TcNo, required: requireTcNo);
        SchoolRegistrationRules.ValidateBirthDate(request.BirthDate);
        var parentPhone = (request.ParentPhone ?? string.Empty).Trim();
        if (validateParentPhone && parentPhone.Length > 0 && !SchoolRegistrationRules.IsValidTrMobile(parentPhone))
        {
            throw new InvalidOperationException("Veli telefonu +90 5XX XXX XX XX biçiminde olmalıdır.");
        }
        await EnsureTcNoAvailableAsync(tenantId, tcNo, null, cancellationToken);

        // Zaten açık bir DIŞ transaction varsa (ör. sürücü kayıt sihirbazı kendi
        // Serializable transaction'ını açar) ONA katıl — EF/Npgsql iç içe transaction'a
        // izin vermez; yeni bir tane açmak "already in a transaction" hatasıyla kaydı
        // 500'e düşürürdü. Dış transaction'ı sahibi commit'ler; biz yalnız sahibiysek
        // (kendi açtıysak) commit ederiz.
        var ownsTransaction = dbContext.Database.CurrentTransaction is null;
        await using var transaction = ownsTransaction && dbContext.Database.IsRelational()
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;
        // Okul numarası üretimini seri hale getiren advisory kilit; aktif (yeni ya da
        // devralınan) transaction içinde alınır — xact-scoped, commit'te otomatik düşer.
        if (dbContext.Database.IsNpgsql() && dbContext.Database.CurrentTransaction is not null)
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtext({tenantId.ToString()}))",
                cancellationToken);
        }

        var schoolNumber = SchoolRegistrationRules.NextSchoolNumber(await dbContext.Students
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.SchoolNumber)
            .ToListAsync(cancellationToken));
        var username = await usernameGenerator.GenerateAsync(
            tenantId,
            fullName,
            new UsernameContext(Role: "Student", ClassName: request.ClassName),
            cancellationToken);
        var password = PasswordGenerator.Generate();

        var user = new AppUser
        {
            TenantId = tenantId,
            FullName = fullName,
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = UserRole.Student,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = request.ClassName,
            TcNo = tcNo,
            PhotoUrl = request.PhotoUrl?.Trim() ?? string.Empty,
            MustChangePassword = true
        };

        // Veli bilgileri girildiyse veli için de AppUser hazırla. Aynı telefonlu veli zaten
        // varsa (kardeş kaydı) yeni hesap açmak yerine mevcut veliye bağlanır — böylece bir
        // veliye ikinci bir giriş/parola üretilmez.
        AppUser? parentUser = null;
        string? parentPlainPassword = null;
        var parentIsExisting = false;
        var parentName = PersonNameFormatter.FormatFullName(request.ParentName);
        if (!string.IsNullOrWhiteSpace(parentName))
        {
            if (linkExistingParent && parentPhone.Length > 0)
            {
                var phoneKey = SchoolRegistrationRules.NormalizePhone(parentPhone);
                var candidates = await dbContext.Users
                    .Where(x => x.TenantId == tenantId
                        && x.PrimaryRole == UserRole.Parent
                        && x.Phone != null && x.Phone != string.Empty)
                    .ToListAsync(cancellationToken);
                parentUser = candidates.FirstOrDefault(x => SchoolRegistrationRules.NormalizePhone(x.Phone) == phoneKey);
            }

            if (parentUser is not null)
            {
                parentIsExisting = true;
            }
            else
            {
                var parentUsername = await usernameGenerator.GenerateAsync(
                    tenantId,
                    parentName,
                    new UsernameContext(Role: "Parent", StudentClassName: request.ClassName),
                    cancellationToken);
                parentPlainPassword = PasswordGenerator.Generate();
                parentUser = new AppUser
                {
                    TenantId = tenantId,
                    FullName = parentName,
                    Username = parentUsername,
                    PasswordHash = passwordHasher.Hash(parentPlainPassword),
                    PrimaryRole = UserRole.Parent,
                    Campus = "Merkez Kampus",
                    DepartmentOrBranch = string.Empty,
                    Phone = parentPhone,
                    MustChangePassword = true
                };
            }
        }

        var student = new StudentProfile
        {
            TenantId = user.TenantId,
            UserId = user.Id,
            FullName = fullName,
            TcNo = tcNo,
            ClassName = request.ClassName,
            CurrentSchool = request.CurrentSchool,
            SchoolNumber = schoolNumber,
            BirthDate = request.BirthDate,
            ProgramType = request.ProgramType,
            ParentName = parentName,
            ParentPhone = request.ParentPhone ?? string.Empty,
            ParentEmail = request.ParentEmail,
            ParentUserId = parentUser?.Id,
            Address = request.Address,
            Note = request.Note,
            PhotoUrl = request.PhotoUrl?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        if (parentUser is not null && !parentIsExisting)
        {
            await dbContext.Users.AddAsync(parentUser, cancellationToken);
        }
        await dbContext.Students.AddAsync(student, cancellationToken);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        catch (DbUpdateException)
        {
            throw new InvalidOperationException("TC kimlik numarası veya okul numarası bu kurumda zaten kullanılıyor.");
        }

        ParentCredentialsDto? parentCreds = null;
        if (parentUser is not null && parentPlainPassword is not null)
        {
            parentCreds = new ParentCredentialsDto(
                parentUser.Id,
                parentUser.FullName,
                parentUser.Username,
                parentPlainPassword);
        }

        await auditLogService.LogAsync(
            "Öğrenci kaydedildi",
            "Registration",
            "StudentProfile",
            student.Id.ToString(),
            $"{student.FullName} ({user.Username}) — sınıf: {student.ClassName}{(parentUser is null ? string.Empty : parentIsExisting ? $"; mevcut veliye bağlandı: {parentUser.FullName} ({parentUser.Username})" : $"; veli hesabı da açıldı: {parentUser.FullName} ({parentUser.Username})")}.",
            cancellationToken);

        return new StudentCredentialsDto(user.Id, user.FullName, user.Username, password, student.ClassName, parentCreds);
    }

    public async Task<StudentSummaryDto?> UpdateStudentAsync(Guid studentId, UpdateStudentRequest request, CancellationToken cancellationToken = default)
    {
        var student = await dbContext.Students.FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken);
        if (student is null) return null;

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == student.UserId, cancellationToken);
        if (user is null) return null;

        var currentTenantId = ResolveCurrentTenantId();
        if (currentTenantId.HasValue && user.TenantId != currentTenantId.Value) return null;

        var tcNo = SchoolRegistrationRules.NormalizeTcNo(request.TcNo);
        SchoolRegistrationRules.ValidateBirthDate(request.BirthDate);
        var parentPhone = (request.ParentPhone ?? string.Empty).Trim();
        if (parentPhone.Length > 0 && !SchoolRegistrationRules.IsValidTrMobile(parentPhone))
        {
            throw new InvalidOperationException("Veli telefonu +90 5XX XXX XX XX biçiminde olmalıdır.");
        }
        await EnsureTcNoAvailableAsync(user.TenantId, tcNo, user.Id, cancellationToken);

        var fullName = PersonNameFormatter.FormatFullName(request.FullName);
        var previousName = student.FullName;
        var before = StudentAuditSnapshot(student);
        student.FullName = fullName;
        student.TcNo = tcNo;
        student.ClassName = request.ClassName;
        student.CurrentSchool = request.CurrentSchool;
        // Okul numarası kayıt anında kurum bazında üretilir ve sonradan değiştirilemez.
        student.BirthDate = request.BirthDate;
        student.ProgramType = request.ProgramType;
        student.ParentName = PersonNameFormatter.FormatFullName(request.ParentName);
        student.ParentPhone = parentPhone;
        student.ParentEmail = request.ParentEmail;
        student.Address = request.Address;
        student.Note = request.Note;
        // PhotoUrl null gelirse mevcut foto korunur (kısmi güncelleme); '' gelirse temizlenir.
        if (request.PhotoUrl is not null) student.PhotoUrl = request.PhotoUrl.Trim();

        user.FullName = fullName;
        user.DepartmentOrBranch = request.ClassName;
        user.TcNo = tcNo;
        if (request.PhotoUrl is not null) user.PhotoUrl = request.PhotoUrl.Trim();

        // Çalışma programı öğrenci adıyla tutulur; ad düzeltilince program, XP ve seri yeni ada taşınır.
        // Yeni adda zaten bir program varsa (aynı adlı başka öğrenci olabilir) birleştirilmez, olduğu gibi bırakılır.
        var planNote = await MoveStudyPlanAsync(student.UserId, fullName, cancellationToken);

        // Kimliğe bağlı yoklama ve sınav sonuçları yeni adı gösterir (bağ kimlikte, ad görüntü içindir).
        if (!string.Equals(previousName, student.FullName, StringComparison.Ordinal))
        {
            var linkedAttendance = await dbContext.AttendanceEntries
                .Where(x => x.StudentId == student.Id)
                .ToListAsync(cancellationToken);
            foreach (var entry in linkedAttendance)
            {
                entry.StudentName = student.FullName;
            }

            var linkedResults = await dbContext.ExamResults
                .Where(x => x.StudentId == student.Id)
                .ToListAsync(cancellationToken);
            foreach (var linkedResult in linkedResults)
            {
                linkedResult.StudentName = student.FullName;
            }
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new InvalidOperationException("Bu TC kimlik numarasıyla kurumda daha önce kayıt oluşturulmuş.");
        }

        var after = StudentAuditSnapshot(student);
        var changed = before.Where(pair => !string.Equals(pair.Value, after[pair.Key], StringComparison.Ordinal)).Select(pair => pair.Key).ToList();
        if (changed.Count > 0)
        {
            await auditLogService.LogChangeAsync(
                "Öğrenci bilgileri güncellendi",
                "Registration",
                "StudentProfile",
                student.Id.ToString(),
                $"{student.FullName}: {string.Join("; ", changed.Select(key => key == "Fotoğraf" ? "fotoğraf değişti" : $"{key}: {Short(before[key])} → {Short(after[key])}"))}.{planNote}",
                changed.ToDictionary(key => key, key => before[key]),
                changed.ToDictionary(key => key, key => after[key]),
                cancellationToken);
        }

        return new StudentSummaryDto(
            student.Id,
            student.UserId,
            student.FullName,
            student.TcNo,
            student.ClassName,
            student.CurrentSchool,
            student.SchoolNumber,
            student.BirthDate,
            student.ProgramType,
            student.ParentName,
            student.ParentPhone,
            student.ParentEmail,
            student.Address,
            student.Note,
            student.PhotoUrl,
            user.Username,
            user.Status.ToString(),
            user.LastLoginAtUtc,
            user.ExtraRoles.Select(r => r.ToString()).ToList());
    }

    /// <summary>
    /// Değişiklik kaydının alanları (eski/yeni değer). TC kimlik maskelenir, fotoğraf yalnız
    /// değişti/değişmedi olarak izlenir; kayıt geçmişini gören herkes tam kimliği görmesin.
    /// </summary>
    private static Dictionary<string, string> StudentAuditSnapshot(StudentProfile student) => new()
    {
        ["Ad soyad"] = student.FullName,
        ["TC kimlik"] = MaskTcNo(student.TcNo),
        ["Sınıf"] = student.ClassName,
        ["Mevcut okul"] = student.CurrentSchool,
        ["Doğum tarihi"] = student.BirthDate,
        ["Eğitim seviyesi"] = student.ProgramType,
        ["Veli adı"] = student.ParentName,
        ["Veli telefonu"] = student.ParentPhone,
        ["Veli e-postası"] = student.ParentEmail,
        ["Adres"] = student.Address,
        ["Not"] = student.Note,
        ["Fotoğraf"] = string.IsNullOrWhiteSpace(student.PhotoUrl) ? "yok" : $"var ({Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(student.PhotoUrl)))[..8].ToLowerInvariant()})",
    };

    private static string Short(string? value)
    {
        var text = (value ?? string.Empty).Trim();
        if (text.Length == 0) return "(boş)";
        return text.Length <= 40 ? text : $"{text[..40]}…";
    }

    private static string MaskTcNo(string? tcNo) =>
        string.IsNullOrEmpty(tcNo) || tcNo.Length < 5 ? tcNo ?? string.Empty : $"{tcNo[..3]}{new string('*', tcNo.Length - 5)}{tcNo[^2..]}";

    /// <summary>
    /// Ad değişince çalışma programının gösterim adı güncellenir. Program öğrenci kimliğiyle bulunduğu için
    /// taşımaya gerek yoktur; kimliği henüz bağlanmamış eski kayıtlar adla eşlenmez (yanlış öğrenciye geçmesin).
    /// </summary>
    private async Task<string> MoveStudyPlanAsync(Guid studentUserId, string newName, CancellationToken cancellationToken)
    {
        var plan = await dbContext.StudyPlanStates.FirstOrDefaultAsync(x => x.StudentUserId == studentUserId, cancellationToken);
        if (plan is null || plan.StudentName == newName.Trim()) return string.Empty;
        plan.StudentName = newName.Trim();
        return string.Empty;
    }

    /// <summary>
    /// Dönem sonu sınıf yükseltme: seçili öğrenciler tek işlemde hedef sınıfa taşınır.
    ///
    /// Öğrenci kaydı ile kullanıcı kaydındaki sınıf bilgisi (DepartmentOrBranch)
    /// birlikte güncellenir — ikisi ayrışırsa menü/rapor filtreleri şaşar. Tenant
    /// ve şube izolasyonu global query filter'dan gelir: şube müdürü yalnız kendi
    /// şubesindeki öğrenciyi taşıyabilir, diğerleri "bulunamadı" döner.
    /// </summary>
    public async Task<PromoteStudentsResult> PromoteStudentsAsync(
        PromoteStudentsRequest request,
        CancellationToken cancellationToken = default)
    {
        var targetClass = (request.TargetClassName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(targetClass))
        {
            throw new InvalidOperationException("Hedef sınıf boş olamaz.");
        }

        var requestedIds = (request.StudentUserIds ?? []).Distinct().ToList();
        if (requestedIds.Count == 0)
        {
            throw new InvalidOperationException("En az bir öğrenci seçilmelidir.");
        }

        var students = await dbContext.Students
            .Where(x => requestedIds.Contains(x.UserId))
            .ToListAsync(cancellationToken);
        var users = await dbContext.Users
            .Where(x => requestedIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var promoted = new List<(string Name, string From)>();
        var alreadyInClass = new List<string>();
        foreach (var student in students)
        {
            if (string.Equals(student.ClassName?.Trim(), targetClass, StringComparison.OrdinalIgnoreCase))
            {
                alreadyInClass.Add(student.FullName);
                continue;
            }

            promoted.Add((student.FullName, string.IsNullOrWhiteSpace(student.ClassName) ? "—" : student.ClassName));
            student.ClassName = targetClass;
            if (users.TryGetValue(student.UserId, out var user))
            {
                user.DepartmentOrBranch = targetClass;
            }
        }

        if (promoted.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await auditLogService.LogAsync(
                "Sınıf yükseltme",
                "Registration",
                nameof(StudentProfile),
                targetClass,
                $"{promoted.Count} öğrenci {targetClass} sınıfına taşındı: "
                    + string.Join(", ", promoted.Take(20).Select(x => $"{x.Name} ({x.From}→{targetClass})")),
                cancellationToken);
        }

        var foundUserIds = students.Select(x => x.UserId).ToHashSet();
        return new PromoteStudentsResult(
            promoted.Count,
            alreadyInClass,
            requestedIds.Where(id => !foundUserIds.Contains(id)).ToList());
    }

    private async Task EnsureTcNoAvailableAsync(Guid? tenantId, string tcNo, Guid? excludedUserId, CancellationToken cancellationToken)
    {
        if (!tenantId.HasValue || string.IsNullOrEmpty(tcNo)) return;

        var usedByUser = await dbContext.Users.IgnoreQueryFilters().AnyAsync(
            x => x.TenantId == tenantId && x.TcNo == tcNo && (!excludedUserId.HasValue || x.Id != excludedUserId.Value),
            cancellationToken);
        if (usedByUser)
        {
            throw new InvalidOperationException("Bu TC kimlik numarasıyla kurumda daha önce kayıt oluşturulmuş.");
        }

        var usedByStudent = await dbContext.Students.IgnoreQueryFilters().AnyAsync(
            x => x.TenantId == tenantId && x.TcNo == tcNo && (!excludedUserId.HasValue || x.UserId != excludedUserId.Value),
            cancellationToken);
        var usedByStaff = await dbContext.Staff.IgnoreQueryFilters().AnyAsync(
            x => x.TenantId == tenantId && x.TcNo == tcNo && (!excludedUserId.HasValue || x.UserId != excludedUserId.Value),
            cancellationToken);
        if (usedByStudent || usedByStaff)
        {
            throw new InvalidOperationException("Bu TC kimlik numarasıyla kurumda daha önce kayıt oluşturulmuş.");
        }
    }

    public async Task<bool> DeleteStudentAsync(Guid studentId, CancellationToken cancellationToken = default)
    {
        var student = await dbContext.Students.FirstOrDefaultAsync(x => x.Id == studentId, cancellationToken);
        if (student is null) return false;

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == student.UserId, cancellationToken);
        if (user is null) return false;

        var currentTenantId = ResolveCurrentTenantId();
        if (currentTenantId.HasValue && user.TenantId != currentTenantId.Value) return false;

        dbContext.Students.Remove(student);
        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            "Öğrenci silindi",
            "Registration",
            "StudentProfile",
            student.Id.ToString(),
            $"{student.FullName} ({user.Username}) — sınıf: {student.ClassName} kaydı kalıcı olarak silindi.",
            cancellationToken);
        return true;
    }

    public async Task<ParentCredentialsDto> CreateParentAsync(CreateParentRequest request, CancellationToken cancellationToken = default)
    {
        var tenantId = ResolveCurrentTenantId()
            ?? throw new InvalidOperationException("Kurum baglami bulunamadi.");
        var username = await usernameGenerator.GenerateAsync(
            tenantId,
            request.FullName,
            new UsernameContext(Role: "Parent"),
            cancellationToken);
        var password = PasswordGenerator.Generate();

        var user = new AppUser
        {
            TenantId = tenantId,
            FullName = request.FullName.Trim(),
            Username = username,
            PasswordHash = passwordHasher.Hash(password),
            PrimaryRole = UserRole.Parent,
            Campus = "Merkez Kampus",
            DepartmentOrBranch = string.Empty,
            MustChangePassword = true
        };

        await dbContext.Users.AddAsync(user, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            "Veli hesabı oluşturuldu",
            "Registration",
            "AppUser",
            user.Id.ToString(),
            $"{user.FullName} ({user.Username}) veli hesabı açıldı.",
            cancellationToken);

        return new ParentCredentialsDto(user.Id, user.FullName, user.Username, password);
    }

    public async Task<IReadOnlyList<ParentAccountDto>> GetParentAccountsAsync(CancellationToken cancellationToken = default)
    {
        var currentTenantId = ResolveCurrentTenantId();
        // Pasif veliler yalnız "Pasif Kayıtlar" ekranında görünür; ana veli listesi aktifler.
        var usersQuery = dbContext.Users.AsNoTracking()
            .Where(x => x.PrimaryRole == UserRole.Parent && x.Status != UserStatus.Passive);
        if (currentTenantId.HasValue)
        {
            usersQuery = usersQuery.Where(x => x.TenantId == currentTenantId.Value);
        }

        var parents = await usersQuery.OrderBy(x => x.FullName).ToListAsync(cancellationToken);
        if (parents.Count == 0) return [];

        // Bağlı öğrenciler: öncelik ParentUserId; eski kayıtlar için veli adı eşleşmesi (fallback).
        var studentsQuery = dbContext.Students.AsNoTracking().AsQueryable();
        if (currentTenantId.HasValue)
        {
            studentsQuery = studentsQuery.Where(x => x.TenantId == currentTenantId.Value);
        }
        var students = await studentsQuery
            .Select(x => new { x.FullName, x.ClassName, x.ParentUserId, x.ParentName })
            .ToListAsync(cancellationToken);

        var byParentId = students
            .Where(x => x.ParentUserId.HasValue)
            .ToLookup(x => x.ParentUserId!.Value);
        var byParentName = students
            .Where(x => !x.ParentUserId.HasValue && !string.IsNullOrWhiteSpace(x.ParentName))
            .ToLookup(x => x.ParentName.Trim().ToLowerInvariant());

        return parents
            .Select(parent =>
            {
                var linked = byParentId[parent.Id]
                    .Concat(byParentName[parent.FullName.Trim().ToLowerInvariant()])
                    .Select(x => string.IsNullOrWhiteSpace(x.ClassName) ? x.FullName : $"{x.FullName} ({x.ClassName})")
                    .Distinct()
                    .ToList();
                return new ParentAccountDto(
                    parent.Id,
                    parent.FullName,
                    parent.Username,
                    parent.Phone ?? string.Empty,
                    parent.Status.ToString(),
                    parent.LastLoginAtUtc,
                    linked);
            })
            .ToList();
    }

    private async Task<string> GenerateUniqueUsernameAsync(string fullName, string className, CancellationToken cancellationToken)
    {
        var normalized = Normalize(fullName);
        var normalizedClass = Normalize(className).Replace(" ", string.Empty);
        var random = new Random();
        var username = $"{normalized[..Math.Min(normalized.Length, 8)]}{normalizedClass}{random.Next(100, 999)}";

        while (await dbContext.Users.AnyAsync(x => x.Username == username, cancellationToken))
        {
            username = $"{normalized[..Math.Min(normalized.Length, 8)]}{normalizedClass}{random.Next(100, 999)}";
        }

        return username;
    }

    private static string GeneratePassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 8).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    private static string Normalize(string value)
    {
        return value.ToLowerInvariant()
            .Replace("ç", "c")
            .Replace("ğ", "g")
            .Replace("ı", "i")
            .Replace("ö", "o")
            .Replace("ş", "s")
            .Replace("ü", "u")
            .Replace(" ", string.Empty);
    }

    private static ExamType ParseExamType(string type)
    {
        return type.Trim() switch
        {
            "Deneme" or "MockExam" => ExamType.MockExam,
            "Yazili" or "Yazılı" or "Written" => ExamType.Written,
            "Sozlu" or "Sözlü" or "Oral" => ExamType.Oral,
            "Quiz" => ExamType.Quiz,
            _ => ExamType.Written
        };
    }

    private Guid? ResolveCurrentTenantId() => tenantContext.CurrentTenantId;
}
