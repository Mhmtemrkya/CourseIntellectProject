import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { LoadingDots } from '../animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createCustomRole, fetchRoleModuleCatalog } from '../../lib/api/modules';

/**
 * Rol oluşturma penceresi — yetki matrisiyle.
 *
 * Kurum yöneticisi bir rol adı, taban rol ve rolün GÖREBİLECEĞİ SAYFALARI seçer.
 * Hiçbir sayfa seçmemek geçerli bir tercihtir: rol yalnız kendi profilini görür.
 *
 * Güvenlik notları:
 *  • Katalog SUNUCUDAN gelir ve kaydederken sunucu yine aynı katalogla doğrular;
 *    istemcinin uydurduğu anahtar kabul edilmez. Platform yönetimi sayfaları
 *    katalogda yoktur — kurum yöneticisi kendine platform yetkisi veremez.
 *  • İstek daima `modulesRestricted: true` gönderir. Bu bayrak olmadan boş liste
 *    sunucuda "kısıt yok" (tam yetki) anlamına gelirdi.
 *  • "Kapalı" işaretli sayfaların API'si de kapanır (enforced); yalnız menüde
 *    gizlenen sayfalar matriste ayrıca etiketlenir, yanlış güven oluşmasın.
 */

const BASE_ROLES = [
  { value: 'Administrative', label: 'İdari Personel', hint: 'Sekreter, kayıt görevlisi, müdür yardımcısı' },
  { value: 'Teacher', label: 'Öğretmen', hint: 'Derse giren kadro' },
  { value: 'Cafeteria', label: 'Yemekhane', hint: 'Yemekhane personeli' },
];

export default function RoleCreateDialog({ open, onClose, onCreated }) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [baseRole, setBaseRole] = useState('Administrative');
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchRoleModuleCatalog();
      setCatalog(data?.groups || []);
    } catch (err) {
      setLoadError(err.message || 'Sayfa kataloğu alınamadı.');
      setCatalog(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Pencere her açılışta sıfırdan başlar: önceki denemenin seçimi sızmasın.
    setName('');
    setBaseRole('Administrative');
    setSelected(new Set());
    setSaving(false);
    load();
  }, [open, load]);

  const groups = catalog || [];
  const allKeys = useMemo(
    () => groups.flatMap((group) => (group.items || []).map((item) => item.key)),
    [groups],
  );

  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const toggleGroup = (group) => setSelected((prev) => {
    const keys = (group.items || []).map((item) => item.key);
    const allOn = keys.every((key) => prev.has(key));
    const next = new Set(prev);
    keys.forEach((key) => (allOn ? next.delete(key) : next.add(key)));
    return next;
  });

  const submit = async () => {
    const cleanName = name.trim();
    if (cleanName.length < 3) {
      toast({ title: 'Rol adı en az 3 karakter olmalı', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const role = await createCustomRole({
        name: cleanName,
        baseRole,
        modules: [...selected],
        // Boş liste "hiçbir sayfa" demek; bayrak olmadan sunucu "tam yetki" sayar.
        modulesRestricted: true,
      });
      toast({
        title: 'Rol oluşturuldu',
        description: `${role.name} — ${selected.size === 0 ? 'sayfa yetkisi verilmedi' : `${selected.size} sayfa`}`,
      });
      onCreated?.(role);
      onClose?.();
    } catch (err) {
      toast({ title: 'Rol oluşturulamadı', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose?.(); }}>
      <DialogContent
        className="z-[70] max-h-[92vh] max-w-3xl overflow-y-auto"
        overlayClassName="z-[65]"
        data-testid="role-create-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-primary" /> Yeni Rol
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="role-name">Rol adı</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Örn: Kayıt Sorumlusu"
                maxLength={80}
                disabled={saving}
                autoFocus
                className="mt-1"
              />
            </div>
            <div>
              <Label>Taban rol</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {BASE_ROLES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    disabled={saving}
                    title={item.hint}
                    onClick={() => setBaseRole(item.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                      baseRole === item.value
                        ? 'bg-brand-primary text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {BASE_ROLES.find((item) => item.value === baseRole)?.hint}
              </p>
            </div>
          </div>

          {/* ── Yetki matrisi ── */}
          <div className="rounded-2xl border border-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
              <div>
                <p className="text-sm font-bold">Yetki matrisi</p>
                <p className="text-xs text-muted-foreground">
                  Rolün görebileceği sayfaları işaretleyin. Hiçbirini seçmemek de geçerlidir.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-bold"
                  data-testid="role-selected-count"
                >
                  {selected.size} / {allKeys.length} sayfa
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving || allKeys.length === 0}
                  onClick={() => setSelected((prev) => (prev.size === allKeys.length ? new Set() : new Set(allKeys)))}
                >
                  {selected.size === allKeys.length && allKeys.length > 0 ? 'Tümünü kaldır' : 'Tümünü seç'}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-center"><LoadingDots /></div>
            ) : loadError ? (
              <div className="flex items-start gap-2 p-4 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-600">{loadError}</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={load}>Tekrar dene</Button>
                </div>
              </div>
            ) : (
              <div className="max-h-[46vh] space-y-4 overflow-y-auto p-4">
                {groups.map((group) => {
                  const keys = (group.items || []).map((item) => item.key);
                  const onCount = keys.filter((key) => selected.has(key)).length;
                  return (
                    <div key={group.title}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {group.title} <span className="ml-1 normal-case">({onCount}/{keys.length})</span>
                        </p>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => toggleGroup(group)}
                          className="text-xs font-semibold text-brand-primary hover:underline"
                        >
                          {onCount === keys.length ? 'Grubu kaldır' : 'Grubu seç'}
                        </button>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {(group.items || []).map((item) => (
                          <label
                            key={item.key}
                            data-testid={`role-module-${item.key}`}
                            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-sm transition ${
                              selected.has(item.key)
                                ? 'border-brand-primary bg-brand-primary/[0.06]'
                                : 'border-foreground/10 hover:border-brand-primary/40'
                            }`}
                          >
                            <Checkbox
                              checked={selected.has(item.key)}
                              onCheckedChange={() => toggle(item.key)}
                              disabled={saving}
                              aria-label={item.label}
                            />
                            <span className="min-w-0">
                              <span className="block font-semibold">{item.label}</span>
                              {/* Sadece menüde gizlenen sayfalar açıkça ayrılır ki
                                  "kapattım, verisi de kapandı" yanılgısı olmasın. */}
                              {item.enforced ? null : (
                                <span className="block text-[11px] text-amber-600">Yalnız menüde gizlenir</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selected.size === 0 && !loading && !loadError ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/[0.07] p-3 text-xs font-semibold text-amber-700">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                Hiçbir sayfa seçilmedi. Bu rolle giriş yapan personel yalnız kendi profilini görür;
                diğer ekranların verisine sunucu tarafında da erişemez.
              </span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button onClick={submit} disabled={saving || loading || !!loadError}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Oluşturuluyor…</>
              : <><Check className="mr-2 h-4 w-4" />Rolü Oluştur</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
