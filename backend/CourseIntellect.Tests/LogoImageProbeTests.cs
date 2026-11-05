using CourseIntellect.Api.Security;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace CourseIntellect.Tests;

public sealed class LogoImageProbeTests
{
    private static byte[] Encode(Action<Image<Rgba32>, MemoryStream> save)
    {
        using var image = new Image<Rgba32>(64, 32);
        using var stream = new MemoryStream();
        save(image, stream);
        return stream.ToArray();
    }

    [Fact]
    public void ReadsPngJpegAndWebpSize()
    {
        foreach (var bytes in new[]
                 {
                     Encode((image, s) => image.SaveAsPng(s)),
                     Encode((image, s) => image.SaveAsJpeg(s)),
                     Encode((image, s) => image.SaveAsWebp(s)),
                 })
        {
            var info = LogoImageProbe.Identify(bytes);
            Assert.NotNull(info);
            Assert.Equal((64, 32), (info.Width, info.Height));
        }
    }

    [Fact]
    public void RejectsTiffGifAndGarbage()
    {
        Assert.Null(LogoImageProbe.Identify(Encode((image, s) => image.SaveAsTiff(s))));
        Assert.Null(LogoImageProbe.Identify(Encode((image, s) => image.SaveAsGif(s))));
        Assert.Null(LogoImageProbe.Identify([1, 2, 3, 4, 5]));
    }
}
