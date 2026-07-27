using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ModelBinding.Binders;

namespace CourseIntellect.Api.Middleware;

/// <summary>
/// Sorgu/rota/form üzerinden gelen <see cref="DateTime"/> değerlerini UTC'ye sabitler.
/// </summary>
/// <remarks>
/// PostgreSQL sütunları <c>timestamp with time zone</c>; Npgsql'e <c>Kind=Unspecified</c>
/// bir DateTime verilirse sorgu çalışma anında patlar ve uç nokta 500 döner.
/// "2026-07-27T00:00:00" (Z'siz) gönderen her istemci bu hataya düşüyordu. Bağlama
/// katmanında normalize edilir; böylece tek tek uç noktalarda tekrar etmeye gerek kalmaz.
/// </remarks>
public sealed class UtcDateTimeModelBinder(IModelBinder inner) : IModelBinder
{
    public async Task BindModelAsync(ModelBindingContext bindingContext)
    {
        ArgumentNullException.ThrowIfNull(bindingContext);
        await inner.BindModelAsync(bindingContext);

        if (!bindingContext.Result.IsModelSet || bindingContext.Result.Model is not DateTime value) return;

        bindingContext.Result = ModelBindingResult.Success(value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        });
    }
}

/// <summary>DateTime ve DateTime? bağlamalarını <see cref="UtcDateTimeModelBinder"/> ile sarar.</summary>
public sealed class UtcDateTimeModelBinderProvider : IModelBinderProvider
{
    public IModelBinder? GetBinder(ModelBinderProviderContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var type = Nullable.GetUnderlyingType(context.Metadata.ModelType) ?? context.Metadata.ModelType;
        if (type != typeof(DateTime)) return null;

        // Çerçevenin kendi dönüştürücüsü değeri üretir; biz yalnız Kind'ını sabitleriz.
        return new UtcDateTimeModelBinder(new SimpleTypeModelBinder(context.Metadata.ModelType, context.Services.GetRequiredService<ILoggerFactory>()));
    }
}
