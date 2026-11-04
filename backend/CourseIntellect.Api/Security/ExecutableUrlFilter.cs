using System.Collections;
using System.Reflection;
using CourseIntellect.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CourseIntellect.Api.Security;

/// <summary>
/// Tüm isteklerde, adı Url/Link/Href/Uri ile biten metin alanlarında çalıştırılabilir adres
/// (javascript:, vbscript:, resim olmayan data:) varsa isteği 400 ile reddeder. Bu alanlar
/// istemcilerde bağlantı olarak çizilir (görüşme linki, alıştırma adresi, canlı ders linki…);
/// React 18 ve Flutter javascript: adresini engellemez, masaüstü webview'da kayıtlı XSS olurdu.
/// İstemciler de çizimde süzer; bu sunucu tarafı ilk savunma hattıdır.
/// </summary>
public sealed class ExecutableUrlFilter : IActionFilter
{
    private const int MaxDepth = 4;

    public void OnActionExecuting(ActionExecutingContext context)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            var problem = FindExecutableUrl(argument, "", 0);
            if (problem is not null)
            {
                context.Result = new BadRequestObjectResult(new
                {
                    message = $"Güvensiz bağlantı adresi ({problem}). javascript:, vbscript: ve resim olmayan data: adresleri kabul edilmez.",
                });
                return;
            }
        }
    }

    public void OnActionExecuted(ActionExecutedContext context)
    {
    }

    /// <summary>Çalıştırılabilir adres taşıyan ilk alanın yolunu döner; yoksa null.</summary>
    public static string? FindExecutableUrl(object? value, string path, int depth)
    {
        if (value is null || depth > MaxDepth) return null;
        var type = value.GetType();
        if (type.IsPrimitive || type.IsEnum || value is string || value is decimal || value is DateTime
            || value is DateTimeOffset || value is Guid || value is CancellationToken || value is IFormFile
            || value is IFormFileCollection || value is System.Text.Json.JsonElement || value is Stream)
        {
            return null;
        }

        if (value is IEnumerable sequence)
        {
            var index = 0;
            foreach (var item in sequence)
            {
                if (index >= 500) break;
                var found = FindExecutableUrl(item, $"{path}[{index++}]", depth + 1);
                if (found is not null) return found;
            }
            return null;
        }

        if (type.Namespace is null || !type.Namespace.StartsWith("CourseIntellect", StringComparison.Ordinal)) return null;

        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.GetIndexParameters().Length > 0) continue;
            var name = property.Name;
            var current = property.GetValue(value);
            var childPath = path.Length == 0 ? name : $"{path}.{name}";
            if (current is string text)
            {
                if (IsLinkName(name) && SafeUrlRules.IsExecutable(text)) return childPath;
                continue;
            }

            var found = FindExecutableUrl(current, childPath, depth + 1);
            if (found is not null) return found;
        }

        return null;
    }

    private static bool IsLinkName(string name) =>
        name.EndsWith("Url", StringComparison.OrdinalIgnoreCase)
        || name.EndsWith("Link", StringComparison.OrdinalIgnoreCase)
        || name.EndsWith("Href", StringComparison.OrdinalIgnoreCase)
        || name.EndsWith("Uri", StringComparison.OrdinalIgnoreCase);
}
