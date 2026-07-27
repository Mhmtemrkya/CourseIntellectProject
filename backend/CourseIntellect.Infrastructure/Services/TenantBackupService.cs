using System.Data;
using System.Globalization;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Kurumun tüm verisini tek ZIP arşivine akıtır.
///
/// Tablolar EF modelinden YANSIMAYLA bulunur: <see cref="ITenantScopedEntity"/> uygulayan
/// her varlık otomatik girer. Elle tablo listesi tutulsaydı yeni bir tablo eklendiğinde
/// yedek sessizce eksik kalırdı — ve bu ancak veri kaybında fark edilirdi.
///
/// Kurum izolasyonu DbContext'teki global sorgu filtresine bırakılır; burada
/// <c>IgnoreQueryFilters</c> ASLA kullanılmaz. Böylece başka kurumun satırı arşive giremez.
/// </summary>
public sealed class TenantBackupService(
    CourseIntellectDbContext dbContext,
    IHostEnvironment environment,
    IConfiguration configuration,
    ILogger<TenantBackupService> logger) : ITenantBackupService
{
    /// <summary>
    /// Arşive YAZILMAYACAK sütunlar. Parola özeti ve oturum jetonları yedeğe girerse
    /// dosyanın çalınması doğrudan hesap ele geçirmeye dönüşür; yedeğin amacı için de
    /// gereksizdir. Değer yerine sabit bir maske yazılır (sütun kaybolmasın).
    /// </summary>
    private static readonly HashSet<string> RedactedProperties = new(StringComparer.OrdinalIgnoreCase)
    {
        "PasswordHash", "PendingAdminPasswordHash", "TokenHash", "RefreshTokenHash",
        "VerificationTokenHash", "SecurityStamp", "TwoFactorSecret", "ApiKey", "ClientSecret",
    };

    private const string RedactedMarker = "[YEDEKTE GİZLENDİ]";

    private static readonly MethodInfo StreamTableMethod = typeof(TenantBackupService)
        .GetMethod(nameof(StreamTableAsync), BindingFlags.NonPublic | BindingFlags.Instance)!;

    // Türkçe harfler \u00F6 gibi kaçırılmasın: arşiv insan tarafından da açılıyor
    // ve kaçırılmış hâli hem okunmaz hem de dosya boyutunu şişirir. Çıktı bir
    // dosyadır (HTML'e gömülmez), bu yüzden gevşek kodlayıcı güvenlidir.
    private static readonly System.Text.Encodings.Web.JavaScriptEncoder FileEncoder =
        System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping;

    private static readonly JsonWriterOptions JsonOptions =
        new() { Indented = false, SkipValidation = true, Encoder = FileEncoder };

    public async Task<TenantBackupResult> WriteArchiveAsync(
        Stream output,
        bool includeFiles,
        CancellationToken cancellationToken = default)
    {
        var tenantId = dbContext.CurrentTenantId
            ?? throw new InvalidOperationException("Yedek yalnızca bir kuruma bağlı oturumla alınabilir.");

        var uploadsRoot = UploadStoragePathResolver.ResolveUploadsRoot(environment, configuration);
        // Aynı dosya birden çok satırda geçebilir; arşive bir kez konur.
        var referencedFiles = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
        var fileIndex = new List<FileReference>();
        var tableSummaries = new List<TableSummary>();
        long totalRows = 0;

        // leaveOpen: yanıt akışını biz kapatmayız (ASP.NET Core kapatır).
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entityTypes = dbContext.Model.GetEntityTypes()
                .Where(x => typeof(ITenantScopedEntity).IsAssignableFrom(x.ClrType))
                .Where(x => !x.IsOwned())
                .GroupBy(x => x.ClrType)
                .Select(x => x.First())
                .OrderBy(x => x.GetTableName() ?? x.ClrType.Name, StringComparer.Ordinal)
                .ToList();

            // Tüm tablolar TEK anlık görüntüden okunur: yedek alınırken yapılan bir
            // kayıt, tabloların yarısına girip yarısına girmesin. Dosya kopyalama
            // uzun sürebileceği için işlem tablolar biter bitmez kapatılır (uzun
            // süren snapshot veritabanını şişirir).
            var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken)
                : null;
            try
            {
                foreach (var entityType in entityTypes)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var task = (Task<TableSummary>)StreamTableMethod
                        .MakeGenericMethod(entityType.ClrType)
                        .Invoke(this, [archive, entityType, referencedFiles, fileIndex, cancellationToken])!;
                    var summary = await task;
                    tableSummaries.Add(summary);
                    totalRows += summary.RowCount;
                }
            }
            finally
            {
                if (transaction is not null) await transaction.DisposeAsync();
            }

            var fileCount = 0;
            long fileBytes = 0;
            if (includeFiles)
            {
                (fileCount, fileBytes) = await WriteFilesAsync(archive, uploadsRoot, referencedFiles, cancellationToken);
                WriteFileIndex(archive, fileIndex);
            }

            WriteManifest(archive, tenantId, includeFiles, tableSummaries, totalRows, fileCount, fileBytes);
            WriteReadme(archive, includeFiles, tableSummaries.Count, totalRows, fileCount);

            return new TenantBackupResult(tableSummaries.Count, totalRows, fileCount, fileBytes);
        }
    }

    // ── Tablolar ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Tek tabloyu hem JSON (geri yükleme/taşıma) hem CSV (Excel'de açmak) olarak yazar.
    /// Satırlar akış hâlinde işlenir; tablo belleğe toplanmaz.
    /// </summary>
    private async Task<TableSummary> StreamTableAsync<TEntity>(
        ZipArchive archive,
        IEntityType entityType,
        SortedSet<string> referencedFiles,
        List<FileReference> fileIndex,
        CancellationToken cancellationToken)
        where TEntity : class
    {
        var tableName = entityType.GetTableName() ?? entityType.ClrType.Name;
        var properties = entityType.GetProperties()
            .Where(x => x.PropertyInfo is not null)
            .Select(x => new ColumnAccessor(x.Name, x.PropertyInfo!, RedactedProperties.Contains(x.Name)))
            .ToList();

        // "/uploads/..." ile başlayan metin sütunları belge referansıdır.
        var urlColumns = properties.Where(x => x.Info.PropertyType == typeof(string)).ToList();
        var identityColumn = properties.FirstOrDefault(x => x.Name == "Id");
        var nameColumn = properties.FirstOrDefault(x =>
            x.Name is "FullName" or "StudentName" or "Name" or "Title" or "PlateNumber");

        // ZipArchive yazma kipinde AYNI ANDA tek girdi açılmasına izin verir; bu yüzden
        // JSON ve CSV ardışık iki geçişte yazılır. Tutarlılık, çağıranın açtığı
        // tekrarlanabilir-okuma işlemiyle (aynı anlık görüntü) sağlanır.
        long rowCount = 0;

        var jsonEntry = archive.CreateEntry($"veri/{tableName}.json", CompressionLevel.Optimal);
        await using (var jsonStream = jsonEntry.Open())
        await using (var jsonWriter = new Utf8JsonWriter(jsonStream, JsonOptions))
        {
            jsonWriter.WriteStartArray();
            var query = dbContext.Set<TEntity>().AsNoTracking().AsAsyncEnumerable();
            await foreach (var row in query.WithCancellation(cancellationToken))
            {
                jsonWriter.WriteStartObject();
                foreach (var column in properties)
                {
                    var value = column.Redacted ? RedactedMarker : column.Info.GetValue(row);
                    WriteJsonValue(jsonWriter, column.Name, value);
                }
                jsonWriter.WriteEndObject();

                foreach (var column in urlColumns)
                {
                    if (column.Info.GetValue(row) is not string text || !IsUploadPath(text)) continue;
                    var relative = NormalizeUploadPath(text);
                    if (relative is null) continue;
                    if (referencedFiles.Add(relative))
                    {
                        fileIndex.Add(new FileReference(
                            relative,
                            tableName,
                            identityColumn?.Info.GetValue(row)?.ToString() ?? string.Empty,
                            nameColumn?.Info.GetValue(row)?.ToString() ?? string.Empty));
                    }
                }

                rowCount++;
                if (rowCount % 500 == 0) await jsonWriter.FlushAsync(cancellationToken);
            }
            jsonWriter.WriteEndArray();
            await jsonWriter.FlushAsync(cancellationToken);
        }

        var csvEntry = archive.CreateEntry($"tablolar/{tableName}.csv", CompressionLevel.Optimal);
        await using (var csvStream = csvEntry.Open())
        // Excel'in TR yerelinde ayracı doğru seçmesi için BOM + sep ipucu (mevcut CSV'lerle aynı).
        await using (var csvWriter = new StreamWriter(csvStream, new UTF8Encoding(true)))
        {
            await csvWriter.WriteLineAsync("sep=;");
            await csvWriter.WriteLineAsync(string.Join(';', properties.Select(x => CsvCell(x.Name))));
            var query = dbContext.Set<TEntity>().AsNoTracking().AsAsyncEnumerable();
            await foreach (var row in query.WithCancellation(cancellationToken))
            {
                var csvCells = new List<string>(properties.Count);
                foreach (var column in properties)
                {
                    var value = column.Redacted ? RedactedMarker : column.Info.GetValue(row);
                    csvCells.Add(CsvCell(FormatCell(value)));
                }
                await csvWriter.WriteLineAsync(string.Join(';', csvCells));
            }
            await csvWriter.FlushAsync(cancellationToken);
        }

        return new TableSummary(tableName, rowCount);
    }

    // ── Belgeler ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Yalnızca kurumun KENDİ satırlarında geçen dosyaları ekler. uploads klasörü
    /// kuruma göre ayrılmadığı için klasörü toptan kopyalamak başka kurumların
    /// belgelerini sızdırırdı.
    /// </summary>
    private async Task<(int Count, long Bytes)> WriteFilesAsync(
        ZipArchive archive,
        string uploadsRoot,
        SortedSet<string> referencedFiles,
        CancellationToken cancellationToken)
    {
        var rootFull = Path.GetFullPath(uploadsRoot);
        var count = 0;
        long bytes = 0;

        foreach (var relative in referencedFiles)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var candidate = Path.GetFullPath(Path.Combine(rootFull, relative));
            // Dizin dışına çıkma (path traversal) koruması.
            if (!candidate.StartsWith(Path.TrimEndingDirectorySeparator(rootFull) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("Yedek: uploads kökü dışına çıkan yol atlandı ({Path})", relative);
                continue;
            }
            if (!File.Exists(candidate)) continue;

            // Belgeler zaten sıkıştırılmış (PDF/JPG); tekrar sıkıştırmak süreyi
            // boşuna uzatır, kazanç ~0'dır.
            var entry = archive.CreateEntry($"belgeler/{relative}", CompressionLevel.NoCompression);
            await using var source = File.OpenRead(candidate);
            await using var target = entry.Open();
            await source.CopyToAsync(target, cancellationToken);
            count++;
            bytes += source.Length;
        }

        return (count, bytes);
    }

    private static void WriteFileIndex(ZipArchive archive, List<FileReference> fileIndex)
    {
        var entry = archive.CreateEntry("belgeler/DOSYA-DIZINI.csv", CompressionLevel.Optimal);
        using var stream = entry.Open();
        using var writer = new StreamWriter(stream, new UTF8Encoding(true));
        writer.WriteLine("sep=;");
        writer.WriteLine("Dosya;Tablo;KayitId;Ilgili");
        foreach (var item in fileIndex.OrderBy(x => x.RelativePath, StringComparer.Ordinal))
        {
            writer.WriteLine(string.Join(';', new[]
            {
                CsvCell($"belgeler/{item.RelativePath}"),
                CsvCell(item.TableName),
                CsvCell(item.RowId),
                CsvCell(item.DisplayName),
            }));
        }
    }

    // ── Künye ve okuma notu ───────────────────────────────────────────────────

    private void WriteManifest(
        ZipArchive archive,
        Guid tenantId,
        bool includeFiles,
        List<TableSummary> tables,
        long totalRows,
        int fileCount,
        long fileBytes)
    {
        var tenant = dbContext.TenantWorkspaces.AsNoTracking().IgnoreQueryFilters().FirstOrDefault(x => x.Id == tenantId);
        var entry = archive.CreateEntry("MANIFEST.json", CompressionLevel.Optimal);
        using var stream = entry.Open();
        using var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = true, Encoder = FileEncoder });
        writer.WriteStartObject();
        writer.WriteString("bicimSurumu", "1.0");
        writer.WriteString("olusturulmaZamaniUtc", DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture));
        writer.WriteString("kurumId", tenantId.ToString());
        writer.WriteString("kurumAdi", tenant?.Name ?? string.Empty);
        writer.WriteString("kurumTuru", tenant?.InstitutionType.ToString() ?? string.Empty);
        writer.WriteBoolean("belgelerDahil", includeFiles);
        writer.WriteNumber("tabloSayisi", tables.Count);
        writer.WriteNumber("toplamSatir", totalRows);
        writer.WriteNumber("belgeSayisi", fileCount);
        writer.WriteNumber("belgeBoyutuBayt", fileBytes);
        writer.WriteStartArray("gizlenenSutunlar");
        foreach (var name in RedactedProperties.OrderBy(x => x, StringComparer.Ordinal)) writer.WriteStringValue(name);
        writer.WriteEndArray();
        writer.WriteStartObject("tablolar");
        foreach (var table in tables.OrderBy(x => x.TableName, StringComparer.Ordinal))
            writer.WriteNumber(table.TableName, table.RowCount);
        writer.WriteEndObject();
        writer.WriteEndObject();
    }

    private static void WriteReadme(ZipArchive archive, bool includeFiles, int tableCount, long totalRows, int fileCount)
    {
        var entry = archive.CreateEntry("OKUBENI.txt", CompressionLevel.Optimal);
        using var stream = entry.Open();
        using var writer = new StreamWriter(stream, new UTF8Encoding(true));
        writer.WriteLine("KURUM VERİ YEDEĞİ");
        writer.WriteLine("=================");
        writer.WriteLine();
        writer.WriteLine($"Bu arşiv {tableCount} tablodan {totalRows} kaydı"
            + (includeFiles ? $" ve {fileCount} belgeyi" : string.Empty) + " içerir.");
        writer.WriteLine();
        writer.WriteLine("İÇİNDEKİLER");
        writer.WriteLine("  MANIFEST.json  : Arşiv künyesi — kurum, tarih, tablo başına satır sayısı.");
        writer.WriteLine("                   Yedeğin eksiksiz olduğunu buradan doğrulayabilirsiniz.");
        writer.WriteLine("  tablolar/*.csv : Excel ile açılabilen tablolar (çift tıklayın).");
        writer.WriteLine("  veri/*.json    : Aynı verinin ham hâli — sisteme geri aktarım/taşıma için.");
        if (includeFiles)
        {
            writer.WriteLine("  belgeler/      : Yüklenmiş evrak, fotoğraf ve sertifikalar.");
            writer.WriteLine("  belgeler/DOSYA-DIZINI.csv : Hangi dosyanın hangi kayda ait olduğunu gösterir.");
        }
        writer.WriteLine();
        writer.WriteLine("KİŞİSEL VERİ UYARISI (KVKK)");
        writer.WriteLine("  Bu arşiv kimlik numarası, iletişim bilgisi, sağlık raporu, adli sicil ve");
        writer.WriteLine("  fotoğraf gibi ÖZEL NİTELİKLİ kişisel veriler içerir. Saklanmasından,");
        writer.WriteLine("  paylaşılmasından ve imhasından kurum sorumludur. Şifreli bir diskte");
        writer.WriteLine("  saklayın, e-posta veya bulut sürücüsüyle korumasız paylaşmayın.");
        writer.WriteLine();
        writer.WriteLine("GÜVENLİK");
        writer.WriteLine("  Parola özetleri ve oturum jetonları güvenlik gereği arşive YAZILMAZ;");
        writer.WriteLine("  ilgili sütunlarda \"" + RedactedMarker + "\" görürsünüz.");
        writer.WriteLine();
        writer.WriteLine("NOT: Bu dosya bir arşiv/taşınabilir kopyadır. Sisteme geri yükleme ayrı bir");
        writer.WriteLine("işlemdir; kendi başınıza veritabanına yazmayı denemeyin.");
    }

    // ── Yardımcılar ───────────────────────────────────────────────────────────

    private static bool IsUploadPath(string value) =>
        value.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase);

    /// <summary>"/uploads/klasor/dosya.pdf" → "klasor/dosya.pdf" (sorgu dizesi atılır).</summary>
    private static string? NormalizeUploadPath(string value)
    {
        var path = value["/uploads/".Length..];
        var queryIndex = path.IndexOf('?');
        if (queryIndex >= 0) path = path[..queryIndex];
        path = Uri.UnescapeDataString(path).Replace('\\', '/').Trim('/');
        if (path.Length == 0 || path.Contains("..", StringComparison.Ordinal)) return null;
        return path;
    }

    private static void WriteJsonValue(Utf8JsonWriter writer, string name, object? value)
    {
        switch (value)
        {
            case null: writer.WriteNull(name); break;
            case string text: writer.WriteString(name, text); break;
            case bool flag: writer.WriteBoolean(name, flag); break;
            case DateTime date: writer.WriteString(name, date.ToString("O", CultureInfo.InvariantCulture)); break;
            case DateTimeOffset offset: writer.WriteString(name, offset.ToString("O", CultureInfo.InvariantCulture)); break;
            case Guid id: writer.WriteString(name, id.ToString()); break;
            case decimal number: writer.WriteNumber(name, number); break;
            case double number: writer.WriteNumber(name, number); break;
            case float number: writer.WriteNumber(name, number); break;
            case long number: writer.WriteNumber(name, number); break;
            case int number: writer.WriteNumber(name, number); break;
            case short number: writer.WriteNumber(name, number); break;
            case byte number: writer.WriteNumber(name, number); break;
            case byte[] bytes: writer.WriteString(name, Convert.ToBase64String(bytes)); break;
            case Enum enumValue: writer.WriteString(name, enumValue.ToString()); break;
            default: writer.WriteString(name, value.ToString()); break;
        }
    }

    private static string FormatCell(object? value) => value switch
    {
        null => string.Empty,
        DateTime date => date.ToString("dd.MM.yyyy HH:mm", CultureInfo.GetCultureInfo("tr-TR")),
        DateTimeOffset offset => offset.ToString("dd.MM.yyyy HH:mm", CultureInfo.GetCultureInfo("tr-TR")),
        bool flag => flag ? "Evet" : "Hayır",
        decimal number => number.ToString("N2", CultureInfo.GetCultureInfo("tr-TR")),
        double number => number.ToString("N2", CultureInfo.GetCultureInfo("tr-TR")),
        byte[] bytes => $"[{bytes.Length} bayt]",
        _ => value.ToString() ?? string.Empty,
    };

    /// <summary>CSV hücresi: ayraç/tırnak/satır sonu içeriyorsa tırnaklanır.</summary>
    private static string CsvCell(string value)
    {
        var text = value.Replace("\r", " ").Replace("\n", " ");
        if (!text.Contains(';') && !text.Contains('"')) return text;
        return $"\"{text.Replace("\"", "\"\"")}\"";
    }

    private sealed record ColumnAccessor(string Name, PropertyInfo Info, bool Redacted);
    private sealed record TableSummary(string TableName, long RowCount);
    private sealed record FileReference(string RelativePath, string TableName, string RowId, string DisplayName);
}
