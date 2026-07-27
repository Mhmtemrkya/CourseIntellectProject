using CourseIntellect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Persistence;

/// <summary>
/// Sürücü kursu kayıtları tenant kapsamındadır; bağlı personel kaydı ise şube
/// kapsamındadır. Doğrudan <c>db.Staff</c> ile JOIN yapıldığında şubeye atanmadığı
/// için <c>BranchId = null</c> olan ortak usta öğreticiler, şube hesabında sessizce
/// listeden düşer. Bu sorgu tenant sınırını kesin olarak korurken aktif şubedeki ve
/// şubesiz/ortak personeli birlikte görünür kılar.
/// </summary>
public static class DrivingStaffScopeExtensions
{
    public static IQueryable<StaffProfile> VisibleDrivingStaff(
        this CourseIntellectDbContext dbContext)
    {
        var tenantId = dbContext.CurrentTenantId;
        var branchId = dbContext.EffectiveBranchId;

        return dbContext.Staff
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .Where(x => branchId == null || x.BranchId == null || x.BranchId == branchId);
    }
}
