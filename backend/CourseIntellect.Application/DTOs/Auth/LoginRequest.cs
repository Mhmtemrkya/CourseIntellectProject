using System.ComponentModel.DataAnnotations;

namespace CourseIntellect.Application.DTOs.Auth;

public sealed record LoginRequest(
    [property: Required, StringLength(254)] string Username,
    [property: Required, StringLength(1024)] string Password);
