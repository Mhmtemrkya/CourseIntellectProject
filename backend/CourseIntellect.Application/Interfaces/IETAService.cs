namespace CourseIntellect.Application.Interfaces;

public interface IETAService
{
    double CalculateDistanceKm(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude);
    int CalculateEtaMinutes(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude, double? speedKmh);
}
