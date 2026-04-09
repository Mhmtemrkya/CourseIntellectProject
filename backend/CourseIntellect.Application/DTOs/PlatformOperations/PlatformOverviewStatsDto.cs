namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record PlatformOverviewStatsDto(
    int TotalTenants,
    int ActiveTenants,
    int TotalUsers,
    decimal MonthlyRevenue,
    decimal PendingPayments,
    decimal OverduePayments,
    decimal StorageUsedGb,
    int ApiCalls,
    int OpenTickets,
    int InvoiceCount,
    int AiRequestCount,
    decimal AiSuccessRate,
    decimal AiAverageResponseSeconds,
    decimal AiEstimatedCost
);
