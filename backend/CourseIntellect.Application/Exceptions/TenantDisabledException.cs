namespace CourseIntellect.Application.Exceptions;

public sealed class TenantDisabledException()
    : Exception("Kurumunuzun erişimi kapalı. Destek sayfasından müşteri numaranızla bize ulaşabilirsiniz.");
