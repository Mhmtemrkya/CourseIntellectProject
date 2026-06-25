namespace CourseIntellect.Application.DTOs.Analytics;

public sealed record AdminAnalyticsBucket(
    string Start,
    string Label,
    decimal Revenue,
    int Registrations,
    decimal Expense);

public sealed record AdminAnalyticsTotals(
    decimal Revenue,
    int Registrations,
    decimal Expense,
    decimal Net);

public sealed record AdminAnalyticsResponse(
    string Period,
    string RangeStart,
    string RangeEnd,
    IReadOnlyList<AdminAnalyticsBucket> Buckets,
    AdminAnalyticsTotals Totals);
