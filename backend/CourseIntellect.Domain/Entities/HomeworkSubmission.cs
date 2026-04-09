namespace CourseIntellect.Domain.Entities;

public sealed class HomeworkSubmission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AssignmentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public string FilesSerialized { get; set; } = "[]";
    public string SubmittedAtLabel { get; set; } = string.Empty;
}
