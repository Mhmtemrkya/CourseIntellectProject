namespace CourseIntellect.Domain.Enums;

public enum ServiceRouteType
{
    Morning = 1,
    Evening = 2
}

public enum ServiceTripType
{
    Morning = 1,
    Evening = 2,
    Both = 3
}

public enum ServiceTripStatus
{
    NotStarted = 1,
    InProgress = 2,
    ArrivedSchool = 3,
    Completed = 4,
    Cancelled = 5
}

public enum ServiceAttendanceStatus
{
    Pending = 1,
    Boarded = 2,
    NotBoarded = 3,
    ArrivedSchool = 4,
    BoardedFromSchool = 5,
    ArrivedHome = 6
}

public enum ServiceAbsenceRequestStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Cancelled = 4
}
