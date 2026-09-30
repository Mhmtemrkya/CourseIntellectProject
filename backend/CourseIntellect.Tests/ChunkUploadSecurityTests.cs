using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace CourseIntellect.Tests;

public sealed class ChunkUploadSecurityTests
{
    [Fact]
    public async Task SparseSingleByteClaimingTenGigabytes_IsRejectedWithoutMaterialization()
    {
        var storage = new RecordingStorage();
        var controller = Controller(storage, Guid.NewGuid(), Guid.NewGuid());
        var request = Request(totalSize: 10L * 1024 * 1024 * 1024, start: 10L * 1024 * 1024 * 1024 - 1, index: 0, chunks: 1, bytes: [1]);

        var result = await controller.UploadChunk(request, default);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, storage.SaveCount);
    }

    [Fact]
    public async Task SameUploadId_CannotChangeImmutableMetadataOrSkipCoverage()
    {
        var storage = new RecordingStorage();
        var tenant = Guid.NewGuid(); var user = Guid.NewGuid(); var upload = Guid.NewGuid();
        var controller = Controller(storage, tenant, user);

        Assert.IsType<OkObjectResult>(await controller.UploadChunk(Request(4, 0, 0, 2, [1, 2], upload, "a.txt"), default));
        var changed = await controller.UploadChunk(Request(4, 2, 1, 2, [3, 4], upload, "b.txt"), default);

        Assert.IsType<BadRequestObjectResult>(changed);
        Assert.Equal(0, storage.SaveCount);
    }

    private static ChunkedFileUploadRequest Request(long totalSize, long start, int index, int chunks, byte[] bytes, Guid? upload = null, string file = "a.txt") => new()
    {
        UploadId = (upload ?? Guid.NewGuid()).ToString(), FileName = file, ContentType = "text/plain", Folder = "general",
        TotalSize = totalSize, StartByte = start, ChunkIndex = index, TotalChunks = chunks, Base64Content = Convert.ToBase64String(bytes)
    };

    private static UploadsController Controller(RecordingStorage storage, Guid tenant, Guid user)
    {
        var controller = new UploadsController(storage);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim("tenant_id", tenant.ToString()), new Claim(ClaimTypes.NameIdentifier, user.ToString())], "test"));
        controller.HttpContext.Request.Scheme = "https";
        controller.HttpContext.Request.Host = new HostString("test.local");
        return controller;
    }

    private sealed class RecordingStorage : IFileStorageService
    {
        public int SaveCount { get; private set; }
        public Task<UploadedAssetDto> SaveAsync(Stream stream, string fileName, string contentType, string folder, string baseUrl, CancellationToken cancellationToken = default)
        { SaveCount++; return Task.FromResult(new UploadedAssetDto(fileName, "/x", contentType, stream.Length)); }
        public Task<byte[]?> ReadBytesAsync(string fileUrl, CancellationToken cancellationToken = default) => Task.FromResult<byte[]?>(null);
        public Task<StoredFilePrefixDto?> ReadPrefixAsync(string fileUrl, int maxBytes, CancellationToken cancellationToken = default) => Task.FromResult<StoredFilePrefixDto?>(null);
    }
}
