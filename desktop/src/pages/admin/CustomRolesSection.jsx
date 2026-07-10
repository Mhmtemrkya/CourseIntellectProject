import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ShieldPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { fetchCustomRoles, createCustomRole, deleteCustomRole } from '../../lib/api/modules';
import { MODULE_LIBRARY, ROLE_MODULES } from '../../lib/packageCatalog';

const BASE_ROLES = [
  { value: 'Administrative', label: 'İdari Personel', moduleKey: 'administrative' },
  { value: 'Teacher', label: 'Öğretmen', moduleKey: 'teacher' },
  { value: 'Cafeteria', label: 'Yemekhaneci', moduleKey: 'cafeteria' },
];

/**
 * Özel roller: kurum yöneticisi ad + taban rol + modül seçimiyle kendi rolünü tanımlar.
 * Modül kısıtı backend'de (EntitlementService) zorlanır; burada yalnız tanım yönetilir.
 */
export default function CustomRolesSection() {
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', baseRole: 'Administrative', modules: [] });

  const load = useCallback(async () => {
    try { setRoles(await fetchCustomRoles()); } catch { setRoles([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const moduleOptions = (BASE_ROLES.find((r) => r.value === form.baseRole)?.moduleKey || 'administrative');
  const availableModules = (ROLE_MODULES[moduleOptions] || []).map((key) => ({
    key,
    label: MODULE_LIBRARY[key]?.label || key,
  }));

  const toggleModule = (key) => setForm((f) => ({
    ...f,
    modules: f.modules.includes(key) ? f.modules.filter((m) => m !== key) : [...f.modules, key],
  }));

  const handleCreate = async () => {
    if (form.name.trim().length < 3) {
      toast({ title: 'Rol adı en az 3 karakter olmalıdır.', variant: 'destructive' });
      return;
    }
    if (form.modules.length === 0) {
      toast({ title: 'En az bir modül seçin.', variant: 'destructive' });
      return;
    }
    try {
      await createCustomRole({ name: form.name.trim(), baseRole: form.baseRole, modules: form.modules });
      setForm({ name: '', baseRole: 'Administrative', modules: [] });
      setCreating(false);
      await load();
      toast({ title: 'Özel rol oluşturuldu.' });
    } catch (e) {
      toast({ title: e.message || 'Rol oluşturulamadı.', variant: 'destructive' });
    }
  };

  const handleDelete = async (role) => {
    try { await deleteCustomRole(role.id); await load(); toast({ title: 'Rol silindi.' }); }
    catch (e) { toast({ title: e.message || 'Silinemedi (atanmış kullanıcı olabilir).', variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldPlus className="h-4 w-4" /> Özel Roller
        </CardTitle>
        <Button size="sm" variant={creating ? 'outline' : 'default'} onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> {creating ? 'Vazgeç' : 'Yeni Rol'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <div className="space-y-3 rounded-lg border border-foreground/[0.08] p-3">
            <div className="flex flex-wrap gap-2">
              <div className="min-w-56 flex-1">
                <label className="text-xs text-muted-foreground">Rol adı</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ör. Kayıt Sorumlusu" />
              </div>
              <div className="min-w-44">
                <label className="text-xs text-muted-foreground">Taban rol (panel)</label>
                <select
                  className="h-9 w-full rounded-md border border-foreground/[0.12] bg-background px-2 text-sm"
                  value={form.baseRole}
                  onChange={(e) => setForm((f) => ({ ...f, baseRole: e.target.value, modules: [] }))}
                >
                  {BASE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Erişebileceği modüller ({form.modules.length} seçili)</label>
              <div className="mt-1 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-foreground/[0.08] p-2 md:grid-cols-3">
                {availableModules.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-foreground/[0.04]">
                    <input type="checkbox" checked={form.modules.includes(key)} onChange={() => toggleModule(key)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate}><Plus className="mr-1 h-4 w-4" /> Rolü oluştur</Button>
          </div>
        ) : null}

        <div className="divide-y divide-foreground/[0.06]">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-semibold">{r.name}</span>
                <Badge variant="outline" className="ml-2 text-[10px]">{r.baseRole}</Badge>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.modules.length} modül · {r.userCount} kullanıcı
                </span>
              </div>
              <button onClick={() => handleDelete(r)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {roles.length === 0 && !creating ? (
            <div className="py-3 text-sm text-muted-foreground">
              Henüz özel rol yok. "Yeni Rol" ile kurumunuza özgü bir rol tanımlayın (ör. Kayıt Sorumlusu);
              personel kaydında seçilebilir olur, modül erişimi otomatik sınırlanır.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
