using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;

namespace CourseIntellect.Api.Security;

/// <summary>
/// Yüklenen logonun yalnız boyutunu okur. Üst veri (ICC profili dahil) atlanır ve yalnız PNG/JPEG/WebP
/// çözücüleri etkindir: ImageSharp 3.1.x'teki ICC CLUT bellek ayırma (GHSA-gwg2-r3hj-4w44) ve TIFF açıkları
/// bu yoldan tetiklenemez. Logo ucu kurum yöneticisine (herkese açık demo kurum dahil) açıktır.
/// </summary>
public static class LogoImageProbe
{
    private static readonly DecoderOptions Options = new()
    {
        SkipMetadata = true,
        Configuration = new Configuration(new PngConfigurationModule(), new JpegConfigurationModule(), new WebpConfigurationModule()),
    };

    /// <summary>Desteklenmeyen ya da bozuk dosyada null.</summary>
    public static ImageInfo? Identify(byte[] bytes)
    {
        try
        {
            return Image.Identify(Options, bytes);
        }
        catch (Exception exception) when (exception is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
        {
            return null;
        }
    }
}
