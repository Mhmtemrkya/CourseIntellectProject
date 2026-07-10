using CourseIntellect.Application.DTOs.Scope;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <inheritdoc cref="IUserScopeService"/>
public sealed class UserScopeService(CourseIntellectDbContext dbContext) : IUserScopeService
{
    // Şube sayılan org birim tipleri (Topbar'daki şube filtresiyle aynı).
    private static readonly HashSet<string> BranchUnitTypes = ["şube", "sube", "kampüs", "kampus"];

    public async Task<IReadOnlyList<UserScopeGrant>> GetGrantsAsync(Guid userId, CancellationToken cancellationToken = default) =>
        await dbContext.UserScopeGrants
            .AsNoTracking()
            .Where(g => g.UserId == userId)
            .ToListAsync(cancellationToken);

    public async Task<bool> CanAccessTenantAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        var grants = await GetGrantsAsync(userId, cancellationToken);
        return await CanAccessTenantAsync(grants, tenantId, cancellationToken);
    }

    public async Task<IReadOnlyCollection<Guid>?> ResolveAllowedBranchesAsync(Guid userId, Guid tenantId, CancellationToken cancellationToken = default)
    {
        var grants = await GetGrantsAsync(userId, cancellationToken);

        // Platform / ilgili Group / tam Tenant grant'ı → kurum içinde TÜM şubeler (kısıt yok).
        if (grants.Any(g => g.Level == ScopeLevel.Platform)
            || grants.Any(g => g.Level == ScopeLevel.Tenant && g.TargetId == tenantId)
            || await HasGroupAccessAsync(grants, tenantId, cancellationToken))
        {
            return null;
        }

        // Aksi halde yalnız bu kuruma ait Branch grant hedeflerine kilitli.
        var branchTargets = grants
            .Where(g => g.Level == ScopeLevel.Branch && g.TargetId is not null)
            .Select(g => g.TargetId!.Value)
            .ToHashSet();
        if (branchTargets.Count == 0)
        {
            return Array.Empty<Guid>();
        }

        var allowed = await dbContext.OrgUnits
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(o => branchTargets.Contains(o.Id) && o.TenantId == tenantId)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);
        return allowed;
    }

    public async Task<UserScopeOptions> GetScopeOptionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var grants = await GetGrantsAsync(userId, cancellationToken);
        var readOnly = grants.Count > 0 && grants.All(g => g.AccessMode == ScopeAccessMode.ReadOnly);

        var hasPlatform = grants.Any(g => g.Level == ScopeLevel.Platform);
        var groupIds = grants.Where(g => g.Level == ScopeLevel.Group && g.TargetId is not null)
            .Select(g => g.TargetId!.Value).ToHashSet();
        var branchTargets = grants.Where(g => g.Level == ScopeLevel.Branch && g.TargetId is not null)
            .Select(g => g.TargetId!.Value).ToHashSet();

        // Tam erişimli kurumlar (tüm şubeleri görünür): açık Tenant grant'ları + grup üyeleri
        // + platform (tüm kurumlar).
        var fullTenantIds = grants.Where(g => g.Level == ScopeLevel.Tenant && g.TargetId is not null)
            .Select(g => g.TargetId!.Value).ToHashSet();
        if (groupIds.Count > 0)
        {
            var subtreeGroupIds = await ResolveGroupSubtreeAsync(groupIds, cancellationToken);
            var groupTenantIds = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
                .Where(t => t.GroupId != null && subtreeGroupIds.Contains(t.GroupId.Value))
                .Select(t => t.Id).ToListAsync(cancellationToken);
            fullTenantIds.UnionWith(groupTenantIds);
        }
        if (hasPlatform)
        {
            // NOT: MEB ölçeğinde bu liste büyür; sonraki rafinasyonda ?search + sayfalama.
            var allTenantIds = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
                .Select(t => t.Id).ToListAsync(cancellationToken);
            fullTenantIds.UnionWith(allTenantIds);
        }

        // Şubeye kilitli kurumlar: verilen Branch grant'larının ait olduğu kurumlar
        // (tam erişimde olmayanlar).
        var lockedBranchesByTenant = new Dictionary<Guid, HashSet<Guid>>();
        if (branchTargets.Count > 0)
        {
            var branchRows = await dbContext.OrgUnits.IgnoreQueryFilters().AsNoTracking()
                .Where(o => branchTargets.Contains(o.Id) && o.TenantId != null)
                .Select(o => new { o.Id, o.Name, o.TenantId })
                .ToListAsync(cancellationToken);
            foreach (var row in branchRows)
            {
                var tenantId = row.TenantId!.Value;
                if (fullTenantIds.Contains(tenantId)) continue;
                if (!lockedBranchesByTenant.TryGetValue(tenantId, out var set))
                {
                    lockedBranchesByTenant[tenantId] = set = [];
                }
                set.Add(row.Id);
            }
        }

        var accessibleTenantIds = new HashSet<Guid>(fullTenantIds);
        accessibleTenantIds.UnionWith(lockedBranchesByTenant.Keys);
        if (accessibleTenantIds.Count == 0)
        {
            return new UserScopeOptions(readOnly, Array.Empty<ScopeTenantDto>());
        }

        var tenantRows = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(t => accessibleTenantIds.Contains(t.Id))
            .Select(t => new { t.Id, t.Name })
            .ToListAsync(cancellationToken);

        // Tam erişimli kurumların tüm şube-tipli birimleri.
        var fullBranchRows = await dbContext.OrgUnits.IgnoreQueryFilters().AsNoTracking()
            .Where(o => o.TenantId != null && fullTenantIds.Contains(o.TenantId.Value)
                && BranchUnitTypes.Contains(o.UnitType.ToLower()))
            .Select(o => new { o.Id, o.Name, o.TenantId })
            .ToListAsync(cancellationToken);

        // Kilitli şubelerin adları.
        var lockedBranchIds = lockedBranchesByTenant.SelectMany(kv => kv.Value).ToHashSet();
        var lockedBranchRows = await dbContext.OrgUnits.IgnoreQueryFilters().AsNoTracking()
            .Where(o => lockedBranchIds.Contains(o.Id))
            .Select(o => new { o.Id, o.Name, o.TenantId })
            .ToListAsync(cancellationToken);

        var tenants = new List<ScopeTenantDto>();
        foreach (var tenant in tenantRows.OrderBy(t => t.Name))
        {
            List<ScopeBranchDto> branches;
            if (fullTenantIds.Contains(tenant.Id))
            {
                branches = fullBranchRows
                    .Where(b => b.TenantId == tenant.Id)
                    .OrderBy(b => b.Name)
                    .Select(b => new ScopeBranchDto(b.Id, b.Name))
                    .ToList();
            }
            else
            {
                var allowed = lockedBranchesByTenant[tenant.Id];
                branches = lockedBranchRows
                    .Where(b => allowed.Contains(b.Id))
                    .OrderBy(b => b.Name)
                    .Select(b => new ScopeBranchDto(b.Id, b.Name))
                    .ToList();
            }

            tenants.Add(new ScopeTenantDto(tenant.Id, tenant.Name, branches));
        }

        return new UserScopeOptions(readOnly, tenants);
    }

    public async Task<ScopeRollupResponse> GetRollupAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var grants = await GetGrantsAsync(userId, cancellationToken);
        var readOnly = grants.Count > 0 && grants.All(g => g.AccessMode == ScopeAccessMode.ReadOnly);

        var accessibleTenantIds = await ResolveAccessibleTenantIdsAsync(grants, cancellationToken);
        if (accessibleTenantIds.Count == 0)
        {
            return new ScopeRollupResponse(readOnly, 0, new ScopeRollupTotals(0, 0, 0, 0m, 0m), Array.Empty<ScopeRollupTenant>());
        }

        var rows = await dbContext.TenantWorkspaces
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => accessibleTenantIds.Contains(t.Id))
            .OrderByDescending(t => t.StudentCount)
            .Select(t => new ScopeRollupTenant(
                t.Id, t.Name, t.StudentCount, t.StaffCount, t.BranchCount, t.CollectedAmount, t.MonthlyFee))
            .ToListAsync(cancellationToken);

        var totals = new ScopeRollupTotals(
            rows.Sum(r => r.Students),
            rows.Sum(r => r.Staff),
            rows.Sum(r => r.Branches),
            rows.Sum(r => r.Collected),
            rows.Sum(r => r.MonthlyFee));

        return new ScopeRollupResponse(readOnly, rows.Count, totals, rows);
    }

    // Kullanıcının erişebildiği TÜM kurum kimlikleri (Platform=hepsi, Group=üyeler,
    // Tenant=açık, Branch=şubenin kurumu). Roll-up ve genel toplam için.
    private async Task<HashSet<Guid>> ResolveAccessibleTenantIdsAsync(
        IReadOnlyList<UserScopeGrant> grants, CancellationToken cancellationToken)
    {
        var tenantIds = grants.Where(g => g.Level == ScopeLevel.Tenant && g.TargetId is not null)
            .Select(g => g.TargetId!.Value).ToHashSet();

        var groupIds = grants.Where(g => g.Level == ScopeLevel.Group && g.TargetId is not null)
            .Select(g => g.TargetId!.Value).ToHashSet();
        if (groupIds.Count > 0)
        {
            var subtreeGroupIds = await ResolveGroupSubtreeAsync(groupIds, cancellationToken);
            var groupTenantIds = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
                .Where(t => t.GroupId != null && subtreeGroupIds.Contains(t.GroupId.Value))
                .Select(t => t.Id).ToListAsync(cancellationToken);
            tenantIds.UnionWith(groupTenantIds);
        }
        if (grants.Any(g => g.Level == ScopeLevel.Platform))
        {
            var allTenantIds = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
                .Select(t => t.Id).ToListAsync(cancellationToken);
            tenantIds.UnionWith(allTenantIds);
        }

        var branchTargets = grants.Where(g => g.Level == ScopeLevel.Branch && g.TargetId is not null)
            .Select(g => g.TargetId!.Value).ToHashSet();
        if (branchTargets.Count > 0)
        {
            var branchTenantIds = await dbContext.OrgUnits.IgnoreQueryFilters().AsNoTracking()
                .Where(o => branchTargets.Contains(o.Id) && o.TenantId != null)
                .Select(o => o.TenantId!.Value).ToListAsync(cancellationToken);
            tenantIds.UnionWith(branchTenantIds);
        }
        return tenantIds;
    }

    public async Task<bool> BranchBelongsToTenantAsync(Guid branchId, Guid tenantId, CancellationToken cancellationToken = default) =>
        await dbContext.OrgUnits
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(o => o.Id == branchId && o.TenantId == tenantId, cancellationToken);

    private async Task<bool> CanAccessTenantAsync(IReadOnlyList<UserScopeGrant> grants, Guid tenantId, CancellationToken cancellationToken)
    {
        if (grants.Any(g => g.Level == ScopeLevel.Platform)) return true;
        if (grants.Any(g => g.Level == ScopeLevel.Tenant && g.TargetId == tenantId)) return true;
        if (await HasGroupAccessAsync(grants, tenantId, cancellationToken)) return true;

        // O kuruma ait bir Branch grant'ı da (şubeye kilitli olsa da) kuruma erişim sayılır.
        var branchTargets = grants
            .Where(g => g.Level == ScopeLevel.Branch && g.TargetId is not null)
            .Select(g => g.TargetId!.Value)
            .ToHashSet();
        if (branchTargets.Count == 0) return false;

        return await dbContext.OrgUnits
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(o => branchTargets.Contains(o.Id) && o.TenantId == tenantId, cancellationToken);
    }

    private async Task<bool> HasGroupAccessAsync(IReadOnlyList<UserScopeGrant> grants, Guid tenantId, CancellationToken cancellationToken)
    {
        var groupIds = grants
            .Where(g => g.Level == ScopeLevel.Group && g.TargetId is not null)
            .Select(g => g.TargetId!.Value)
            .ToHashSet();
        if (groupIds.Count == 0) return false;
        var subtreeGroupIds = await ResolveGroupSubtreeAsync(groupIds, cancellationToken);

        var tenantGroupId = await dbContext.TenantWorkspaces
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.GroupId)
            .FirstOrDefaultAsync(cancellationToken);
        return tenantGroupId is Guid gid && subtreeGroupIds.Contains(gid);
    }

    // Verilen grup düğümlerinin ALT AĞACINI (kendileri + tüm torunları) döner. Bir gruba
    // verilen grant, o düğümün altındaki tüm kurumları kapsar — böylece İl grant'ı ilçeleri,
    // İlçe grant'ı okulları otomatik içerir. Grup tablosu küçük (İl/İlçe/marka) olduğundan
    // tümü bir kez yüklenip bellekte gezilir. Düz (parent'sız) gruplar için alt ağaç = kendisi.
    private async Task<HashSet<Guid>> ResolveGroupSubtreeAsync(HashSet<Guid> rootGroupIds, CancellationToken cancellationToken)
    {
        if (rootGroupIds.Count == 0) return rootGroupIds;

        var edges = await dbContext.TenantGroups
            .AsNoTracking()
            .Where(g => g.ParentGroupId != null)
            .Select(g => new { g.Id, ParentId = g.ParentGroupId!.Value })
            .ToListAsync(cancellationToken);
        var childrenByParent = edges
            .GroupBy(e => e.ParentId)
            .ToDictionary(x => x.Key, x => x.Select(e => e.Id).ToList());

        var result = new HashSet<Guid>(rootGroupIds);
        var queue = new Queue<Guid>(rootGroupIds);
        while (queue.Count > 0)
        {
            if (childrenByParent.TryGetValue(queue.Dequeue(), out var children))
            {
                foreach (var child in children)
                {
                    if (result.Add(child)) queue.Enqueue(child);
                }
            }
        }
        return result;
    }
}
