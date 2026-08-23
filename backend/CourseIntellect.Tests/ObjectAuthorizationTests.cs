using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.DTOs.QuestionThreads;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Services;
using Xunit;

namespace CourseIntellect.Tests;

/// <summary>
/// Nesne düzeyi yetkilendirme (BOLA).
///
/// Değişmez kural: bir kaynağın KİMLİĞİNİ bilmek, o kaynağa erişim hakkı vermez.
/// Aynı kurumdaki bir kullanıcı, tahmin ettiği/gördüğü bir GUID ile yabancı bir
/// mesaj thread'ine yazamaz, yabancı bir soru thread'ine yanıt verip içeriğini
/// okuyamaz. Okuma tarafında bu kontroller vardı; yazma tarafında yoktu.
/// </summary>
public sealed class ObjectAuthorizationTests : IDisposable
{
    private readonly TestDb db = new();

    public void Dispose() => db.Dispose();

    // ── Mesajlaşma: yabancı thread'e mesaj gönderilemez (#13) ────────────────

    private MessageService Messages => new(db.Context, new NoopMessageRealtime(), new NoopPush());

    private async Task<MessageThread> SeedThreadAsync()
    {
        var thread = new MessageThread
        {
            ParticipantOneName = "Ada Yilmaz",
            ParticipantOneRole = "Student",
            ParticipantTwoName = "Mehmet Ogretmen",
            ParticipantTwoRole = "Teacher",
            LastMessagePreview = "merhaba",
            LastMessageAtUtc = DateTime.UtcNow,
        };
        db.Context.MessageThreads.Add(thread);
        await db.Context.SaveChangesAsync();
        return thread;
    }

    [Fact]
    public async Task SendMessage_ByParticipant_Succeeds()
    {
        var thread = await SeedThreadAsync();

        var item = await Messages.SendMessageAsync(
            Guid.NewGuid(), "Ada Yılmaz", "Student", thread.Id,
            new SendMessageRequest("selam", null));

        Assert.Equal(thread.Id, item.ThreadId);
        Assert.Single(db.Context.MessageItems);
    }

    [Fact]
    public async Task SendMessage_ByStranger_IsRejected()
    {
        var thread = await SeedThreadAsync();

        // Yabancı, thread GUID'ini biliyor ama katılımcı değil.
        await Assert.ThrowsAsync<InvalidOperationException>(() => Messages.SendMessageAsync(
            Guid.NewGuid(), "Yabanci Kullanici", "Student", thread.Id,
            new SendMessageRequest("sizi dinliyorum", null)));

        Assert.Empty(db.Context.MessageItems);
    }

    [Fact]
    public async Task SendMessage_MatchesParticipant_AcrossTurkishCharacters()
    {
        // Kayıt "Ada Yilmaz" (katlanmış) tutulur; kullanıcının tokendaki adı
        // "Ada Yılmaz" olabilir. Hub ve servis AYNI normalizasyonu kullanmalı.
        var thread = await SeedThreadAsync();

        var item = await Messages.SendMessageAsync(
            Guid.NewGuid(), "  ada yılmaz  ", "Student", thread.Id,
            new SendMessageRequest("normalize", null));

        Assert.Equal(thread.Id, item.ThreadId);
    }

    [Fact]
    public void ParticipantKey_FoldsTurkishCharactersAndCase()
    {
        Assert.True(MessageParticipantKey.IsParticipant("Ada Yılmaz", "Ada Yilmaz", "Mehmet"));
        Assert.True(MessageParticipantKey.IsParticipant("MEHMET ÖĞRETMEN", "Ada", "Mehmet OGRETMEN"));
        Assert.False(MessageParticipantKey.IsParticipant("Yabancı", "Ada Yilmaz", "Mehmet"));
        Assert.False(MessageParticipantKey.IsParticipant("", "Ada Yilmaz", "Mehmet"));
        Assert.False(MessageParticipantKey.IsParticipant("   ", "Ada Yilmaz", "Mehmet"));
    }

    // ── Soru thread'leri: yabancı thread'e yanıt verilemez (#19) ─────────────

    private QuestionThreadService Questions => new(db.Context);

