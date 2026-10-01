using System.ComponentModel.DataAnnotations;
namespace CourseIntellect.Application.DTOs.ContactMessages;

public sealed class CreateContactMessageRequest
{
    public CreateContactMessageRequest(string Name, string Email, string Subject, string Message, string? CaptchaToken = null)
    {
        this.Name = Name;
        this.Email = Email;
        this.Subject = Subject;
        this.Message = Message;
        this.CaptchaToken = CaptchaToken;
    }

    [Required, StringLength(150, MinimumLength = 2)]
    public string Name { get; init; }
    [Required, EmailAddress, StringLength(180)]
    public string Email { get; init; }
    [Required, StringLength(180, MinimumLength = 3)]
    public string Subject { get; init; }
    [Required, StringLength(2000, MinimumLength = 10)]
    public string Message { get; init; }
    [StringLength(2048)]
    public string? CaptchaToken { get; init; }
}
