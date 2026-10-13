using System.Linq.Expressions;
using System.Reflection;
using System.Text.RegularExpressions;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Finds direct and dependent personal records using IDs; never matches another tenant.</summary>
internal static class DeletionDataCleaner
{
    private static readonly HashSet<string> SubjectIds = ["UserId", "StudentUserId", "StaffUserId", "StaffId", "StudentId", "StudentProfileId", "StudentDrivingProfileId", "SenderUserId", "TargetUserId", "SelectedStudentId", "TargetStudentId", "ConversationId", "ExamSessionId", "QuestionAttemptId", "DriverId", "InstructorProfileId", "MatchedStudentProfileId", "TeacherPreviewUserId", "TripId"];
    private static readonly HashSet<string> ReferenceIds = ["CreatedByUserId", "UpdatedByUserId", "TeacherUserId", "ActorUserId", "DecidedByUserId", "ReviewedByUserId", "RequesterUserId", "AssignedToUserId", "OwnerUserId", "ManagerUserId", "UploadedByUserId", "ChangedByUserId", "LastChangedByUserId", "RequestedByUserId", "CompletedByUserId", "ApprovedByUserId", "RegisteredByUserId"];
    private static readonly HashSet<string> StructuralStrings = ["Status", "Currency", "ReceiptNo", "InvoiceNumber", "Method", "EntryType", "RefundType", "RefundStatus", "Role", "PrimaryRole", "SourceType", "SourceKind", "ContextKind", "ContextKey", "Action", "Category", "EntityType", "EntityId", "ActorRole", "ClassName", "AcademicYear", "Subject", "Lesson", "StartTime", "EndTime", "Day", "DutyType", "Location", "Platform", "ConsentVersion", "Amount", "PaymentMethod"];
    private static readonly HashSet<Type> ManagedSeparately = [typeof(AppUser), typeof(StudentProfile), typeof(StaffProfile), typeof(AccountDeletionRequest), typeof(InstitutionDeletionRequest), typeof(DeletionFileTask), typeof(TenantWorkspace), typeof(TenantGroup)];
    private static readonly Regex UploadPattern = new(@"(?:https?://[^\s\""<>]+)?/uploads/[^\s\""<>\\]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    internal static IEnumerable<string> Uploads(object row)
    {
        foreach (var property in row.GetType().GetProperties().Where(x => x.PropertyType == typeof(string)))
            if (property.GetValue(row) is string text)
                foreach (Match match in UploadPattern.Matches(text.Replace("\\/", "/")))
                    yield return CanonicalUrl(match.Value);
    }

    internal static string CanonicalUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri.AbsolutePath : url;

    internal static async Task<HashSet<string>> CleanAsync(CourseIntellectDbContext db, Guid tenantId, Guid? userId, CancellationToken ct, HashSet<Type>? retainedTypes = null)
    {
        var files = new HashSet<string>(StringComparer.Ordinal);
        var relatedIds = new HashSet<Guid>();
        if (userId is Guid id)
        {
            relatedIds.Add(id);
            relatedIds.UnionWith(await db.Students.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.UserId == id).Select(x => x.Id).ToListAsync(ct));
            relatedIds.UnionWith(await db.Staff.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.UserId == id).Select(x => x.Id).ToListAsync(ct));
        }
        else relatedIds.UnionWith(await db.Users.IgnoreQueryFilters().Where(x => x.TenantId == tenantId).Select(x => x.Id).ToListAsync(ct));
        var models = db.Model.GetEntityTypes().Where(x => x.GetTableName() != null && !ManagedSeparately.Contains(x.ClrType)).ToList();
        var processed = new HashSet<(Type, Guid, bool)>();
        // Expand dependent IDs until no new owned record is found (exam -> attempt -> canvas/report,
        // student -> driving profile -> documents, assistant -> messages, driver -> GPS history).
        bool changed;
        do
        {
            changed = false;
            foreach (var model in models)
            {
                var rows = await QueryRows(db, model.ClrType, tenantId, userId == null, relatedIds, ct);
                foreach (var row in rows)
                {
                    var properties = model.GetProperties().Where(x => x.PropertyInfo != null).Select(x => x.PropertyInfo!).ToArray();
                    var rowId = properties.FirstOrDefault(x => x.Name == "Id")?.GetValue(row) as Guid?;
                    var owned = userId == null || properties.Any(p => SubjectIds.Contains(p.Name) && p.GetValue(row) is Guid value && relatedIds.Contains(value));
                    if (rowId == null || !processed.Add((model.ClrType, rowId.Value, owned))) continue;
                    if (owned)
                    {
                        if (relatedIds.Add(rowId.Value)) changed = true;
                        files.UnionWith(Uploads(row));
                        if (retainedTypes != null && !retainedTypes.Contains(model.ClrType)) continue;
                        foreach (var property in properties.Where(x => x.PropertyType == typeof(string) && !StructuralStrings.Contains(x.Name)))
                            property.SetValue(row, EmptyValue(property.Name));
                        if (row is ServiceDriver driver) driver.IsActive = false;
                        if (row is ServiceVehicleLocation gps) { gps.Latitude = 0; gps.Longitude = 0; gps.Speed = null; gps.Heading = null; }
                        if (row is StudentQuestionThread question)
                        {
                            var replies = await db.StudentQuestionReplies.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.ThreadId == question.Id).ToListAsync(ct);
                            foreach (var reply in replies) { files.UnionWith(Uploads(reply)); reply.MessageText = ""; reply.AttachmentsSerialized = "[]"; }
                        }
                    }
                    else
                    {
                        // Authorship/management of a shared record is not ownership of other people's data.
                        foreach (var reference in properties.Where(p => ReferenceIds.Contains(p.Name) && p.GetValue(row) is Guid value && relatedIds.Contains(value)))
                        {
                            var prefix = reference.Name.Replace("UserId", "");
                            foreach (var p in properties.Where(p => p.PropertyType == typeof(string) && (p.Name == prefix + "Name" || p.Name == prefix + "Username")))
                                p.SetValue(row, EmptyValue(p.Name));
                        }
                        if (row is AuditLogEntry audit) { audit.ActorName = AccountLifecycleService.Tombstone; audit.Detail = ""; audit.BeforeValue = null; audit.AfterValue = null; audit.IpAddress = null; audit.UserAgent = null; }
                        if (row is TeacherReviewComment review) review.Comment = "";
                        if (row is TeacherDuty duty) { duty.TeacherUsername = ""; duty.TeacherBranch = ""; duty.Description = ""; }
                    }
                }
            }
        } while (changed);
        return files;
    }

    internal static async Task<HashSet<string>> CleanLegacyAsync(CourseIntellectDbContext db, Guid tenantId, Guid userId, CancellationToken ct)
    {
        var user = await db.Users.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == userId && x.TenantId == tenantId, ct);
        var profiles = await db.Students.IgnoreQueryFilters().AsNoTracking().Where(x => x.TenantId == tenantId && x.UserId == userId).ToListAsync(ct);
        var student = user.PrimaryRole == CourseIntellect.Domain.Enums.UserRole.Student || profiles.Count > 0;
        var parent = user.PrimaryRole == CourseIntellect.Domain.Enums.UserRole.Parent;
        var nameFields = new HashSet<string> { "RequesterName", "RequestedBy", "Counterparty" };
        if (student) { nameFields.Add("StudentName"); nameFields.Add("FullName"); }
        if (parent) nameFields.Add("ParentName");
        if (!student && !parent) { nameFields.UnionWith(["TeacherName", "Teacher", "CounselorName", "Advisor", "IssuedBy", "CreatedByName", "ChangedByName"]); }
        var files = new HashSet<string>();
        foreach (var model in db.Model.GetEntityTypes().Where(x => x.GetTableName() != null && typeof(ITenantScopedEntity).IsAssignableFrom(x.ClrType) && !ManagedSeparately.Contains(x.ClrType)))
        {
            // Legacy identity fields are evaluated on a tenant-scoped snapshot before identifiers are removed.
            var rows = await QueryRows(db, model.ClrType, tenantId, true, [], ct);
            foreach (var row in rows)
            {
                var properties = model.GetProperties().Where(x => x.PropertyInfo != null).Select(x => x.PropertyInfo!).ToArray();
                var byUsername = properties.Any(p => p.Name == "StudentUsername" && p.GetValue(row) as string == user.Username);
                var byName = properties.Any(p => nameFields.Contains(p.Name) && p.GetValue(row) as string == user.FullName);
                if (!byUsername && !byName) continue;
                // An explicit different owner always wins over a legacy name, including namesakes.
                if (properties.Any(p => new[] { "StudentUserId", "StaffUserId", "UserId" }.Contains(p.Name) && p.GetValue(row) is Guid id && id != userId)) continue;
                if (!byUsername && await db.Users.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenantId && x.FullName == user.FullName && x.DeletedAtUtc == null, ct) > 1)
                    throw new InvalidOperationException("legacy-identity-review-required");
                // Legacy authorship and parent/contact names do not confer ownership of shared content.
                var personalOwner = byUsername || properties.Any(p => (p.Name == "StudentName" || p.Name == "FullName") && nameFields.Contains(p.Name) && p.GetValue(row) as string == user.FullName)
                    || row is TeacherDuty || row is TeacherTimetableSlot;
                if (!personalOwner)
                {
                    foreach (var p in properties.Where(p => p.PropertyType == typeof(string) && nameFields.Contains(p.Name) && p.GetValue(row) as string == user.FullName))
                        p.SetValue(row, EmptyValue(p.Name));
                    if (row is AccountingInvoice invoice) { invoice.Note = ""; invoice.Subtitle = ""; }
                    continue;
                }
                files.UnionWith(Uploads(row));
                foreach (var p in properties.Where(p => p.PropertyType == typeof(string) && !StructuralStrings.Contains(p.Name)))
                    p.SetValue(row, EmptyValue(p.Name));
            }
        }
        return files;
    }

    internal static async Task<int> TenantFileCountAsync(CourseIntellectDbContext db, Guid tenantId, CancellationToken ct)
    {
        var files = new HashSet<string>();
        foreach (var model in db.Model.GetEntityTypes().Where(x => x.GetTableName() != null && typeof(ITenantScopedEntity).IsAssignableFrom(x.ClrType) && x.ClrType != typeof(DeletionFileTask)))
            foreach (var row in await QueryRows(db, model.ClrType, tenantId, true, [], ct)) files.UnionWith(Uploads(row));
        return files.Count;
    }

    private static string EmptyValue(string name)
        => name.EndsWith("Name") || name == "FullName" ? AccountLifecycleService.Tombstone
            : name.EndsWith("Serialized") || name.EndsWith("Json") ? "[]" : "";

    internal static async Task<HashSet<string>> ReferencedFilesAsync(CourseIntellectDbContext db, CancellationToken ct)
    {
        var files = new HashSet<string>(StringComparer.Ordinal);
        foreach (var model in db.Model.GetEntityTypes().Where(x => x.GetTableName() != null && x.ClrType != typeof(DeletionFileTask)))
            foreach (var row in await QueryRows(db, model.ClrType, null, true, [], ct))
                files.UnionWith(Uploads(row));
        return files;
    }

    private static Task<List<object>> QueryRows(CourseIntellectDbContext db, Type type, Guid? tenantId, bool institution, HashSet<Guid> ids, CancellationToken ct)
        => (Task<List<object>>)typeof(DeletionDataCleaner).GetMethod(nameof(QueryTyped), BindingFlags.NonPublic | BindingFlags.Static)!
            .MakeGenericMethod(type).Invoke(null, [db, tenantId, institution, ids, ct])!;

    private static async Task<List<object>> QueryTyped<T>(CourseIntellectDbContext db, Guid? tenantId, bool institution, HashSet<Guid> ids, CancellationToken ct) where T : class
    {
        var model = db.Model.FindEntityType(typeof(T))!;
        var parameter = Expression.Parameter(typeof(T), "row");
        Expression matches = Expression.Constant(institution && model.FindProperty("TenantId") != null);
        foreach (var p in model.GetProperties().Where(x => SubjectIds.Contains(x.Name) || ReferenceIds.Contains(x.Name)))
        {
            if (p.ClrType != typeof(Guid) && p.ClrType != typeof(Guid?)) continue;
            var value = Expression.Property(parameter, p.Name);
            var nullable = p.ClrType == typeof(Guid?);
            Expression v = nullable ? Expression.Property(value, "Value") : value;
            Expression test = Expression.Call(Expression.Constant(ids), typeof(HashSet<Guid>).GetMethod(nameof(HashSet<Guid>.Contains))!, v);
            if (nullable) test = Expression.AndAlso(Expression.Property(value, "HasValue"), test);
            matches = Expression.OrElse(matches, test);
        }
        if (tenantId == null && institution) matches = Expression.Constant(true);
        else if (model.FindProperty("TenantId") is { } tenantProperty)
            matches = Expression.AndAlso(matches, Expression.Equal(Expression.Property(parameter, "TenantId"), Expression.Constant(tenantId, tenantProperty.ClrType)));
        var query = db.Set<T>().IgnoreQueryFilters().Where(Expression.Lambda<Func<T, bool>>(matches, parameter));
        if (tenantId == null && institution) query = query.AsNoTracking();
        return (await query.ToListAsync(ct)).Cast<object>().ToList();
    }
}
