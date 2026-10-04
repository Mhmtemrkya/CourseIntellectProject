import { useEffect, useState } from 'react';
import { Trash2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { errorMessage } from '../../lib/errors';
import {
  getPlatformInstitutionDeletions,
  getPlatformAccountDeletions,
  decideInstitutionDeletion,
  type InstitutionDeletionQueueItem,
  type AccountDeletionQueueItem,
} from '../../lib/api/accountDeletion';

/// Platform yöneticisi: kurum silme onay/ret + kurum-yöneticisi hesap silme görünümü.
export function DeletionReviewPanel() {
  const { toast } = useToast();
  const [institutions, setInstitutions] = useState<InstitutionDeletionQueueItem[]>([]);
  const [accounts, setAccounts] = useState<AccountDeletionQueueItem[]>([]);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const [inst, acc] = await Promise.all([
        getPlatformInstitutionDeletions(),
        getPlatformAccountDeletions(),
      ]);
      setInstitutions(inst);
      setAccounts(acc);
    } catch (e) {
      toast({ title: 'Hata', description: errorMessage(e), variant: 'destructive' });
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (id: string, approve: boolean) => {
    setBusy(true);
    try {
      await decideInstitutionDeletion(id, approve, approve ? undefined : rejectReasons[id]);
      toast({ title: approve ? 'Onaylandı' : 'Reddedildi' });
      await reload();
    } catch (e) {
      toast({ title: 'İşlem başarısız', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (institutions.length === 0 && accounts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-600" /> Silme Talepleri
        </CardTitle>
        <CardDescription>Kurum silme onayları ve kurum yöneticisi hesap silme talepleri.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {institutions.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-semibold">Kurum silme (onay gerekli)</div>
            {institutions.map((item) => (
              <div key={item.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.tenantName || item.tenantId}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                  <Impact label="Kullanıcı" value={item.impact.userCount} />
                  <Impact label="Öğrenci" value={item.impact.studentCount} />
                  <Impact label="Dosya" value={item.impact.fileCount} />
                  <Impact label="Finans" value={item.impact.financeRecordCount} />
                  <Impact label="Eğitim" value={item.impact.educationRecordCount} />
                </div>
                {item.status === 'PendingPlatformApproval' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Red gerekçesi (reddederken)"
                      value={rejectReasons[item.id] ?? ''}
                      onChange={(e) => setRejectReasons((r) => ({ ...r, [item.id]: e.target.value }))}
                      className="flex-1 min-w-48"
                    />
                    <Button size="sm" variant="outline" disabled={busy || !(rejectReasons[item.id] ?? '').trim()}
                      onClick={() => decide(item.id, false)}>
                      <X className="h-4 w-4 mr-1" /> Reddet
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide(item.id, true)}>
                      <Check className="h-4 w-4 mr-1" /> Onayla (zamanla)
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {accounts.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Kurum yöneticisi hesap silme talepleri (yalnız görüntüleme)</div>
            {accounts.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.userDisplayName} · {item.requesterRole}</span>
                <Badge variant="outline">{item.remainingDays} gün · {item.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Impact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
