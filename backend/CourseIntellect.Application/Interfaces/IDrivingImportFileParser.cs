namespace CourseIntellect.Application.Interfaces;

public interface IDrivingImportFileParser
{
    Task<DrivingImportTable> ParseAsync(Stream stream, string fileName, CancellationToken cancellationToken = default);
}

public sealed record DrivingImportTable(IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyDictionary<string, string>> Rows);
