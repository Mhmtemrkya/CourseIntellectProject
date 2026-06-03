using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

public static class UploadStoragePathResolver
{
    public static string ResolveUploadsRoot(IHostEnvironment environment, IConfiguration configuration)
    {
        var configuredRoot = configuration["Uploads:RootPath"]
            ?? Environment.GetEnvironmentVariable("COURSE_INTELLECT_UPLOADS_ROOT");

        if (!string.IsNullOrWhiteSpace(configuredRoot))
        {
            return Path.GetFullPath(configuredRoot);
        }

        var contentRoot = Path.GetFullPath(environment.ContentRootPath);
        var currentDirectory = new DirectoryInfo(contentRoot);

        if (currentDirectory.Name.Equals("current", StringComparison.OrdinalIgnoreCase)
            && currentDirectory.Parent is not null)
        {
            return Path.GetFullPath(Path.Combine(currentDirectory.Parent.FullName, "shared", "uploads"));
        }

        if (currentDirectory.Parent?.Name.Equals("releases", StringComparison.OrdinalIgnoreCase) == true
            && currentDirectory.Parent.Parent is not null)
        {
            return Path.GetFullPath(Path.Combine(currentDirectory.Parent.Parent.FullName, "shared", "uploads"));
        }

        return Path.GetFullPath(Path.Combine(contentRoot, "wwwroot", "uploads"));
    }

    public static void CopyReleaseUploadsToShared(IHostEnvironment environment, IConfiguration configuration, ILogger logger)
    {
        var uploadsRoot = ResolveUploadsRoot(environment, configuration);
        var contentRoot = Path.GetFullPath(environment.ContentRootPath);
        var releaseLocalUploads = Path.GetFullPath(Path.Combine(contentRoot, "wwwroot", "uploads"));

        if (PathsEqual(uploadsRoot, releaseLocalUploads))
        {
            return;
        }

        var candidates = ResolveReleaseUploadCandidates(contentRoot)
            .Append(releaseLocalUploads)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(path => Directory.Exists(path) && !PathsEqual(path, uploadsRoot))
            .ToArray();

        foreach (var candidate in candidates)
        {
            try
            {
                CopyDirectory(candidate, uploadsRoot);
                logger.LogInformation("Release-local uploads copied to shared uploads root. Source={Source}, Target={Target}", candidate, uploadsRoot);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Release-local uploads could not be copied to shared uploads root. Source={Source}, Target={Target}", candidate, uploadsRoot);
            }
        }
    }

    private static IEnumerable<string> ResolveReleaseUploadCandidates(string contentRoot)
    {
        var currentDirectory = new DirectoryInfo(contentRoot);
        DirectoryInfo? releasesDirectory = null;

        if (currentDirectory.Parent?.Name.Equals("releases", StringComparison.OrdinalIgnoreCase) == true)
        {
            releasesDirectory = currentDirectory.Parent;
        }
        else if (currentDirectory.Name.Equals("current", StringComparison.OrdinalIgnoreCase)
                 && currentDirectory.Parent is not null)
        {
            var siblingReleases = Path.Combine(currentDirectory.Parent.FullName, "releases");
            if (Directory.Exists(siblingReleases))
            {
                releasesDirectory = new DirectoryInfo(siblingReleases);
            }
        }

        if (releasesDirectory is null || !releasesDirectory.Exists)
        {
            yield break;
        }

        foreach (var release in releasesDirectory.EnumerateDirectories())
        {
            yield return Path.Combine(release.FullName, "wwwroot", "uploads");
        }
    }

    private static void CopyDirectory(string sourceDirectory, string targetDirectory)
    {
        Directory.CreateDirectory(targetDirectory);

        foreach (var directory in Directory.EnumerateDirectories(sourceDirectory, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(sourceDirectory, directory);
            Directory.CreateDirectory(Path.Combine(targetDirectory, relative));
        }

        foreach (var file in Directory.EnumerateFiles(sourceDirectory, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(sourceDirectory, file);
            var target = Path.Combine(targetDirectory, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            if (!File.Exists(target))
            {
                File.Copy(file, target);
            }
        }
    }

    private static bool PathsEqual(string left, string right)
        => string.Equals(
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(left)),
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(right)),
            StringComparison.OrdinalIgnoreCase);
}
