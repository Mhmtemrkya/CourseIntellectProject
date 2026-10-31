using System.Text.RegularExpressions;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Yardım makalelerinin yönlendirdiği her sayfa (1) masaüstü uygulamada gerçekten tanımlı
/// bir rota ve (2) o portalın menüsünde (ya da menüdeki bir sayfanın alt sayfası) olmalı.
/// Aksi hâlde asistan bir rolü açamayacağı bir sayfaya yollar. Kaynak: App.tsx ve ModernSidebar.tsx.
/// </summary>
public sealed class AssistantHelpCatalogTests
{
    private static readonly Dictionary<string, string> MenuKeyOfPortal = new()
    {
        ["admin"] = "admin", ["administrative"] = "administrative", ["accounting"] = "finance",
        ["teacher"] = "teacher", ["student"] = "student", ["parent"] = "parent",
    };

    private static string RepoFile(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "desktop"))) dir = dir.Parent;
        return dir is null ? string.Empty : Path.Combine(dir.FullName, relative);
    }

    [Fact]
    public void EveryArticleRoute_ExistsInAppAndPortalMenu()
    {
        var appPath = RepoFile("desktop/src/App.tsx");
        var sidebarPath = RepoFile("desktop/src/components/layout/ModernSidebar.tsx");
        if (!File.Exists(appPath) || !File.Exists(sidebarPath)) return; // yalnız backend kopyası (CI imajı) — kontrol atlanır

        var routes = Regex.Matches(File.ReadAllText(appPath), "Route path=\"([^\"]+)\"").Select(match => match.Groups[1].Value).ToHashSet();
        var sidebar = File.ReadAllText(sidebarPath);
        var financeItems = Regex.Match(sidebar, @"FINANCE_MENU_ITEMS[^=]*=\s*\[(.*?)\n\];", RegexOptions.Singleline).Groups[1].Value;
        var configs = sidebar[sidebar.IndexOf("export const menuConfigs", StringComparison.Ordinal)..sidebar.IndexOf("export const ROLE_LABELS", StringComparison.Ordinal)];

        var problems = new List<string>();
        foreach (var article in AssistantHelpCatalog.Articles)
        {
            foreach (var (portal, route) in article.Routes)
            {
                if (!routes.Contains(route)) { problems.Add($"{article.Id}/{portal}: {route} uygulamada yok"); continue; }
                var block = Regex.Match(configs, $@"\n  {MenuKeyOfPortal[portal]}: \[(.*?)\n  \],", RegexOptions.Singleline).Groups[1].Value;
                if (block.Contains("...FINANCE_MENU_ITEMS", StringComparison.Ordinal)) block += financeItems;
                var menu = Regex.Matches(block, "path: \"([^\"]+)\"").Select(match => match.Groups[1].Value).ToList();
                if (!menu.Any(path => path == route || route.StartsWith(path + "/", StringComparison.Ordinal)))
                {
                    problems.Add($"{article.Id}/{portal}: {route} bu portalın menüsünde yok");
                }
            }
        }
        Assert.True(problems.Count == 0, string.Join("\n", problems));
    }

    [Theory]
    [InlineData("optik deneme nasil yuklenir", "teacher", "optical-import", false)]
    [InlineData("kulup nasil acilir", "admin", "club-create", false)]
    [InlineData("kulube nasil katilirim", "student", "club-join", false)]
    [InlineData("ziyaretci kaydi nasil yapilir", "administrative", "visitor-log", false)]
    // Öğrenci tahsilat soruyor: makale var ama onun portalında değil.
    [InlineData("tahsilat nasil alinir", "student", "collection", true)]
    public void Match_PrefersOwnPortal(string text, string portal, string expectedId, bool otherPortal)
    {
        var (article, other) = AssistantHelpCatalog.Match(text, portal);
        Assert.Equal(expectedId, article?.Id);
        Assert.Equal(otherPortal, other);
    }
}
