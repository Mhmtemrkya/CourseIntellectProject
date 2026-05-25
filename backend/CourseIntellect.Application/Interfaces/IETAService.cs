namespace CourseIntellect.Application.Interfaces;

public interface IETAService
{
    int CalculateEtaMinutes(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude, double? speedKmh);
}
