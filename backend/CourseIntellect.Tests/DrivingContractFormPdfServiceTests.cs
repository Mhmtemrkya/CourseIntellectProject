using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingContractFormPdfServiceTests
{
    private static DrivingContractFormData Sample() => new(
        FullName: "Yiğit Hamza Anık",
        IdentityNumber: "46789017822",
        FatherName: "Serdar",
        MotherName: "Fadime",
        BirthPlace: "Erzurum",
        BirthDate: "12.09.2008",
        EducationLevel: "İlkokul",
        LicenseClass: "B",
        Phone: "5522702725",
        HomePhone: "",
        ResidenceAddress: "Lalapaşa Mah. / ERZURUM",
        RegistrationCity: "Erzurum",
        RegistrationDistrict: "Yakutiye",
        RegistrationNeighborhood: "Lalapaşa",
        RegistrationStreet: "",
        RegistrationVolumeNo: "12",
        RegistrationFamilyOrderNo: "34",
        RegistrationOrderNo: "5",
        IdentityIssueDate: "01.02.2020",
        IdentityIssuePlace: "Yakutiye Nüfus Md.",
        ExistingLicenseCity: "",
        ExistingLicenseClasses: "",
        ExistingLicenseDate: "",
        ExistingLicenseNumber: "",
        InstitutionName: "Özel Tema M.T.S.K.",
        InstitutionCity: "Erzurum",
        InstitutionDistrict: "Yakutiye",
        InstitutionAddress: "Lalapaşa Mh. Atatürkevi Sk. K.Boynukalın İş Merkezi No:9/5 Yakutiye/Erzurum",
        InstitutionPhone: "4422338383",
        DirectorName: "Mutlutan Alparslan Dumlu",
        BankName: "Ziraat Bankası",
        BankAccountNo: "TR00 0000 0000 0000 0000 0000 00",
        JurisdictionCity: "Erzurum",
        TotalFee: 19581.15m,
        TheoryHourlyFee: 88.16m,
        DrivingHourlyFee: 1036.49m,
        TheoryExamFee: 900m,
        DrivingExamFee: 1350m,
        TheoryHours: 34,
        DrivingHours: 16,
        FailedFourthAttemptFee: 16583.84m,
        Installments: new[]
        {
            new DrivingContractInstallment("1. Taksit", 9790.58m, new DateTime(2026, 8, 15, 0, 0, 0, DateTimeKind.Utc), null),
            new DrivingContractInstallment("2. Taksit", 9790.57m, new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc), null),
        },
        DownPayment: 0m,
        RegisteredAtUtc: new DateTime(2026, 7, 16, 9, 0, 0, DateTimeKind.Utc),
        GeneratedAtUtc: new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc));

    // Matbu evrakların sayfa sayısı sabittir: taşan bir madde formu geçersiz kılar,
    // bu yüzden şablon değişikliklerinde sayfa sayısı kilitli tutulur.
    [Theory]
    [InlineData(DrivingContractFormKind.Application, 1)]
    [InlineData(DrivingContractFormKind.SignatureCircular, 1)]
    [InlineData(DrivingContractFormKind.Contract, 2)]
    public void Generate_ProducesExpectedPageCount(DrivingContractFormKind kind, int expectedPages)
    {
        var bytes = new DrivingContractFormPdfService().Generate(kind, Sample());

        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        Assert.Equal(expectedPages, PageCount(bytes));

        var dir = Environment.GetEnvironmentVariable("CONTRACT_FORM_PREVIEW_DIR");
        if (!string.IsNullOrWhiteSpace(dir)) File.WriteAllBytes(Path.Combine(dir, $"{kind}.pdf"), bytes);
    }

    /// <summary>PDF katalogundaki sayfa ağacının /Count değerini okur.</summary>
    private static int PageCount(byte[] pdf)
    {
        var text = System.Text.Encoding.Latin1.GetString(pdf);
        var match = System.Text.RegularExpressions.Regex.Match(text, @"/Count\s+(\d+)");
        Assert.True(match.Success, "PDF sayfa ağacı okunamadı.");
        return int.Parse(match.Groups[1].Value);
    }

    [Fact]
    public void GenerateBundle_MergesAllThreeDocuments()
    {
        var bundle = new DrivingContractFormPdfService().GenerateBundle(Sample());

        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bundle, 0, 4));
        // Müracaat (1) + imza sirküleri (1) + sözleşme (2) = 4 sayfa.
        Assert.Equal(4, PageCount(bundle));

        var dir = Environment.GetEnvironmentVariable("CONTRACT_FORM_PREVIEW_DIR");
        if (!string.IsNullOrWhiteSpace(dir)) File.WriteAllBytes(Path.Combine(dir, "bundle.pdf"), bundle);
    }

    /// <summary>Veri girilmemiş bir kursiyerde de form basılabilmeli (alanlar boş kalır).</summary>
    [Fact]
    public void Generate_ToleratesEmptyFields()
    {
        var empty = Sample() with
        {
            FatherName = "", MotherName = "", BirthPlace = "", BirthDate = "",
            RegistrationCity = "", RegistrationDistrict = "", RegistrationNeighborhood = "",
            RegistrationVolumeNo = "", RegistrationFamilyOrderNo = "", RegistrationOrderNo = "",
            IdentityIssueDate = "", IdentityIssuePlace = "", DirectorName = "",
            BankName = "", BankAccountNo = "", Installments = Array.Empty<DrivingContractInstallment>(),
        };

        var bundle = new DrivingContractFormPdfService().GenerateBundle(empty);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bundle, 0, 4));
    }
}
