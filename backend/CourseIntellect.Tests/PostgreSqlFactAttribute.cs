namespace CourseIntellect.Tests;

/// <summary>Reports unavailable provider tests as skipped during discovery.</summary>
public sealed class PostgreSqlFactAttribute : Xunit.FactAttribute
{
    public PostgreSqlFactAttribute(string connectionVariable)
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(connectionVariable)))
            Skip = $"{connectionVariable} is required for an isolated PostgreSQL test database.";
    }
}
