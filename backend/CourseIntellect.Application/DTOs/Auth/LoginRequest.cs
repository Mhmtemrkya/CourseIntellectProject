using System.ComponentModel.DataAnnotations;

namespace CourseIntellect.Application.DTOs.Auth;

public sealed record LoginRequest(
    [Required, StringLength(254)] string Username,
    [Required, StringLength(1024)] string Password);
