import { useEffect, useState, useCallback } from 'react';
import { Network, Building2, ShieldCheck, Trash2, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import {
  fetchScopeGroups, createScopeGroup, deleteScopeGroup,
  fetchScopeTenants, assignTenantGroup,
  searchScopeUsers, fetchUserGrants, addUserGrant, removeUserGrant,
} from '../../lib/api/modules';

const LEVELS = [
  { value: 'Group', label: 'Grup (İl/İlçe/Marka)' },
  { value: 'Tenant', label: 'Kurum' },
  { value: 'Platform', label: 'Platform (tümü)' },
];

export default function ScopeManagement() {
  const { toast } = useToast();
  const [groups, setGroups] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [newGroup, setNewGroup] = useState({ name: '', parentGroupId: '' });

  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [grants, setGrants] = useState([]);
  const [newGrant, setNewGrant] = useState({ level: 'Group', targetId: '', accessMode: 'Manage' });

  const load = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([fetchScopeGroups().catch(() => []), fetchScopeTenants().catch(() => [])]);
      setGroups(Array.isArray(g) ? g : []);
      setTenants(Array.isArray(t) ? t : []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const groupName = (id) => groups.find((g) => g.id === id)?.name || '—';

  // ── Gruplar ──
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) { toast({ title: 'Grup adı zorunludur.', variant: 'destructive' }); return; }
    try {
      await createScopeGroup({ name: newGroup.name.trim(), parentGroupId: newGroup.parentGroupId || null });
      setNewGroup({ name: '', parentGroupId: '' });
      await load();
      toast({ title: 'Grup oluşturuldu.' });
    } catch (e) { toast({ title: e.message || 'Grup oluşturulamadı.', variant: 'destructive' }); }
  };
  const handleDeleteGroup = async (id) => {
    try { await deleteScopeGroup(id); await load(); toast({ title: 'Grup silindi.' }); }
    catch (e) { toast({ title: e.message || 'Silinemedi.', variant: 'destructive' }); }
  };

  // ── Kurum → grup ──
  const handleAssignTenant = async (tenantId, groupId) => {
    try { await assignTenantGroup(tenantId, groupId); await load(); }
    catch (e) { toast({ title: e.message || 'Atanamadı.', variant: 'destructive' }); }
  };

  // ── Kullanıcı grant'ları ──
  const handleSearchUsers = async () => {
    try { const res = await searchScopeUsers(userQuery); setUsers(Array.isArray(res) ? res : []); }
    catch { setUsers([]); }
  };
  const selectUser = async (u) => {
    setSelectedUser(u);
    try { setGrants(await fetchUserGrants(u.id)); } catch { setGrants([]); }
  };
  const handleAddGrant = async () => {
    if (!selectedUser) return;
    if (newGrant.level !== 'Platform' && !newGrant.targetId) {
      toast({ title: 'Hedef seçimi zorunludur.', variant: 'destructive' }); return;
    }
    try {
      await addUserGrant(selectedUser.id, {
        level: newGrant.level,
        targetId: newGrant.level === 'Platform' ? null : newGrant.targetId,
        accessMode: newGrant.accessMode,
      });
      setNewGrant({ level: 'Group', targetId: '', accessMode: 'Manage' });
      setGrants(await fetchUserGrants(selectedUser.id));
      toast({ title: 'Kapsam eklendi.' });
    } catch (e) { toast({ title: e.message || 'Eklenemedi.', variant: 'destructive' }); }
  };
  const handleRemoveGrant = async (grantId) => {
    try { await removeUserGrant(grantId); setGrants(await fetchUserGrants(selectedUser.id)); }
    catch (e) { toast({ title: e.message || 'Silinemedi.', variant: 'destructive' }); }
  };

  const targetOptions = newGrant.level === 'Group' ? groups.map((g) => ({ id: g.id, name: g.name }))
    : newGrant.level === 'Tenant' ? tenants.map((t) => ({ id: t.id, name: t.name })) : [];

  const selectCls = 'h-9 w-full rounded-md border border-foreground/[0.12] bg-background px-2 text-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 p-2 text-white"><Network className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold">Kapsam Yönetimi</h1>
          <p className="text-sm text-muted-foreground">Grup hiyerarşisi (İl/İlçe/Marka), kurum→grup bağlama ve kullanıcı yetki kapsamları.</p>
        </div>
      </div>

      {/* Gruplar */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4" /> Grup Hiyerarşisi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-48">
              <label className="text-xs text-muted-foreground">Grup adı</label>
              <Input value={newGroup.name} onChange={(e) => setNewGroup((s) => ({ ...s, name: e.target.value }))} placeholder="ör. Erzurum İl / Palandöken İlçe / X Markası" />
            </div>
            <div className="min-w-48">
              <label className="text-xs text-muted-foreground">Üst grup (opsiyonel)</label>
              <select className={selectCls} value={newGroup.parentGroupId} onChange={(e) => setNewGroup((s) => ({ ...s, parentGroupId: e.target.value }))}>
                <option value="">— Kök —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <Button onClick={handleCreateGroup}><Plus className="mr-1 h-4 w-4" /> Ekle</Button>
          </div>
          <div className="divide-y divide-foreground/[0.06]">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-semibold">{g.name}</span>
                  {g.parentGroupId ? <span className="ml-2 text-xs text-muted-foreground">↳ {groupName(g.parentGroupId)}</span> : null}
                  <span className="ml-2 text-xs text-muted-foreground">· {g.tenantCount} kurum</span>
                </div>
                <button onClick={() => handleDeleteGroup(g.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {groups.length === 0 ? <div className="py-4 text-sm text-muted-foreground">Henüz grup yok.</div> : null}
          </div>
        </CardContent>
      </Card>

      {/* Kurum → grup */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Kurumları Gruba Bağla</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {tenants.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{t.name}</span>
              <select className={`${selectCls} max-w-64`} value={t.groupId || ''} onChange={(e) => handleAssignTenant(t.id, e.target.value)}>
                <option value="">— Grupsuz —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          ))}
          {tenants.length === 0 ? <div className="py-4 text-sm text-muted-foreground">Kurum yok.</div> : null}
        </CardContent>
      </Card>

      {/* Kullanıcı kapsamları */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Kullanıcı Kapsamları (Grant)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Kullanıcı ara (ad / kullanıcı adı)" onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()} />
            <Button variant="outline" onClick={handleSearchUsers}><Search className="h-4 w-4" /></Button>
          </div>
          {users.length > 0 && !selectedUser ? (
            <div className="divide-y divide-foreground/[0.06] rounded-md border border-foreground/[0.08]">
              {users.map((u) => (
                <button key={u.id} onClick={() => selectUser(u)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-foreground/[0.03]">
                  <span className="font-semibold">{u.fullName}</span>
                  <span className="text-xs text-muted-foreground">{u.username} · {u.primaryRole}</span>
                </button>
              ))}
            </div>
          ) : null}

          {selectedUser ? (
            <div className="space-y-3 rounded-md border border-foreground/[0.08] p-3">
              <div className="flex items-center justify-between">
                <div><span className="font-semibold">{selectedUser.fullName}</span> <span className="text-xs text-muted-foreground">{selectedUser.username}</span></div>
                <button onClick={() => { setSelectedUser(null); setGrants([]); }} className="text-xs text-muted-foreground hover:underline">değiştir</button>
              </div>
              <div className="space-y-1">
                {grants.map((gr) => (
                  <div key={gr.id} className="flex items-center justify-between rounded bg-foreground/[0.03] px-3 py-1.5 text-sm">
                    <span>
                      <span className="font-semibold">{gr.level}</span> · {gr.targetName}
                      <span className="ml-2 text-xs text-muted-foreground">{gr.accessMode}{gr.isHome ? ' · ev' : ''}</span>
                    </span>
                    {gr.isHome ? null : <button onClick={() => handleRemoveGrant(gr.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
                {grants.length === 0 ? <div className="text-sm text-muted-foreground">Kapsam yok.</div> : null}
              </div>
              <div className="flex flex-wrap items-end gap-2 border-t border-foreground/[0.06] pt-3">
                <div className="min-w-40">
                  <label className="text-xs text-muted-foreground">Seviye</label>
                  <select className={selectCls} value={newGrant.level} onChange={(e) => setNewGrant((s) => ({ ...s, level: e.target.value, targetId: '' }))}>
                    {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                {newGrant.level !== 'Platform' ? (
                  <div className="min-w-48 flex-1">
                    <label className="text-xs text-muted-foreground">Hedef</label>
                    <select className={selectCls} value={newGrant.targetId} onChange={(e) => setNewGrant((s) => ({ ...s, targetId: e.target.value }))}>
                      <option value="">— Seç —</option>
                      {targetOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                ) : null}
                <div className="min-w-32">
                  <label className="text-xs text-muted-foreground">Erişim</label>
                  <select className={selectCls} value={newGrant.accessMode} onChange={(e) => setNewGrant((s) => ({ ...s, accessMode: e.target.value }))}>
                    <option value="Manage">Yönetim</option>
                    <option value="ReadOnly">Salt-okunur</option>
                  </select>
                </div>
                <Button onClick={handleAddGrant}><Plus className="mr-1 h-4 w-4" /> Kapsam ekle</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
