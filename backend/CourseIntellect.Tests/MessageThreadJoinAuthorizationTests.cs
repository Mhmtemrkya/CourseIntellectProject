using CourseIntellect.Api.Hubs;
using Xunit;

namespace CourseIntellect.Tests;

/// <summary>
/// Thread gruplarına katılım DEĞİŞMEZ kullanıcı kimliğiyle kontrol edilir.
/// Eskiden ad eşleşmesi yetki kapısıydı: aynı kurumda adı katılımcıyla çakışan
/// yabancı bir kullanıcı, thread GUID'ini bilirse mesajları alabiliyordu.
/// </summary>
public sealed class MessageThreadJoinAuthorizationTests
{
    private static readonly Guid Owner = Guid.NewGuid();
    private static readonly Guid Stranger = Guid.NewGuid();
    private static readonly Guid Other = Guid.NewGuid();

    [Fact]
    public void Participant_by_id_can_join()
    {
        Assert.True(MessagesHub.IsThreadParticipant(
            Owner, ["ali yilmaz"], Owner, Other, "Ali Yılmaz", "Veli Ayşe"));
    }

    [Fact]
    public void Same_name_different_id_cannot_join()
    {
        // Yabancı kullanıcı adı katılımcıyla aynı olsa da ID uyuşmuyor → reddedilir.
        Assert.False(MessagesHub.IsThreadParticipant(
            Stranger, ["ali yilmaz"], Owner, Other, "Ali Yılmaz", "Veli Ayşe"));
    }

    [Fact]
    public void Id_less_caller_cannot_join_id_based_thread()
    {
        Assert.False(MessagesHub.IsThreadParticipant(
            null, ["ali yilmaz"], Owner, Other, "Ali Yılmaz", "Veli Ayşe"));
    }

    [Fact]
    public void Legacy_null_id_thread_falls_back_to_name()
    {
        // Her iki ID de null olan eski kayıtta ad eşleşmesine düşülür.
        Assert.True(MessagesHub.IsThreadParticipant(
            Stranger, ["ali yilmaz"], null, null, "Ali Yılmaz", "Veli Ayşe"));
        Assert.False(MessagesHub.IsThreadParticipant(
            Stranger, ["yabanci kisi"], null, null, "Ali Yılmaz", "Veli Ayşe"));
    }
}
