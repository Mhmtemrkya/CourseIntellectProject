namespace CourseIntellect.Domain.Enums;

public enum DrivingGraduationStatus { Pending = 1, Graduated = 2, Revoked = 3 }
public enum DrivingCertificateType { Achievement = 1, Completion = 2 }
public enum DrivingCertificateDeliveryStatus { NotDelivered = 1, Ready = 2, Delivered = 3, Returned = 4 }
public enum DrivingCertificateStatus { Active = 1, Superseded = 2, Revoked = 3 }
public enum DrivingExcusedAbsencePolicy { CountsAsAbsent = 1, ExcludeFromCalculation = 2, CountsAsPresent = 3 }
public enum DrivingGraduationActionType { EligibilityOverride = 1, GraduationRevocation = 2 }
public enum DrivingGraduationActionStatus { Pending = 1, FirstApproved = 2, Approved = 3, Rejected = 4, Applied = 5, Cancelled = 6 }
public enum DrivingAppointmentRequestType { NewAppointment = 1, Reschedule = 2 }
public enum DrivingAppointmentRequestStatus { Pending = 1, Approved = 2, Rejected = 3, Cancelled = 4 }
