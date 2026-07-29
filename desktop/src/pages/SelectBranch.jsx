import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Layers3, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { fetchMyScope, fetchOrgUnits } from '../lib/api/modules';
import { setActiveBranchFilter } from '../lib/api/client';
import { getUserHomePath } from '../lib/auth';

const BRANCH_TYPES = ['şube', 'sube', 'kampüs', 'kampus'];

export default function SelectBranch() {
  const navigate = useNavigate();
  const { user, logout } = useApp();
  const [branches, setBranches] = useState([]);
  const [canViewAllBranches, setCanViewAllBranches] = useState(false);
  const [loading, setLoading] = useState(true);

  const proceed = useCallback((branchId) => {
    setActiveBranchFilter(branchId || null);
    if (typeof localStorage !== 'undefined') localStorage.setItem('ci-branch-selected', '1');
    navigate(getUserHomePath(user), { replace: true });
  }, [navigate, user]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [units, scope] = await Promise.all([
        fetchOrgUnits().catch(() => []),
        fetchMyScope().catch(() => null),
      ]);
      const all = Array.isArray(units) ? units : [];
      const activeTenant = scope?.tenants?.find((tenant) => tenant.id === scope?.active?.tenantId)
        || scope?.tenants?.[0];
      setCanViewAllBranches(scope?.canViewAllBranches === true
        || (!scope && String(user?.backendRole || '').toLowerCase() !== 'branchmanager'));
      const allowedIds = activeTenant
        ? new Set((activeTenant.branches || []).map((branch) => branch.id))
        : null;
      const branchUnits = all.filter((u) => u.isActive !== false
        && BRANCH_TYPES.includes(String(u.unitType || '').toLowerCase())
        && (!allowedIds || allowedIds.has(u.id)));
      // Şube kaydı yoksa filtrelenecek bir bağlam bulunmaz. En az bir şube varsa
      // tek şube dahi olsa kullanıcı "Tüm Şubeler" veya ilgili şubeyi açıkça seçer.
      if (branchUnits.length === 0) {
        proceed(null);
        return;
      }
      setBranches(branchUnits);
    } finally {
      setLoading(false);
    }
  }, [proceed, user?.backendRole]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-primary/10 text-brand-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold font-heading">Şube Seçin</h1>
          <p className="mt-1 text-muted-foreground">
            {user?.name ? `${user.name}, ` : ''}yönetmek istediğiniz şubeyi seçin. Tüm ekranlar seçtiğiniz şubeye göre görüntülenir.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {canViewAllBranches && (
            <button
              type="button"
              onClick={() => proceed(null)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-brand-primary/30 bg-brand-primary/[0.05] p-5 text-left shadow-sm transition-all hover:border-brand-primary/60 hover:bg-brand-primary/10"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-primary/15 text-brand-primary">
                  <Layers3 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">Tüm Şubeler</p>
                  <p className="text-xs text-muted-foreground">Bütün şubelerin birleşik verilerini gösterir</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => proceed(branch.id)}
              className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:border-brand-primary/40 hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-primary/10 text-brand-primary">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{branch.name}</p>
                  <p className="text-xs text-muted-foreground">{branch.unitType}{branch.managerName ? ` • ${branch.managerName}` : ''}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
            <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
