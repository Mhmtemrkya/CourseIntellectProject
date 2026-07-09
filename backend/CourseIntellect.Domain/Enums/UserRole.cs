namespace CourseIntellect.Domain.Enums;

public enum UserRole
{
    Admin = 1,
    Teacher = 2,
    Accounting = 3,
    Administrative = 4,
    Parent = 5,
    Student = 6,
    Developer = 7,
    Cafeteria = 8,
    // Şube müdürü: kurum admin'i gücünde AMA yalnızca kendi şubesine kilitli.
    // Yetki için Admin alias'ı taşır (JWT); veri izolasyonu Branch grant ile sağlanır.
    BranchManager = 9
}
