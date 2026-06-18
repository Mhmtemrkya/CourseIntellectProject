import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchUserRoles, updateRolePolicy } from '../../lib/api/modules';

export default function AdminRbacMatrix() {
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingCell, setSavingCell] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchUserRoles();
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Roller alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const modules = useMemo(() => {
    const set = new Set();
    roles.forEach((r) => (r.moduleAccess || []).forEach((m) => set.add(m)));
    return [...set].sort();
  }, [roles]);

  const toggle = async (role, moduleKey) => {
    const has = (role.moduleAccess || []).includes(moduleKey);
    const nextModules = has
      ? role.moduleAccess.filter((m) => m !== moduleKey)
      : [...(role.moduleAccess || []), moduleKey];
    const cellKey = `${role.roleName}:${moduleKey}`;
    setSavingCell(cellKey);
    // İyimser güncelle
    setRoles((prev) => prev.map((r) => (r.roleName === role.roleName ? { ...r, moduleAccess: nextModules } : r)));
    try {
      await updateRolePolicy(role.roleName, {
        isActive: role.isActive,
        loginEnabled: role.loginEnabled,
        requiresCriticalApproval: role.requiresCriticalApproval,
        messagingScope: role.messagingScope || '',
        moduleAccess: nextModules,
      });
    } catch (err) {
      // Geri al
      setRoles((prev) => prev.map((r) => (r.roleName === role.roleName ? { ...r, moduleAccess: role.moduleAccess } : r)));
      toast({ title: 'Güncellenemedi', description: err.message, variant: 'destructive' });
    } finally {
      setSavingCell('');
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-rbac-matrix-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-brand-primary" />Yetki Matrisi (RBAC)</h1>
        <p className="text-muted-foreground mt-1">Rollerin modül erişimlerini tek tabloda yönetin. Değişiklik anında kaydedilir.</p>
      </div>
      {error ? <ErrorBanner title="Roller alınamadı" message={error} onRetry={load} /> : null}

      {modules.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Tanımlı modül erişimi bulunamadı.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Rol × Modül</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card p-2 text-left">Rol</th>
                  {modules.map((m) => (
                    <th key={m} className="p-2 text-center align-bottom">
                      <span className="inline-block whitespace-nowrap text-xs font-semibold">{m}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.roleName} className="border-t">
                    <td className="sticky left-0 bg-card p-2">
                      <div className="font-semibold">{role.roleName}</div>
                      <div className="flex gap-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline">{role.userCount} kullanıcı</Badge>
                        {!role.isActive ? <Badge className="bg-red-100 text-red-700">Pasif</Badge> : null}
                      </div>
                    </td>
                    {modules.map((m) => {
                      const has = (role.moduleAccess || []).includes(m);
                      const cellKey = `${role.roleName}:${m}`;
                      return (
                        <td key={m} className="p-2 text-center">
                          <button
                            type="button"
                            disabled={savingCell === cellKey}
                            onClick={() => toggle(role, m)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${has ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border bg-muted/40 text-transparent hover:border-brand-primary/50'}`}
                            aria-label={`${role.roleName} - ${m}`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