    private async Task<StudentQuestionThread> SeedQuestionThreadAsync()
    {
        var thread = new StudentQuestionThread
        {
            Title = "Türev sorusu",
            Subject = "Matematik",
            StudentName = "Ada Yılmaz",
            StudentUsername = "ada.yilmaz",
            TeacherName = "Mehmet Öğretmen",
            QuestionText = "Bu soruyu çözemedim.",
            Status = "Bekliyor",
            CreatedAtLabel = "01.01.2026",
            LastActivityLabel = "01.01.2026",
            AttachmentsSerialized = "[]",
        };
        db.Context.StudentQuestionThreads.Add(thread);
        await db.Context.SaveChangesAsync();
        return thread;
    }

    [Fact]
    public async Task Reply_ByOwningStudent_Succeeds()
    {
        var thread = await SeedQuestionThreadAsync();

        var result = await Questions.AddReplyAsync(
            thread.Id, "Ada Yılmaz", "Student", "ada.yilmaz",
            new CreateQuestionThreadReplyRequest("tekrar sorayım", null));

        Assert.NotNull(result);
        Assert.Single(db.Context.StudentQuestionReplies);
    }

    [Fact]
    public async Task Reply_ByAssignedTeacher_Succeeds()
    {
        var thread = await SeedQuestionThreadAsync();

        var result = await Questions.AddReplyAsync(
            thread.Id, "Mehmet Öğretmen", "Teacher", "mehmet.ogretmen",
            new CreateQuestionThreadReplyRequest("şöyle çözülür", null));

        Assert.NotNull(result);
        Assert.Equal("Yanıtlandı", db.Context.StudentQuestionThreads.Single().Status);
    }

    [Fact]
    public async Task Reply_ByOtherStudent_LeaksNothing()
    {
        var thread = await SeedQuestionThreadAsync();

        var result = await Questions.AddReplyAsync(
            thread.Id, "Yabancı Öğrenci", "Student", "yabanci.ogrenci",
            new CreateQuestionThreadReplyRequest("ben de göreyim", null));

        // null = "bulunamadı": soru metni, öğrenci adı, ekler ve yanıt geçmişi dönmez.
        Assert.Null(result);
        Assert.Empty(db.Context.StudentQuestionReplies);
    }

    [Fact]
    public async Task Reply_ByUnassignedTeacher_LeaksNothing()
    {
        var thread = await SeedQuestionThreadAsync();

        var result = await Questions.AddReplyAsync(
            thread.Id, "Başka Öğretmen", "Teacher", "baska.ogretmen",
            new CreateQuestionThreadReplyRequest("araya gireyim", null));

        Assert.Null(result);
        Assert.Empty(db.Context.StudentQuestionReplies);
    }

    [Fact]
    public async Task Reply_ByAdmin_Succeeds()
    {
        var thread = await SeedQuestionThreadAsync();

        var result = await Questions.AddReplyAsync(
            thread.Id, "Yönetici", "Admin", "yonetici",
            new CreateQuestionThreadReplyRequest("takip ediyorum", null));

        Assert.NotNull(result);
    }

    [Fact]
    public async Task Reply_ByUnknownRole_IsRejected()
    {
        // Tanınmayan rol hiçbir şey göremez — fail-closed.
        var thread = await SeedQuestionThreadAsync();

        var result = await Questions.AddReplyAsync(
            thread.Id, "Biri", "Veli", "biri",
            new CreateQuestionThreadReplyRequest("merak ettim", null));

        Assert.Null(result);
    }

    // ── Test ikizleri ────────────────────────────────────────────────────────

    private sealed class NoopMessageRealtime : IMessageRealtimeNotifier
    {
        public Task NotifyThreadUpdatedAsync(Guid threadId, IReadOnlyCollection<string> participantKeys, MessageThreadDto thread, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyMessageReceivedAsync(Guid threadId, IReadOnlyCollection<string> participantKeys, MessageItemDto message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyMessageStatusChangedAsync(Guid threadId, IReadOnlyCollection<string> participantKeys, MessageStatusChangedDto payload, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class NoopPush : IPushNotificationService
    {
        public bool IsConfigured => false;

        public Task SendToUserAsync(Guid userId, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SendToUserByNameAsync(string fullName, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SendToRoleAsync(string role, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }
}
