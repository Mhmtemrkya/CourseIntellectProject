using System.Security.Cryptography;
using CourseIntellect.Application.Interfaces;
using FaceAiSharp;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Fotoğrafları ağ dışına çıkarmadan yerel ONNX modeliyle denetler.</summary>
public sealed class DrivingPhotoInspectionService : IDrivingPhotoInspectionService, IDisposable
{
    private const int MaxSourceBytes = 10 * 1024 * 1024;
    private const long MaxPixels = 40_000_000;
    private const int TargetWidth = 600;
    private const int TargetHeight = 800;
    private const string Version = "photo-quality-1.0";
    private readonly IFaceDetector _detector = FaceAiSharpBundleFactory.CreateFaceDetector();
    private readonly SemaphoreSlim _detectorLock = new(1, 1);

    public async Task<DrivingPhotoAnalysisResult> AnalyzeAsync(byte[] source, string fileName, DateTime uploadedAtUtc, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(source);
        if (source.Length is 0 or > MaxSourceBytes)
            throw new InvalidDataException("Fotoğraf boş veya güvenli 10 MB sınırını aşıyor.");

        var checks = new List<DrivingPhotoCheckResult>();
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        Add("fileType", "Dosya türü", extension is ".jpg" or ".jpeg" or ".png" ? "Green" : "Red",
            extension is ".jpg" or ".jpeg" or ".png" ? "Kaynak JPG/JPEG/PNG formatında." : "Yalnız JPG, JPEG ve PNG kabul edilir.");
        Add("fileSize", "Dosya boyutu", source.Length > 5 * 1024 * 1024 ? "Orange" : "Green",
            source.Length > 5 * 1024 * 1024 ? $"Kaynak {source.Length / 1024d / 1024d:F1} MB; personel kontrolü gerekir." : $"Kaynak {source.Length / 1024d:F0} KB ve güvenli sınırlar içinde.");

        Image<Rgb24> image;
        try
        {
            image = Image.Load<Rgb24>(new DecoderOptions { MaxFrames = 1 }, source);
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
        {
            throw new InvalidDataException("Dosya geçerli ve desteklenen bir fotoğraf değil.", ex);
        }

        using (image)
        {
            image.Mutate(x => x.AutoOrient());
            if ((long)image.Width * image.Height > MaxPixels)
                throw new InvalidDataException("Fotoğraf açıldığında güvenli 40 megapiksel sınırını aşıyor.");

            var width = image.Width;
            var height = image.Height;
            var ratio = width / (double)height;
            Add("resolution", "Çözünürlük", width < 480 || height < 600 ? "Red" : width < TargetWidth || height < TargetHeight ? "Yellow" : "Green",
                width < 480 || height < 600 ? $"{width}×{height}; en az 480×600 olmalı." : $"Kaynak çözünürlüğü {width}×{height}.");
            Add("aspectRatio", "En-boy oranı", Math.Abs(ratio - .75) <= .04 ? "Green" : Math.Abs(ratio - .75) <= .18 ? "Yellow" : "Orange",
                $"En-boy oranı {ratio:F2}; MEBBİS kopyası 3:4 oranında hazırlanacak.");

            var age = DateTime.UtcNow - uploadedAtUtc.ToUniversalTime();
            Add("recency", "Fotoğraf güncelliği", age > TimeSpan.FromDays(183) ? "Red" : age > TimeSpan.FromDays(150) ? "Yellow" : "Green",
                age > TimeSpan.FromDays(183) ? "Fotoğraf altı aydan eski; güncel fotoğraf yüklenmeli." : $"Fotoğraf yaklaşık {Math.Max(0, (int)age.TotalDays)} günlük.");

            using var sample = image.Clone(x => x.Resize(new ResizeOptions { Size = new Size(128, 128), Mode = ResizeMode.Stretch }));
            var (brightness, backgroundUniformity) = MeasureQuality(sample);
            var brightnessSeverity = brightness < 45 || brightness > 220 ? "Red" : brightness < 65 || brightness > 200 ? "Orange" : "Green";
            Add("brightness", "Işık dengesi", brightnessSeverity, $"Ortalama parlaklık {brightness:F0}/255; fotoğraf {(brightness < 65 ? "karanlık" : brightness > 200 ? "fazla aydınlık" : "dengeli")}.");
            var backgroundSeverity = backgroundUniformity < .45 ? "Orange" : backgroundUniformity < .68 ? "Yellow" : "Green";
            Add("background", "Arka plan uygunluğu", backgroundSeverity,
                backgroundSeverity == "Green" ? $"Kenar örneklerinde arka plan homojenliği %{backgroundUniformity * 100:F0}." : $"Arka plan homojenliği %{backgroundUniformity * 100:F0}; düz ve açık arka plan personelce doğrulanmalı.");

            IReadOnlyCollection<FaceDetectorResult> faces;
            await _detectorLock.WaitAsync(cancellationToken);
            try { faces = _detector.DetectFaces(image).ToArray(); }
            finally { _detectorLock.Release(); }

            Add("faceCount", "Yüz sayısı", faces.Count == 1 ? "Green" : "Red",
                faces.Count == 0 ? "Fotoğrafta güvenilir bir yüz bulunamadı." : faces.Count == 1 ? "Fotoğrafta tek yüz bulundu." : $"Fotoğrafta {faces.Count} yüz bulundu; biyometrik fotoğrafta tek kişi olmalı.");

            FaceDetectorResult? mainFace = faces.Count == 0 ? null : faces.OrderByDescending(x => x.Confidence).First();
            if (mainFace is { } detectedFace)
            {
                var box = detectedFace.Box;
                var areaRatio = box.Width * box.Height / (double)(width * height);
                var centerDeviation = Math.Abs(box.Left + box.Width / 2d - width / 2d) / width;
                var placementSeverity = areaRatio is < .08 or > .65 || centerDeviation > .22 ? "Orange" : areaRatio is < .14 or > .55 || centerDeviation > .12 ? "Yellow" : "Green";
                Add("facePlacement", "Yüz konumu ve boyutu", placementSeverity,
                    $"Yüz alanı fotoğrafın %{areaRatio * 100:F0}'i, yatay merkez sapması %{centerDeviation * 100:F0}.");
            }
            else Add("facePlacement", "Yüz konumu ve boyutu", "Red", "Yüz bulunamadığı için konum denetlenemedi.");

            byte[]? converted = null;
            if (faces.Count == 1 && !checks.Any(x => x.Severity == "Red" && x.Key is "fileType" or "resolution" or "recency" or "brightness"))
            {
                using var output = CreateMebbisCopy(image, mainFace!.Value.Box);
                output.Metadata.ExifProfile = null;
                output.Metadata.IptcProfile = null;
                output.Metadata.XmpProfile = null;
                await using var buffer = new MemoryStream();
                await output.SaveAsJpegAsync(buffer, new JpegEncoder { Quality = 90 }, cancellationToken);
                converted = buffer.ToArray();
                Add("mebbisCopy", "MEBBİS kopyası", "Green", $"600×800 JPEG, {converted.Length / 1024d:F0} KB; EXIF/GPS metadatası temizlendi.");
            }
            else Add("mebbisCopy", "MEBBİS kopyası", "Red", "Engelleyici kalite sorunları çözülmeden dönüştürülmüş kopya üretilmedi.");

            var overall = checks.Any(x => x.Severity == "Red") ? "Red" : checks.Any(x => x.Severity == "Orange") ? "Orange" : checks.Any(x => x.Severity == "Yellow") ? "Yellow" : "Green";
            return new DrivingPhotoAnalysisResult(overall, checks, Convert.ToHexString(SHA256.HashData(source)).ToLowerInvariant(), source.LongLength,
                width, height, faces.Count, mainFace?.Confidence, brightness, backgroundUniformity, converted,
                converted is null ? null : TargetWidth, converted is null ? null : TargetHeight, Version);
        }

        void Add(string key, string title, string severity, string message) => checks.Add(new(key, title, severity, message));
    }

    private static Image<Rgb24> CreateMebbisCopy(Image<Rgb24> source, RectangleF face)
    {
        const double targetRatio = TargetWidth / (double)TargetHeight;
        int cropWidth, cropHeight;
        if (source.Width / (double)source.Height > targetRatio) { cropHeight = source.Height; cropWidth = (int)Math.Round(cropHeight * targetRatio); }
        else { cropWidth = source.Width; cropHeight = (int)Math.Round(cropWidth / targetRatio); }
        var faceCenterX = face.Left + face.Width / 2d;
        var faceCenterY = face.Top + face.Height / 2d;
        var left = Math.Clamp((int)Math.Round(faceCenterX - cropWidth / 2d), 0, source.Width - cropWidth);
        var top = Math.Clamp((int)Math.Round(faceCenterY - cropHeight * .42), 0, source.Height - cropHeight);
        return source.Clone(x => x.Crop(new Rectangle(left, top, cropWidth, cropHeight)).Resize(TargetWidth, TargetHeight));
    }

    private static (double Brightness, double Uniformity) MeasureQuality(Image<Rgb24> sample)
    {
        double lumSum = 0, borderLum = 0, borderLumSq = 0, borderSat = 0;
        var pixels = 0; var borderPixels = 0;
        sample.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < accessor.Height; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < row.Length; x++)
                {
                    var p = row[x]; var lum = .2126 * p.R + .7152 * p.G + .0722 * p.B;
                    lumSum += lum; pixels++;
                    if (x < 14 || x >= row.Length - 14 || y < 14)
                    {
                        var max = Math.Max(p.R, Math.Max(p.G, p.B)); var min = Math.Min(p.R, Math.Min(p.G, p.B));
                        var sat = max == 0 ? 0 : (max - min) / (double)max;
                        borderLum += lum; borderLumSq += lum * lum; borderSat += sat; borderPixels++;
                    }
                }
            }
        });
        var mean = borderLum / borderPixels;
        var stdDev = Math.Sqrt(Math.Max(0, borderLumSq / borderPixels - mean * mean));
        var varianceScore = 1 - Math.Min(1, stdDev / 55d);
        var saturationScore = 1 - Math.Min(1, borderSat / borderPixels / .45d);
        var lightScore = Math.Clamp((mean - 80) / 100d, 0, 1);
        return (lumSum / pixels, Math.Clamp(varianceScore * .55 + saturationScore * .25 + lightScore * .20, 0, 1));
    }

    public void Dispose()
    {
        (_detector as IDisposable)?.Dispose();
        _detectorLock.Dispose();
    }
}
