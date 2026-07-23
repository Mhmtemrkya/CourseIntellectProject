using System.Text;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Tests;

public sealed class DrivingMebbisExportTests : IDisposable
{
    private readonly TestDb db = new();

    [Theory]
    [InlineData("candidate-registration", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData("candidate-registration", "pdf", "application/pdf")]
    [InlineData("document-approval", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData("document-approval", "pdf", "application/pdf")]
    [InlineData("term-assignment", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData("term-assignment", "pdf", "application/pdf")]
    [InlineData("exam-result", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData("exam-result", "pdf", "application/pdf")]
    [InlineData("certificate-number", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData("certificate-number", "pdf", "application/pdf")]
    public async Task EverySection_ProducesDownloadableFile(string section, string format, string expectedContentType)
    {
        var tenant = new TenantWorkspace
        {
            Name = "Test Sürücü Kursu",
            Status = "active",
            InstitutionType = InstitutionType.DrivingSchool,
            DrivingSchoolModuleEnabled = true,
        };
        db.Context.TenantWorkspaces.Add(tenant);
        db.Context.SetTenantOverride(tenant.Id);

        var package = new DrivingPackage { TenantId = tenant.Id, Name = "B Paketi" };
        var group = new DrivingStudentGroup { TenantId = tenant.Id, Name = "2026/7 Dönemi", TermYear = 2026, TermNumber = 7 };
        var student = new StudentProfile
        {
            TenantId = tenant.Id,
            FullName = "Ayşe Yılmaz",
            TcNo = "10000000146",
            BirthDate = "01.01.2000",
        };
        db.Context.DrivingPackages.Add(package);
        db.Context.DrivingStudentGroups.Add(group);
        db.Context.Students.Add(student);
        db.Context.StudentDrivingProfiles.Add(new StudentDrivingProfile
        {
            TenantId = tenant.Id,
            StudentId = student.Id,
            PackageId = package.Id,
            StudentGroupId = group.Id,
            StudentNumber = 1,
            LicenseClass = "B",
            Phone = "05551234567",
            FatherName = "Mehmet",
            MotherName = "Fatma",
            BirthPlace = "Ankara",
            Gender = "Kadın",
            EducationLevel = "Lise",
        });
        await db.Context.SaveChangesAsync();

        var controller = new DrivingMebbisExportController(
            db.Context,
            new MebbisExportRenderer(),
            new EmptyFileStorage(),
            new AuditLogService(db.Context, new HttpContextAccessor()));

        var result = await controller.Export(section, group.Id, format, CancellationToken.None);

        var file = Assert.IsType<FileContentResult>(result);
        Assert.Equal(expectedContentType, file.ContentType);
        Assert.NotEmpty(file.FileContents);
        if (format == "pdf")
            Assert.Equal("%PDF", Encoding.ASCII.GetString(file.FileContents, 0, 4));
        else
            Assert.Equal("PK", Encoding.ASCII.GetString(file.FileContents, 0, 2));
    }

    public void Dispose() => db.Dispose();

    private sealed class EmptyFileStorage : IFileStorageService
    {
        public Task<UploadedAssetDto> SaveAsync(
            Stream stream,
            string fileName,
            string contentType,
            string folder,
            string baseUrl,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<byte[]?> ReadBytesAsync(string fileUrl, CancellationToken cancellationToken = default) =>
            Task.FromResult<byte[]?>(null);

        public Task<StoredFilePrefixDto?> ReadPrefixAsync(
            string fileUrl,
            int maxBytes,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<StoredFilePrefixDto?>(null);
    }
}
