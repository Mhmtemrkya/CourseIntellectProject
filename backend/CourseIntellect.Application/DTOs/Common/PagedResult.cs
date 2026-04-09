namespace CourseIntellect.Application.DTOs.Common;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    PaginationInfo Pagination
);

public sealed record PaginationInfo(
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages
);
