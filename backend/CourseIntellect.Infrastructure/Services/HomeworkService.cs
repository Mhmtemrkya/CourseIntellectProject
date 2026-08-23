using Hangfire;
using System.Text.Json;
using CourseIntellect.Application.DTOs.Homework;
using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class HomeworkService(
    CourseIntellectDbContext dbContext,
    Hangfire.IBackgroundJobClient backgroundJobClient) : IHomeworkService
{
    /// <summary>
    /// Ödev kartlarını ve GÖRÜLMESİNE İZİN VERİLEN teslimleri döner.
    ///
    /// Eskiden her kimlik doğrulanmış kullanıcıya tüm öğrencilerin teslim notları
    /// ve dosya URL'leri gidiyordu; bir öğrenci sınıf arkadaşlarının ödevlerini
    /// okuyabiliyordu. Artık öğrenci yalnız kendi teslimini görür, teslimlerin
    /// tamamını yalnız öğretmen/yönetim görür.
    ///
    /// Teslim SAYISI (submitted/total) herkese açık kalır — ilerleme göstergesi
    /// kişisel veri değildir ve arayüz buna dayanır.
    /// </summary>
    public async Task<IReadOnlyList<HomeworkAssignmentDto>> GetAssignmentsAsync(
        string requestorRole,
        string requestorName,
        CancellationToken cancellationToken = default)
    {
        var assignments = await dbContext.Set<HomeworkAssignment>()
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        var ids = assignments.Select(x => x.Id).ToList();
        var submissions = await dbContext.Set<HomeworkSubmission>()
            .Where(x => ids.Contains(x.AssignmentId))
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        var seesEverySubmission = IsStaff(requestorRole);
        var ownName = requestorName.Trim();

        return assignments
            .Select(item =>
            {
                var all = submissions.Where(x => x.AssignmentId == item.Id).ToList();
                var visible = seesEverySubmission
                    ? all
                    : all.Where(x => !string.IsNullOrWhiteSpace(ownName)
                        && string.Equals(x.StudentName.Trim(), ownName, StringComparison.OrdinalIgnoreCase)).ToList();
                // Sayaç gerçek toplamdan gelir; görünen liste daraltılmış olabilir.
                return ToDto(item, visible, all.Count);
            })
            .ToList();
    }

    /// <summary>Teslimlerin tamamını görebilen roller. Tanınmayan rol göremez (fail-closed).</summary>
    private static bool IsStaff(string role)
    {
        var normalized = role.Trim();
        return normalized.Equals("Teacher", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("Admin", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("Administrative", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("InstitutionAdmin", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("Idare", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("Developer", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<HomeworkAssignmentDto> CreateAssignmentAsync(CreateHomeworkAssignmentRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new HomeworkAssignment
        {
            Title = request.Title.Trim(),
            ClassName = request.ClassName.Trim(),
            Subject = string.IsNullOrWhiteSpace(request.Subject) ? "Matematik" : request.Subject.Trim(),
            Teacher = string.IsNullOrWhiteSpace(request.Teacher) ? "Hasan Yildiz" : request.Teacher.Trim(),
            DeadlineLabel = request.Deadline.Trim(),
            Description = request.Description.Trim(),
            MaterialsSerialized = JsonSerializer.Serialize((request.Materials ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).ToList()),
            CreatedAtLabel = BuildDateLabel(),
        };

        await dbContext.Set<HomeworkAssignment>().AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Ağır bildirim fan-out'u (sınıftaki tüm öğrenciler + velileri) istek yolunu
        // bloklamasın diye Hangfire kuyruğuna atılır. Tenant HTTP bağlamından alınıp
        // işe argüman olarak geçilir (kuyruk işinde HttpContext olmayacak).
        if (dbContext.CurrentTenantId is Guid tenantId)
        {
            backgroundJobClient.Enqueue<INotificationFanoutJobService>(
                x => x.HomeworkAssignedAsync(tenantId, entity.Id, CancellationToken.None));
        }

        return ToDto(entity, []);
    }

    public async Task<bool> DeleteAssignmentAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<HomeworkAssignment>().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return false;

        var submissions = await dbContext.Set<HomeworkSubmission>().Where(x => x.AssignmentId == id).ToListAsync(cancellationToken);
        dbContext.Set<HomeworkSubmission>().RemoveRange(submissions);
        dbContext.Set<HomeworkAssignment>().Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<HomeworkAssignmentDto?> SubmitAssignmentAsync(
        Guid id,
        string requestorRole,
        string requestorName,
        CreateHomeworkSubmissionRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<HomeworkAssignment>().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return null;

        // TESLİM SAHİPLİĞİ: öğrencinin teslimi DAİMA kendi adına yazılır. Gövdedeki
        // StudentName yok sayılır — eskiden bu alan serbest olduğu için bir öğrenci
        // başka bir öğrencinin adına teslim oluşturabiliyor ya da onun teslimini
        // (aynı ad + assignment eşleşmesiyle) üzerine yazabiliyordu.
        // Öğretmen/yönetim, öğrenci adına teslim girebilir (kâğıt teslim kaydı).
        var isStaff = IsStaff(requestorRole);
        var studentName = (isStaff ? request.StudentName : requestorName).Trim();
        if (string.IsNullOrWhiteSpace(studentName))
        {
            throw new InvalidOperationException("Teslim için öğrenci adı belirlenemedi.");
        }

        var existing = await dbContext.Set<HomeworkSubmission>()
            .FirstOrDefaultAsync(x => x.AssignmentId == id && x.StudentName == studentName, cancellationToken);

        if (existing is null)
        {
            existing = new HomeworkSubmission
            {
                TenantId = entity.TenantId,
                AssignmentId = id,
                StudentName = studentName,
            };
            await dbContext.Set<HomeworkSubmission>().AddAsync(existing, cancellationToken);
        }

        existing.Note = request.Note.Trim();
        existing.FilesSerialized = JsonSerializer.Serialize((request.Files ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).ToList());
        existing.SubmittedAtLabel = BuildDateLabel();
        await dbContext.SaveChangesAsync(cancellationToken);

        var allSubmissions = await dbContext.Set<HomeworkSubmission>()
            .Where(x => x.AssignmentId == id)
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        // Dönüş de listeleme ile aynı görünürlük kuralına uyar: öğrenci yalnız
        // kendi teslimini geri alır, başkalarınınkini değil.
        var visible = isStaff
            ? allSubmissions
            : allSubmissions.Where(x => string.Equals(x.StudentName.Trim(), studentName, StringComparison.OrdinalIgnoreCase)).ToList();
        return ToDto(entity, visible, allSubmissions.Count);
    }

    /// <param name="visibleSubmissions">Çağıranın görmeye YETKİLİ olduğu teslimler.</param>
    /// <param name="submittedCount">
    /// Gerçek teslim sayısı. Görünen liste daraltılmış olabileceği için sayaç ayrı
    /// geçirilir; aksi hâlde öğrencide ilerleme "1/30" yerine hep "1/30" görünürdü.
    /// Verilmezse görünen liste sayılır (öğretmen/yönetim yolu).
    /// </param>
    private static HomeworkAssignmentDto ToDto(
        HomeworkAssignment entity,
        IReadOnlyList<HomeworkSubmission> visibleSubmissions,
        int? submittedCount = null)
    {
        var submissionDtos = visibleSubmissions
            .Select(x => new HomeworkSubmissionDto(
                x.Id,
                x.StudentName,
                x.Note,
                DeserializeStrings(x.FilesSerialized),
                x.SubmittedAtLabel))
            .ToList();

        var submitted = submittedCount ?? submissionDtos.Count;
        var total = entity.TotalStudents;
        var status = submitted == 0 ? "Yeni" : submitted >= total ? "Tamamlandi" : "Devam Ediyor";

        return new HomeworkAssignmentDto(
            entity.Id,
            entity.Title,
            entity.ClassName,
            entity.Subject,
            entity.Teacher,
            entity.DeadlineLabel,
            entity.Description,
            DeserializeStrings(entity.MaterialsSerialized),
            submitted,
            total,
            status,
            entity.CreatedAtLabel,
            submissionDtos);
    }

    private static IReadOnlyList<string> DeserializeStrings(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? []
            : JsonSerializer.Deserialize<List<string>>(value) ?? [];

    private static string BuildDateLabel()
    {
        var now = DateTime.Now;
        var month = now.Month switch
        {
            1 => "Ocak",
            2 => "Subat",
            3 => "Mart",
            4 => "Nisan",
            5 => "Mayis",
            6 => "Haziran",
            7 => "Temmuz",
            8 => "Agustos",
            9 => "Eylul",
            10 => "Ekim",
            11 => "Kasim",
            _ => "Aralik"
        };
        return $"{now.Day} {month} {now.Year}";
    }
}
