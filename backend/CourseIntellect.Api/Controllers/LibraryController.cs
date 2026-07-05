using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kütüphane modülü: katalog, ödünç/iade/uzatma, rezervasyon kuyruğu,
/// öğretmen önerileri, hatırlatma bildirimleri ve istatistikler.
/// Yönetim = Admin + Administrative; öneri = Teacher (rehberlik dahil);
/// öğrenci/veli yalnız kendi kayıtlarını görür.
/// </summary>
[ApiController]
[Authorize]
[Route("api/library")]
public sealed class LibraryController(
    CourseIntellectDbContext dbContext,
    IHttpClientFactory httpClientFactory) : ControllerBase
{
    private static string Normalize(string? value)
        => (value ?? string.Empty).Trim().ToLowerInvariant()
            .Replace("ı", "i").Replace("ğ", "g").Replace("ü", "u")
            .Replace("ş", "s").Replace("ö", "o").Replace("ç", "c");

    private string CallerName => User.FindFirstValue("name") ?? string.Empty;

    private bool IsStaff()
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? string.Empty;
        return role is "Admin" or "Administrative";
    }

    private bool IsTeacherOrStaff()
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? string.Empty;
        return role is "Admin" or "Administrative" or "Teacher";
    }

    private async Task<LibrarySettings> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.LibrarySettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = new LibrarySettings();
            dbContext.LibrarySettings.Add(settings);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return settings;
    }

    private async Task<Dictionary<Guid, int>> ActiveLoanCountsAsync(CancellationToken cancellationToken)
        => await dbContext.LibraryLoans.AsNoTracking()
            .Where(l => l.ReturnedAtUtc == null)
            .GroupBy(l => l.BookId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

    private object ToBookDto(LibraryBook book, Dictionary<Guid, int> activeCounts,
        Dictionary<Guid, int>? reservationCounts = null)
    {
        activeCounts.TryGetValue(book.Id, out var active);
        var reserved = 0;
        reservationCounts?.TryGetValue(book.Id, out reserved);
        return new
        {
            book.Id,
            book.Title,
            book.Author,
            book.Publisher,
            book.Isbn,
            book.Category,
            book.Shelf,
            book.TotalCopies,
            book.Notes,
            activeLoans = active,
            availableCopies = Math.Max(0, book.TotalCopies - active),
            reservationCount = reserved,
        };
    }

    // ─── Katalog ─────────────────────────────────────────────────────────
    [HttpGet("books")]
    public async Task<IActionResult> GetBooks([FromQuery] string? search, [FromQuery] string? category, CancellationToken cancellationToken)
    {
        var books = await dbContext.LibraryBooks.AsNoTracking()
            .OrderBy(b => b.Title)
            .ToListAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = Normalize(search);
            books = books.Where(b => Normalize(b.Title).Contains(normalized)
                || Normalize(b.Author).Contains(normalized)
                || b.Isbn.Contains(search.Trim())).ToList();
        }
        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = Normalize(category);
            books = books.Where(b => Normalize(b.Category) == normalized).ToList();
        }

        var activeCounts = await ActiveLoanCountsAsync(cancellationToken);
        var reservationCounts = await dbContext.LibraryReservations.AsNoTracking()
            .Where(r => r.Status == "Bekliyor" || r.Status == "Hazır")
            .GroupBy(r => r.BookId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

        return Ok(books.Select(b => ToBookDto(b, activeCounts, reservationCounts)));
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories(CancellationToken cancellationToken)
    {
        var categories = await dbContext.LibraryBooks.AsNoTracking()
            .Select(b => b.Category)
            .Where(c => c != "")
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(cancellationToken);
        return Ok(categories);
    }

    [HttpPost("books")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> CreateBook([FromBody] LibraryBook request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Kitap adı gerekli." });
        var book = new LibraryBook
        {
            Title = request.Title.Trim(),
            Author = request.Author?.Trim() ?? string.Empty,
            Publisher = request.Publisher?.Trim() ?? string.Empty,
            Isbn = request.Isbn?.Trim() ?? string.Empty,
            Category = request.Category?.Trim() ?? string.Empty,
            Shelf = request.Shelf?.Trim() ?? string.Empty,
            TotalCopies = Math.Max(1, request.TotalCopies),
            Notes = request.Notes ?? string.Empty,
        };
        dbContext.LibraryBooks.Add(book);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToBookDto(book, new Dictionary<Guid, int>()));
    }

    public sealed record BulkBooksRequest(List<LibraryBook> Books);

    [HttpPost("books/bulk")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> CreateBooksBulk([FromBody] BulkBooksRequest request, CancellationToken cancellationToken)
    {
        var valid = (request.Books ?? [])
            .Where(b => !string.IsNullOrWhiteSpace(b.Title))
            .Select(b => new LibraryBook
            {
                Title = b.Title.Trim(),
                Author = b.Author?.Trim() ?? string.Empty,
                Publisher = b.Publisher?.Trim() ?? string.Empty,
                Isbn = b.Isbn?.Trim() ?? string.Empty,
                Category = b.Category?.Trim() ?? string.Empty,
                Shelf = b.Shelf?.Trim() ?? string.Empty,
                TotalCopies = Math.Max(1, b.TotalCopies),
            })
            .ToList();
        dbContext.LibraryBooks.AddRange(valid);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { created = valid.Count });
    }

    [HttpPut("books/{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> UpdateBook(Guid id, [FromBody] LibraryBook request, CancellationToken cancellationToken)
    {
        var book = await dbContext.LibraryBooks.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (book is null) return NotFound();
        if (!string.IsNullOrWhiteSpace(request.Title)) book.Title = request.Title.Trim();
        book.Author = request.Author?.Trim() ?? book.Author;
        book.Publisher = request.Publisher?.Trim() ?? book.Publisher;
        book.Isbn = request.Isbn?.Trim() ?? book.Isbn;
        book.Category = request.Category?.Trim() ?? book.Category;
        book.Shelf = request.Shelf?.Trim() ?? book.Shelf;
        if (request.TotalCopies > 0) book.TotalCopies = request.TotalCopies;
        book.Notes = request.Notes ?? book.Notes;
        await dbContext.SaveChangesAsync(cancellationToken);
        var activeCounts = await ActiveLoanCountsAsync(cancellationToken);
        return Ok(ToBookDto(book, activeCounts));
    }

    [HttpDelete("books/{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> DeleteBook(Guid id, CancellationToken cancellationToken)
    {
        var book = await dbContext.LibraryBooks.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (book is null) return NotFound();
        var hasActiveLoan = await dbContext.LibraryLoans
            .AnyAsync(l => l.BookId == id && l.ReturnedAtUtc == null, cancellationToken);
        if (hasActiveLoan)
            return Conflict(new { message = "Bu kitabın dışarıda kopyası var; önce iade alınmalı." });
        dbContext.LibraryBooks.Remove(book);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { deleted = true });
    }

    /// <summary>ISBN'den kitap bilgisi (Open Library). CSP nedeniyle istemciler
    /// dış servise çıkamaz; sorgu sunucu tarafında yapılır.</summary>
    [HttpGet("isbn-lookup")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> IsbnLookup([FromQuery] string isbn, CancellationToken cancellationToken)
    {
        var cleaned = new string((isbn ?? string.Empty).Where(char.IsLetterOrDigit).ToArray());
        if (cleaned.Length < 9) return BadRequest(new { message = "Geçerli bir ISBN girin." });
        try
        {
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(8);
            var response = await client.GetAsync(
                $"https://openlibrary.org/api/books?bibkeys=ISBN:{cleaned}&jscmd=data&format=json",
                cancellationToken);
            if (!response.IsSuccessStatusCode)
                return Ok(new { found = false });
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            if (!doc.RootElement.TryGetProperty($"ISBN:{cleaned}", out var entry))
                return Ok(new { found = false });

            string title = entry.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            string author = "";
            if (entry.TryGetProperty("authors", out var authors) && authors.ValueKind == JsonValueKind.Array)
            {
                author = string.Join(", ", authors.EnumerateArray()
                    .Select(a => a.TryGetProperty("name", out var n) ? n.GetString() : null)
                    .Where(n => !string.IsNullOrWhiteSpace(n)));
            }
            string publisher = "";
            if (entry.TryGetProperty("publishers", out var publishers) && publishers.ValueKind == JsonValueKind.Array)
            {
                publisher = publishers.EnumerateArray()
                    .Select(p => p.TryGetProperty("name", out var n) ? n.GetString() : null)
                    .FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)) ?? "";
            }
            return Ok(new { found = title.Length > 0, title, author, publisher, isbn = cleaned });
        }
        catch
        {
            // Dış servis erişilemezse elle giriş devam eder.
            return Ok(new { found = false });
        }
    }

    // ─── Ödünç işlemleri ─────────────────────────────────────────────────
    [HttpGet("loans")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> GetLoans([FromQuery] bool activeOnly = false, [FromQuery] string? student = null, CancellationToken cancellationToken = default)
    {
        var loans = await dbContext.LibraryLoans.AsNoTracking()
            .OrderByDescending(l => l.LoanedAtUtc)
            .ToListAsync(cancellationToken);
        if (activeOnly) loans = loans.Where(l => l.ReturnedAtUtc == null).ToList();
        if (!string.IsNullOrWhiteSpace(student))
        {
            var normalized = Normalize(student);
            loans = loans.Where(l => Normalize(l.StudentName) == normalized).ToList();
        }
        var now = DateTime.UtcNow;
        return Ok(loans.Select(l => new
        {
            l.Id, l.BookId, l.BookTitle, l.StudentName, l.ClassName,
            l.LoanedAtUtc, l.DueAtUtc, l.ReturnedAtUtc, l.ExtensionCount,
            l.IssuedBy, l.FineAmount,
            overdue = l.ReturnedAtUtc == null && l.DueAtUtc < now,
            overdueDays = l.ReturnedAtUtc == null && l.DueAtUtc < now
                ? (int)Math.Ceiling((now - l.DueAtUtc).TotalDays) : 0,
        }));
    }

    public sealed record CheckoutRequest(Guid BookId, string StudentName, string? ClassName);

    [HttpPost("loans")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.StudentName))
            return BadRequest(new { message = "Öğrenci gerekli." });
        var book = await dbContext.LibraryBooks.FirstOrDefaultAsync(b => b.Id == request.BookId, cancellationToken);
        if (book is null) return NotFound(new { message = "Kitap bulunamadı." });

        var settings = await GetSettingsAsync(cancellationToken);
        var activeLoans = await dbContext.LibraryLoans
            .Where(l => l.ReturnedAtUtc == null)
            .ToListAsync(cancellationToken);

        var bookActive = activeLoans.Count(l => l.BookId == book.Id);
        if (bookActive >= book.TotalCopies)
            return Conflict(new { message = "Bu kitabın tüm kopyaları dışarıda." });

        var normalized = Normalize(request.StudentName);
        var studentActive = activeLoans.Count(l => Normalize(l.StudentName) == normalized);
        if (studentActive >= settings.MaxActiveLoans)
            return Conflict(new { message = $"Öğrencinin üzerinde en fazla {settings.MaxActiveLoans} kitap olabilir." });

        var loan = new LibraryLoan
        {
            BookId = book.Id,
            BookTitle = book.Title,
            StudentName = request.StudentName.Trim(),
            ClassName = request.ClassName?.Trim() ?? string.Empty,
            DueAtUtc = DateTime.UtcNow.AddDays(settings.LoanDays),
            IssuedBy = CallerName,
        };
        dbContext.LibraryLoans.Add(loan);

        // Öğrencinin bu kitap için rezervasyonu varsa tamamlandı işaretle.
        var reservation = await dbContext.LibraryReservations
            .Where(r => r.BookId == book.Id && (r.Status == "Bekliyor" || r.Status == "Hazır"))
            .ToListAsync(cancellationToken);
        var own = reservation.FirstOrDefault(r => Normalize(r.StudentName) == normalized);
        if (own is not null) own.Status = "Tamamlandı";

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(loan);
    }

    [HttpPatch("loans/{id:guid}/return")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> ReturnLoan(Guid id, CancellationToken cancellationToken)
    {
        var loan = await dbContext.LibraryLoans.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (loan is null) return NotFound();
        if (loan.ReturnedAtUtc != null) return Conflict(new { message = "Bu kayıt zaten iade edilmiş." });

        var settings = await GetSettingsAsync(cancellationToken);
        loan.ReturnedAtUtc = DateTime.UtcNow;
        var overdueDays = (int)Math.Ceiling((DateTime.UtcNow - loan.DueAtUtc).TotalDays);
        loan.FineAmount = overdueDays > 0 ? overdueDays * settings.FinePerDay : 0;

        // Kuyruktaki ilk rezervasyonu hazır yap + bildirim düşür.
        var next = await dbContext.LibraryReservations
            .Where(r => r.BookId == loan.BookId && r.Status == "Bekliyor")
            .OrderBy(r => r.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (next is not null)
        {
            next.Status = "Hazır";
            next.ReadyAtUtc = DateTime.UtcNow;
            dbContext.Notifications.Add(new NotificationItem
            {
                Title = "Ayırttığın kitap hazır 📚",
                Message = $"{loan.BookTitle} iade edildi; 48 saat içinde kütüphaneden alabilirsin.",
                TimeLabel = DateTime.UtcNow.ToString("dd.MM.yyyy HH:mm"),
                Audience = next.StudentName,
                TargetRole = "Student",
                Category = "library",
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { loan.Id, loan.ReturnedAtUtc, loan.FineAmount, overdueDays = Math.Max(0, overdueDays) });
    }

    [HttpPatch("loans/{id:guid}/extend")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> ExtendLoan(Guid id, CancellationToken cancellationToken)
    {
        var loan = await dbContext.LibraryLoans.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (loan is null) return NotFound();
        if (loan.ReturnedAtUtc != null) return Conflict(new { message = "İade edilmiş kayıt uzatılamaz." });
        var settings = await GetSettingsAsync(cancellationToken);
        if (loan.ExtensionCount >= settings.MaxExtensions)
            return Conflict(new { message = $"En fazla {settings.MaxExtensions} kez uzatılabilir." });
        loan.ExtensionCount += 1;
        loan.DueAtUtc = loan.DueAtUtc.AddDays(settings.ExtensionDays);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(loan);
    }

    /// <summary>İadesi yaklaşan (2 gün) ve geciken tüm aktif ödünçler için
    /// öğrenci + veliye bildirim üretir.</summary>
    [HttpPost("reminders")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> SendReminders(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var soonThreshold = now.AddDays(2);
        var loans = await dbContext.LibraryLoans
            .Where(l => l.ReturnedAtUtc == null && l.DueAtUtc <= soonThreshold)
            .ToListAsync(cancellationToken);

        foreach (var loan in loans)
        {
            var overdue = loan.DueAtUtc < now;
            var title = overdue ? "Kitap iade süresi geçti" : "Kitap iade süresi yaklaşıyor";
            var message = $"{loan.BookTitle} — iade tarihi {loan.DueAtUtc:dd.MM.yyyy}";
            dbContext.Notifications.Add(new NotificationItem
            {
                Title = title, Message = message,
                TimeLabel = now.ToString("dd.MM.yyyy HH:mm"),
                Audience = loan.StudentName, TargetRole = "Student", Category = "library",
            });
            dbContext.Notifications.Add(new NotificationItem
            {
                Title = title, Message = $"{loan.StudentName}: {message}",
                TimeLabel = now.ToString("dd.MM.yyyy HH:mm"),
                Audience = loan.StudentName, TargetRole = "Parent", Category = "library",
            });
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { notified = loans.Count });
    }

    // ─── Rezervasyon ─────────────────────────────────────────────────────
    public sealed record ReserveRequest(Guid BookId);

    [HttpPost("reservations")]
    public async Task<IActionResult> Reserve([FromBody] ReserveRequest request, CancellationToken cancellationToken)
    {
        var book = await dbContext.LibraryBooks.FirstOrDefaultAsync(b => b.Id == request.BookId, cancellationToken);
        if (book is null) return NotFound(new { message = "Kitap bulunamadı." });
        var student = CallerName;
        if (string.IsNullOrWhiteSpace(student)) return Unauthorized();

        var normalized = Normalize(student);
        var existing = await dbContext.LibraryReservations
            .Where(r => r.BookId == book.Id && (r.Status == "Bekliyor" || r.Status == "Hazır"))
            .ToListAsync(cancellationToken);
        if (existing.Any(r => Normalize(r.StudentName) == normalized))
            return Conflict(new { message = "Bu kitap için zaten rezervasyonun var." });

        var hasActiveLoan = (await dbContext.LibraryLoans
                .Where(l => l.BookId == book.Id && l.ReturnedAtUtc == null)
                .ToListAsync(cancellationToken))
            .Any(l => Normalize(l.StudentName) == normalized);
        if (hasActiveLoan)
            return Conflict(new { message = "Bu kitap zaten sende." });

        var reservation = new LibraryReservation
        {
            BookId = book.Id,
            BookTitle = book.Title,
            StudentName = student,
        };
        dbContext.LibraryReservations.Add(reservation);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { reservation.Id, reservation.Status, queuePosition = existing.Count + 1 });
    }

    [HttpDelete("reservations/{id:guid}")]
    public async Task<IActionResult> CancelReservation(Guid id, CancellationToken cancellationToken)
    {
        var reservation = await dbContext.LibraryReservations.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (reservation is null) return NotFound();
        if (!IsStaff() && Normalize(reservation.StudentName) != Normalize(CallerName))
            return Forbid();
        reservation.Status = "İptal";
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { cancelled = true });
    }

    // ─── Öneriler ────────────────────────────────────────────────────────
    [HttpPost("recommendations")]
    public async Task<IActionResult> Recommend([FromBody] LibraryRecommendation request, CancellationToken cancellationToken)
    {
        if (!IsTeacherOrStaff()) return Forbid();
        var book = await dbContext.LibraryBooks.FirstOrDefaultAsync(b => b.Id == request.BookId, cancellationToken);
        if (book is null) return NotFound(new { message = "Kitap bulunamadı." });
        if (string.IsNullOrWhiteSpace(request.StudentName) && string.IsNullOrWhiteSpace(request.ClassName))
            return BadRequest(new { message = "Öğrenci veya sınıf seçin." });

        var recommendation = new LibraryRecommendation
        {
            BookId = book.Id,
            BookTitle = book.Title,
            TeacherName = CallerName,
            StudentName = request.StudentName?.Trim() ?? string.Empty,
            ClassName = request.ClassName?.Trim() ?? string.Empty,
            Note = request.Note ?? string.Empty,
        };
        dbContext.LibraryRecommendations.Add(recommendation);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(recommendation);
    }

    [HttpGet("recommendations")]
    public async Task<IActionResult> GetRecommendations(CancellationToken cancellationToken)
    {
        if (!IsTeacherOrStaff()) return Forbid();
        var caller = Normalize(CallerName);
        var items = (await dbContext.LibraryRecommendations.AsNoTracking()
                .OrderByDescending(r => r.CreatedAtUtc)
                .ToListAsync(cancellationToken))
            .Where(r => IsStaff() || Normalize(r.TeacherName) == caller);
        return Ok(items);
    }

    // ─── Öğrenci görünümü ────────────────────────────────────────────────
    [HttpGet("my")]
    public async Task<IActionResult> GetMy(CancellationToken cancellationToken)
    {
        var student = CallerName;
        if (string.IsNullOrWhiteSpace(student)) return Unauthorized();
        var normalized = Normalize(student);
        var now = DateTime.UtcNow;

        var loans = (await dbContext.LibraryLoans.AsNoTracking().ToListAsync(cancellationToken))
            .Where(l => Normalize(l.StudentName) == normalized)
            .OrderByDescending(l => l.LoanedAtUtc)
            .ToList();

        var reservations = (await dbContext.LibraryReservations.AsNoTracking().ToListAsync(cancellationToken))
            .Where(r => Normalize(r.StudentName) == normalized && (r.Status == "Bekliyor" || r.Status == "Hazır"))
            .ToList();

        // Kuyruk pozisyonu
        var allWaiting = await dbContext.LibraryReservations.AsNoTracking()
            .Where(r => r.Status == "Bekliyor")
            .ToListAsync(cancellationToken);

        // Öğrencinin sınıfına/kendisine yapılan öneriler
        var className = (await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken))
            .FirstOrDefault(s => Normalize(s.FullName) == normalized)?.ClassName ?? string.Empty;
        var recommendations = (await dbContext.LibraryRecommendations.AsNoTracking()
                .OrderByDescending(r => r.CreatedAtUtc)
                .ToListAsync(cancellationToken))
            .Where(r => Normalize(r.StudentName) == normalized
                || (!string.IsNullOrWhiteSpace(r.ClassName) && Normalize(r.ClassName) == Normalize(className)))
            .Take(10)
            .ToList();

        return Ok(new
        {
            activeLoans = loans.Where(l => l.ReturnedAtUtc == null).Select(l => new
            {
                l.Id, l.BookTitle, l.LoanedAtUtc, l.DueAtUtc, l.ExtensionCount,
                overdue = l.DueAtUtc < now,
            }),
            history = loans.Where(l => l.ReturnedAtUtc != null).Take(30),
            readCount = loans.Count(l => l.ReturnedAtUtc != null),
            reservations = reservations.Select(r => new
            {
                r.Id, r.BookTitle, r.Status, r.CreatedAtUtc,
                queuePosition = r.Status == "Hazır" ? 0
                    : allWaiting.Where(w => w.BookId == r.BookId && w.CreatedAtUtc <= r.CreatedAtUtc).Count(),
            }),
            recommendations = recommendations.Select(r => new
            {
                r.BookId, r.BookTitle, r.TeacherName, r.Note, r.CreatedAtUtc,
            }),
        });
    }

    // ─── Veli görünümü ───────────────────────────────────────────────────
    [HttpGet("parent/children")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> GetParentChildren(CancellationToken cancellationToken)
    {
        var callerName = Normalize(CallerName);
        var username = Normalize(User.FindFirstValue(ClaimTypes.NameIdentifier));
        var children = (await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken))
            .Where(s => (!string.IsNullOrWhiteSpace(s.ParentName) && Normalize(s.ParentName).Contains(callerName)))
            .ToList();

        var loans = await dbContext.LibraryLoans.AsNoTracking().ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;

        return Ok(children.Select(child =>
        {
            var childKey = Normalize(child.FullName);
            var childLoans = loans.Where(l => Normalize(l.StudentName) == childKey).ToList();
            return new
            {
                studentName = child.FullName,
                className = child.ClassName,
                readCount = childLoans.Count(l => l.ReturnedAtUtc != null),
                activeLoans = childLoans.Where(l => l.ReturnedAtUtc == null).Select(l => new
                {
                    l.BookTitle, l.DueAtUtc, overdue = l.DueAtUtc < now,
                }),
            };
        }));
    }

    // ─── İstatistik & ayarlar ────────────────────────────────────────────
    [HttpGet("stats")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        var books = await dbContext.LibraryBooks.AsNoTracking().ToListAsync(cancellationToken);
        var loans = await dbContext.LibraryLoans.AsNoTracking().ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var active = loans.Where(l => l.ReturnedAtUtc == null).ToList();

        return Ok(new
        {
            totalBooks = books.Count,
            totalCopies = books.Sum(b => b.TotalCopies),
            activeLoans = active.Count,
            overdueLoans = active.Count(l => l.DueAtUtc < now),
            totalLoans = loans.Count,
            distinctReaders = loans.Select(l => Normalize(l.StudentName)).Distinct().Count(),
            topBooks = loans.GroupBy(l => l.BookTitle)
                .Select(g => new { title = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count).Take(10),
            topReaders = loans.Where(l => l.ReturnedAtUtc != null)
                .GroupBy(l => l.StudentName)
                .Select(g => new { student = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count).Take(10),
            categoryDistribution = books.GroupBy(b => string.IsNullOrWhiteSpace(b.Category) ? "Diğer" : b.Category)
                .Select(g => new { category = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count),
            monthlyLoans = loans.GroupBy(l => l.LoanedAtUtc.ToString("yyyy-MM"))
                .Select(g => new { month = g.Key, count = g.Count() })
                .OrderBy(x => x.month),
        });
    }

    [HttpGet("settings")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
        => Ok(await GetSettingsAsync(cancellationToken));

    [HttpPut("settings")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> SaveSettings([FromBody] LibrarySettings request, CancellationToken cancellationToken)
    {
        var settings = await GetSettingsAsync(cancellationToken);
        settings.LoanDays = Math.Clamp(request.LoanDays, 1, 90);
        settings.MaxActiveLoans = Math.Clamp(request.MaxActiveLoans, 1, 20);
        settings.MaxExtensions = Math.Clamp(request.MaxExtensions, 0, 5);
        settings.ExtensionDays = Math.Clamp(request.ExtensionDays, 1, 30);
        settings.FinePerDay = Math.Max(0, request.FinePerDay);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(settings);
    }
}
