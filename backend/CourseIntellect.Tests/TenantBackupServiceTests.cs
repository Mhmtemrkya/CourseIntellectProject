using System.IO.Compression;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>
/// Kurum yedeğinin sözleşmesi. En kritik iki davranış: arşive BAŞKA kurumun satırı
/// giremez ve parola özetleri yazılmaz.
/// </summary>
public sealed class TenantBackupServiceTests
{
    private static readonly Guid TenantA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TenantB = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static TenantBackupService CreateService(TestDb db, string uploadsRoot)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Uploads:RootPath"] = uploadsRoot })
            .Build();
        return new TenantBackupService(
            db.Context,
            new TestHostEnvironment(uploadsRoot),
            configuration,
            NullLogger<TenantBackupService>.Instance);
    }

    private static async Task<Dictionary<string, string>> ReadArchiveAsync(TestDb db, string uploadsRoot, bool includeFiles = true)
    {
        using var buffer = new MemoryStream();
        await CreateService(db, uploadsRoot).WriteArchiveAsync(buffer, includeFiles);
        buffer.Position = 0;
        using var archive = new ZipArchive(buffer, ZipArchiveMode.Read);
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entry in archive.Entries)
        {
            using var reader = new StreamReader(entry.Open());
            result[entry.FullName] = await reader.ReadToEndAsync();
        }
        return result;
    }

    private static void SeedTwoTenants(TestDb db)
    {
        db.Context.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = TenantA, Name = "A Kurumu", Slug = "a-kurumu" },
            new TenantWorkspace { Id = TenantB, Name = "B Kurumu", Slug = "b-kurumu" });
        db.Context.Users.AddRange(
            new AppUser { TenantId = TenantA, FullName = "A Yönetici", Username = "a.admin", PasswordHash = "GIZLI-A" },
            new AppUser { TenantId = TenantB, FullName = "B Yönetici", Username = "b.admin", PasswordHash = "GIZLI-B" });
        db.Context.SaveChanges();
    }

    [Fact]
    public async Task Archive_ContainsOnlyOwnTenantRows()
    {
        using var db = new TestDb();
        SeedTwoTenants(db);
        db.Context.SetTenantOverride(TenantA);

        var entries = await ReadArchiveAsync(db, Path.Combine(Path.GetTempPath(), $"backup-{Guid.NewGuid():N}"), includeFiles: false);
        var users = entries.Single(x => x.Key.EndsWith("users.json", StringComparison.OrdinalIgnoreCase)).Value;

        // Adlar kayıtta biçimlendirilir: "A Yönetici" → "A YÖNETİCİ".
        Assert.Contains("A YÖNETİCİ", users, StringComparison.Ordinal);
        Assert.DoesNotContain("B YÖNETİCİ", users, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Archive_RedactsPasswordHashes()
    {
        using var db = new TestDb();
        SeedTwoTenants(db);
        db.Context.SetTenantOverride(TenantA);

        var entries = await ReadArchiveAsync(db, Path.Combine(Path.GetTempPath(), $"backup-{Guid.NewGuid():N}"), includeFiles: false);
        var users = entries.Single(x => x.Key.EndsWith("users.json", StringComparison.OrdinalIgnoreCase)).Value;

        Assert.DoesNotContain("GIZLI-A", users, StringComparison.Ordinal);
        Assert.Contains("YEDEKTE GİZLENDİ", users, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Archive_CoversEveryTenantScopedTable()
    {
        using var db = new TestDb();
        SeedTwoTenants(db);
        db.Context.SetTenantOverride(TenantA);

        var entries = await ReadArchiveAsync(db, Path.Combine(Path.GetTempPath(), $"backup-{Guid.NewGuid():N}"), includeFiles: false);

        // Elle tablo listesi tutulmadığının kanıtı: modeldeki her tenant tablosu arşivde.
        var expected = db.Context.Model.GetEntityTypes()
            .Where(x => typeof(ITenantScopedEntity).IsAssignableFrom(x.ClrType) && !x.IsOwned())
            .Select(x => x.GetTableName())
            .Where(x => x is not null)
            .Distinct()
            .ToList();

        Assert.NotEmpty(expected);
        foreach (var table in expected)
        {
            Assert.True(entries.ContainsKey($"veri/{table}.json"), $"Eksik tablo: {table}");
            Assert.True(entries.ContainsKey($"tablolar/{table}.csv"), $"Eksik CSV: {table}");
        }
    }

    [Fact]
    public async Task Manifest_ReportsRowCounts()
    {
        using var db = new TestDb();
        SeedTwoTenants(db);
        db.Context.SetTenantOverride(TenantA);

        var entries = await ReadArchiveAsync(db, Path.Combine(Path.GetTempPath(), $"backup-{Guid.NewGuid():N}"), includeFiles: false);
        using var manifest = JsonDocument.Parse(entries["MANIFEST.json"]);
        var root = manifest.RootElement;

        Assert.Equal("A Kurumu", root.GetProperty("kurumAdi").GetString());
        Assert.Equal(TenantA.ToString(), root.GetProperty("kurumId").GetString());
        Assert.Equal(1, root.GetProperty("tablolar").GetProperty("users").GetInt32());
        Assert.True(root.GetProperty("toplamSatir").GetInt64() >= 1);
        Assert.True(entries.ContainsKey("OKUBENI.txt"));
    }

    [Fact]
    public async Task Archive_IncludesOnlyFilesReferencedByOwnRows()
    {
        var uploadsRoot = Path.Combine(Path.GetTempPath(), $"backup-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(uploadsRoot, "driving-student-documents"));
        var mine = Path.Combine(uploadsRoot, "driving-student-documents", "benim.pdf");
        var other = Path.Combine(uploadsRoot, "driving-student-documents", "baskasi.pdf");
        await File.WriteAllTextAsync(mine, "BENIM BELGEM");
        await File.WriteAllTextAsync(other, "BASKA KURUMUN BELGESI");

        try
        {
            using var db = new TestDb();
            // Her iki kurumun kullanıcısı da bir belgeye işaret eder; arşive yalnız
            // A kurumununki girmelidir (uploads klasörü kuruma göre ayrılmadığı için
            // dosyalar satırlardan toplanır).
            db.Context.TenantWorkspaces.AddRange(
                new TenantWorkspace { Id = TenantA, Name = "A Kurumu", Slug = "a-kurumu" },
                new TenantWorkspace { Id = TenantB, Name = "B Kurumu", Slug = "b-kurumu" });
            db.Context.Users.AddRange(
                new AppUser
                {
                    TenantId = TenantA, FullName = "A Yönetici", Username = "a.admin", PasswordHash = "GIZLI-A",
                    PhotoUrl = "/uploads/driving-student-documents/benim.pdf",
                },
                new AppUser
                {
                    TenantId = TenantB, FullName = "B Yönetici", Username = "b.admin", PasswordHash = "GIZLI-B",
                    PhotoUrl = "/uploads/driving-student-documents/baskasi.pdf",
                });
            db.Context.SaveChanges();
            db.Context.SetTenantOverride(TenantA);

            var entries = await ReadArchiveAsync(db, uploadsRoot);

            Assert.True(entries.ContainsKey("belgeler/driving-student-documents/benim.pdf"));
            Assert.False(entries.ContainsKey("belgeler/driving-student-documents/baskasi.pdf"));
            Assert.True(entries.ContainsKey("belgeler/DOSYA-DIZINI.csv"));
        }
        finally
        {
            Directory.Delete(uploadsRoot, recursive: true);
        }
    }

    /// <summary>
    /// Yanıt gövdesini taklit eder: GERİ SARILAMAZ (CanSeek=false).
    ///
    /// Canlıda indirme bozuluyordu çünkü ZipArchive gövdeye SENKRON yazıyor ve
    /// ASP.NET Core'da bu varsayılan olarak yasak; akış yarıda kopup 5 baytlık
    /// bozuk dosya üretiyordu. Uç nokta artık bu istek için senkron yazmayı açıyor
    /// (bkz. TenantBackupController), bu yüzden burada senkron yazmaya izin verilir —
    /// ama geri sarma hâlâ yasaktır: arşiv üretimi Position/Seek'e bağlı olmamalı.
    /// </summary>
    private sealed class NonSeekableStream : Stream
    {
        private readonly MemoryStream inner = new();

        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => inner.Length;
        public override long Position { get => inner.Position; set => throw new NotSupportedException(); }
        public byte[] ToArray() => inner.ToArray();

        public override void Write(byte[] buffer, int offset, int count) => inner.Write(buffer, offset, count);
        public override void Write(ReadOnlySpan<byte> buffer) => inner.Write(buffer);
        public override void WriteByte(byte value) => inner.WriteByte(value);
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
            inner.WriteAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default) =>
            inner.WriteAsync(buffer, cancellationToken);

        public override void Flush() { }
        public override Task FlushAsync(CancellationToken cancellationToken) => Task.CompletedTask;
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
    }

    [Fact]
    public async Task Archive_IsValidOverNonSeekableResponseStream()
    {
        using var db = new TestDb();
        SeedTwoTenants(db);
        db.Context.SetTenantOverride(TenantA);

        var uploads = Path.Combine(Path.GetTempPath(), $"backup-{Guid.NewGuid():N}");
        await using var response = new NonSeekableStream();
        // Uç noktadaki gibi tamponlanmış yazma.
        await using (var buffered = new BufferedStream(response, 128 * 1024))
        {
            await CreateService(db, uploads).WriteArchiveAsync(buffered, includeFiles: false);
            await buffered.FlushAsync();
        }

        var bytes = response.ToArray();
        Assert.True(bytes.Length > 1000, $"arşiv yalnız {bytes.Length} bayt — akış yarıda kopmuş.");
        using var archive = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        Assert.Contains(archive.Entries, x => x.FullName == "MANIFEST.json");
        Assert.Contains(archive.Entries, x => x.FullName == "veri/users.json");
    }

    private sealed class TestHostEnvironment(string root) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = root;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } =
            new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
