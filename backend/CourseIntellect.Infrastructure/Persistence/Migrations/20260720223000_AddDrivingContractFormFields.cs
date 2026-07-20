using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
namespace CourseIntellect.Infrastructure.Persistence.Migrations;

/// <summary>
/// EK-1 müracaat formu ile kayıt sözleşmesinin otomatik doldurulabilmesi için
/// eksik olan iki blok: kursiyerin nüfus kayıt bilgileri ve kurumun resmî künyesi.
/// </summary>
[DbContext(typeof(CourseIntellectDbContext))]
[Migration("20260720223000_AddDrivingContractFormFields")]
public sealed class AddDrivingContractFormFields : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        // ─── Kursiyerin nüfusa kayıtlı olduğu yer ─────────────────────────────
        AddText(m, "student_driving_profiles", "RegistrationCity", 60);
        AddText(m, "student_driving_profiles", "RegistrationDistrict", 60);
        AddText(m, "student_driving_profiles", "RegistrationNeighborhood", 120);
        AddText(m, "student_driving_profiles", "RegistrationStreet", 120);
        AddText(m, "student_driving_profiles", "RegistrationVolumeNo", 30);
        AddText(m, "student_driving_profiles", "RegistrationFamilyOrderNo", 30);
        AddText(m, "student_driving_profiles", "RegistrationOrderNo", 30);
        AddText(m, "student_driving_profiles", "IdentityIssuePlace", 120);
        m.AddColumn<DateTime>("IdentityIssueDate", "student_driving_profiles", type: "timestamp with time zone", nullable: true);

        // ─── Kurumun resmî künyesi ve sözleşme ücret satırları ────────────────
        AddText(m, "driving_school_settings", "FormInstitutionName", 200);
        AddText(m, "driving_school_settings", "FormInstitutionCity", 60);
        AddText(m, "driving_school_settings", "FormInstitutionDistrict", 60);
        AddText(m, "driving_school_settings", "FormInstitutionAddress", 400);
        AddText(m, "driving_school_settings", "FormInstitutionPhone", 30);
        AddText(m, "driving_school_settings", "FormDirectorName", 150);
        AddText(m, "driving_school_settings", "FormBankName", 120);
        AddText(m, "driving_school_settings", "FormBankAccountNo", 60);
        AddText(m, "driving_school_settings", "FormJurisdictionCity", 60);
        AddMoney(m, "FormTheoryHourlyFee");
        AddMoney(m, "FormDrivingHourlyFee");
        AddMoney(m, "FormTheoryExamFee");
        AddMoney(m, "FormDrivingExamFee");
        m.AddColumn<int>("FormTheoryHours", "driving_school_settings", type: "integer", nullable: false, defaultValue: 34);
        m.AddColumn<int>("FormDrivingHours", "driving_school_settings", type: "integer", nullable: false, defaultValue: 16);
    }

    protected override void Down(MigrationBuilder m)
    {
        foreach (var c in new[]
        {
            "RegistrationCity", "RegistrationDistrict", "RegistrationNeighborhood", "RegistrationStreet",
            "RegistrationVolumeNo", "RegistrationFamilyOrderNo", "RegistrationOrderNo",
            "IdentityIssuePlace", "IdentityIssueDate",
        }) m.DropColumn(c, "student_driving_profiles");

        foreach (var c in new[]
        {
            "FormInstitutionName", "FormInstitutionCity", "FormInstitutionDistrict", "FormInstitutionAddress",
            "FormInstitutionPhone", "FormDirectorName", "FormBankName", "FormBankAccountNo", "FormJurisdictionCity",
            "FormTheoryHourlyFee", "FormDrivingHourlyFee", "FormTheoryExamFee", "FormDrivingExamFee",
            "FormTheoryHours", "FormDrivingHours",
        }) m.DropColumn(c, "driving_school_settings");
    }

    private static void AddText(MigrationBuilder m, string table, string column, int maxLength) =>
        m.AddColumn<string>(column, table, type: $"character varying({maxLength})", maxLength: maxLength,
            nullable: false, defaultValue: "");

    private static void AddMoney(MigrationBuilder m, string column) =>
        m.AddColumn<decimal>(column, "driving_school_settings", type: "numeric(18,2)", precision: 18, scale: 2,
            nullable: false, defaultValue: 0m);
}
