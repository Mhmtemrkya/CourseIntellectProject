using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingPhotoInspectionServiceTests
{
    [Fact]
    public async Task AnalyzeAsync_SolidImage_FindsNoFaceAndDoesNotCreateCopy()
    {
        var source = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        using var service = new DrivingPhotoInspectionService();

        var result = await service.AnalyzeAsync(source, "photo.png", DateTime.UtcNow);

        Assert.Equal("Red", result.Overall);
        Assert.Equal(0, result.FaceCount);
        Assert.Null(result.MebbisJpeg);
        Assert.Contains(result.Checks, x => x.Key == "faceCount" && x.Severity == "Red");
        Assert.Equal(64, result.SourceSha256.Length);
    }

    [Fact]
    public async Task AnalyzeAsync_InvalidContent_IsRejected()
    {
        using var service = new DrivingPhotoInspectionService();
        await Assert.ThrowsAsync<InvalidDataException>(() => service.AnalyzeAsync([1, 2, 3, 4], "photo.jpg", DateTime.UtcNow));
    }
}
