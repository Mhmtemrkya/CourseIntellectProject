namespace CourseIntellect.Application.Interfaces;

/// <summary>RulesActive: kurumda en az bir etkin kural var mı (varsa genel gecikme hatırlatması yerine kurallar çalışır).</summary>
public sealed record OverdueRuleRunResult(bool RulesActive, int Sent);

public interface IOverdueRuleReminderService
{
    Task<OverdueRuleRunResult> RunAsync(CancellationToken cancellationToken = default);
}
