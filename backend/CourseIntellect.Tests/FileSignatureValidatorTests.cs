using System.Text;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class FileSignatureValidatorTests
{
    private static byte[] Ascii(string text) => Encoding.ASCII.GetBytes(text);

    [Theory]
    [InlineData(".pdf", "%PDF-1.7\n")]
    [InlineData(".gif", "GIF89a....")]
    [InlineData(".csv", "ad,soyad\nAli,Kaya\n")]
    [InlineData(".svg", "<svg xmlns='http://www.w3.org/2000/svg'></svg>")]
    [InlineData(".mp4", "\0\0\0\u0018ftypmp42")]
    public void ValidContent_IsAccepted(string extension, string content)
        => Assert.True(FileSignatureValidator.Matches(extension, Ascii(content)));

    [Fact]
    public void BinaryImages_AreRecognized()
    {
        Assert.True(FileSignatureValidator.Matches(".png", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]));
        Assert.True(FileSignatureValidator.Matches(".jpg", [0xFF, 0xD8, 0xFF, 0xE0]));
        Assert.True(FileSignatureValidator.Matches(".docx", [0x50, 0x4B, 0x03, 0x04, 0x14]));
    }

    [Theory]
    [InlineData(".pdf", "MZ\u0090\0 this is an exe")]      // PE yürütülebilir .pdf adıyla
    [InlineData(".png", "<html><script>alert(1)</script>")] // HTML .png adıyla
    [InlineData(".jpg", "%PDF-1.4")]                        // tür karışıklığı
    [InlineData(".exe", "MZ")]                              // listede olmayan uzantı
    public void MismatchedContent_IsRejected(string extension, string content)
        => Assert.False(FileSignatureValidator.Matches(extension, Ascii(content)));

    [Fact]
    public void TextTypes_RejectBinaryContent()
        => Assert.False(FileSignatureValidator.Matches(".csv", [0x41, 0x00, 0x42]));
}
