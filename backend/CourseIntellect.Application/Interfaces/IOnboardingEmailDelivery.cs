using CourseIntellect.Domain.Entities;
namespace CourseIntellect.Application.Interfaces;
public interface IOnboardingEmailDelivery
{
    // Adds to the caller's DbContext; caller commits the state and email together.
    OnboardingEmail Queue(string eventKey, string kind, Guid relatedId, string? version,
        DateTime expiresAtUtc, string recipient, string subject, string html);
    Task DispatchAsync(CancellationToken cancellationToken = default);
}
