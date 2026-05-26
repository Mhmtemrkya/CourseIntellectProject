using CourseIntellect.Application.Interfaces;

namespace CourseIntellect.Infrastructure.Services;

public sealed class BasicETAService : IETAService
{
    public double CalculateDistanceKm(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude)
    {
        return HaversineKm(fromLatitude, fromLongitude, toLatitude, toLongitude);
    }

    public int CalculateEtaMinutes(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude, double? speedKmh)
    {
        var distanceKm = CalculateDistanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude);
        var effectiveSpeed = speedKmh.HasValue && speedKmh.Value > 1 ? speedKmh.Value : 30;
        return Math.Max(1, (int)Math.Ceiling(distanceKm / effectiveSpeed * 60));
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusKm = 6371;
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return earthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;
}
