import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, Hourglass, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { errorMessage } from '../../lib/errors';
import {
  getMyAccountDeletion,
  requestAccountDeletion,
  cancelMyAccountDeletion,
  getMyInstitutionDeletion,
  requestInstitutionDeletion,
  getTenantDeletionQueue,
  getSuccessorCandidates,
  type AccountDeletionStatus,
  type InstitutionDeletionStatus,
  type AccountDeletionQueueItem,
  type SuccessorCandidate,
} from '../../lib/api/accountDeletion';

const ACTIVE_ACCOUNT = new Set(['Pending', 'Scheduled']);
const ACTIVE_INSTITUTION = new Set(['PendingPlatformApproval', 'Approved', 'Scheduled']);

export function AccountDeletionSection() {
  const { user } = useApp();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [account, setAccount] = useState<AccountDeletionStatus | null>(null);
  const [institution, setInstitution] = useState<InstitutionDeletionStatus | null>(null);
  const [queue, setQueue] = useState<AccountDeletionQueueItem[]>([]);
  const [candidates, setCandidates] = useState<SuccessorCandidate[]>([]);
  const [successorId, setSuccessorId] = useState('');
  const [accPassword, setAccPassword] = useState('');
  const [accConfirm, setAccConfirm] = useState(false);
  const [instPassword, setInstPassword] = useState('');
  const [instConfirm, setInstConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const [acc, inst, q, cand] = await Promise.all([
        getMyAccountDeletion(),
        isAdmin ? getMyInstitutionDeletion() : Promise.resolve(null),
        isAdmin ? getTenantDeletionQueue() : Promise.resolve([]),
        isAdmin ? getSuccessorCandidates() : Promise.resolve([]),
      ]);
      setAccount(acc);
      setInstitution(inst);
      setQueue(q);
      setCandidates(cand);
    } catch (e) {
      toast({ title: 'Hata', description: errorMessage(e), variant: 'destructive' });
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountActive = account ? ACTIVE_ACCOUNT.has(account.status) : false;
  const institutionActive = institution ? ACTIVE_INSTITUTION.has(institution.status) : false;

  const submitAccount = async () => {
    setBusy(true);
    try {
      const result = await requestAccountDeletion(accPassword, successorId || undefined);
      setAccount(result);
      setAccPassword('');
      setAccConfirm(false);
      toast({ title: 'Talep alındı', description: 'Hesap silme talebiniz oluşturuldu.' });
    } catch (e) {
      toast({ title: 'İşlem başarısız', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const cancelAccount = async () => {
    setBusy(true);
    try {
      setAccount(await cancelMyAccountDeletion());
      toast({ title: 'İptal edildi', description: 'Silme talebiniz iptal edildi.' });
    } catch (e) {
      toast({ title: 'İşlem başarısız', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const submitInstitution = async () => {
    setBusy(true);
    try {
      const result = await requestInstitutionDeletion(instPassword);
      setInstitution(result);
      setInstPassword('');
      setInstConfirm(false);
      toast({ title: 'Talep alındı', description: 'Kurum silme talebiniz platform onayına gönderildi.' });
    } catch (e) {
      toast({ title: 'İşlem başarısız', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-red-300 dark:border-red-900/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" /> Tehlikeli Bölge
        </CardTitle>
        <CardDescription>Hesap ve kurum silme işlemleri geri alınamaz.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Kişisel hesap silme */}
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 p-4 space-y-3">
          <div className="font-semibold">Hesabımı Sil</div>
          {accountActive ? (
            <div className="flex items-center gap-3">
              <Hourglass className="h-5 w-5 text-amber-500" />
              <div className="flex-1 text-sm">
                Silme talebiniz işleniyor — kalan süre <b>{account?.remainingDays ?? 0} gün</b>.
                Süre dolana kadar iptal edebilirsiniz.
              </div>
              <Button variant="outline" size="sm" disabled={busy} onClick={cancelAccount}>
                <Undo2 className="h-4 w-4 mr-1" /> İptal et
              </Button>
            </div>
          ) : (
            <>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                {(account?.retainedRecordsExplanation ?? []).map((line, i) => <li key={i}>{line}</li>)}
              </ul>
              {isAdmin && (
                <div className="space-y-1">
                  <Label htmlFor="successor">Yönetimi devredeceğiniz kişi (tek yöneticiyseniz zorunlu)</Label>
                  <select id="successor" value={successorId} onChange={(e) => setSuccessorId(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                    <option value="">Seçiniz…</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>{c.fullName} · {c.role}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="acc-pass">Parola (yeniden doğrulama)</Label>
                  <Input id="acc-pass" type="password" value={accPassword}
                    onChange={(e) => setAccPassword(e.target.value)} className="w-56" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={accConfirm} onChange={(e) => setAccConfirm(e.target.checked)} />
                  Silmeyi onaylıyorum
                </label>
                <Button variant="destructive" disabled={busy || !accConfirm || !accPassword} onClick={submitAccount}>
                  <Trash2 className="h-4 w-4 mr-1" /> Hesabımı sil
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Kurum silme (yalnız yönetici) */}
        {isAdmin && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 p-4 space-y-3">
            <div className="font-semibold">Kurumu Sil</div>
            {institutionActive ? (
              <div className="flex items-center gap-3 text-sm">
                <Hourglass className="h-5 w-5 text-amber-500" />
                <span>
                  Durum: <b>{institution?.status}</b>
                  {institution?.rejectReason ? ` — Red: ${institution.rejectReason}` : ''}
                </span>
              </div>
            ) : (
              <>
                {institution?.impact && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                    <Impact label="Kullanıcı" value={institution.impact.userCount} />
                    <Impact label="Öğrenci" value={institution.impact.studentCount} />
                    <Impact label="Dosya" value={institution.impact.fileCount} />
                    <Impact label="Finans" value={institution.impact.financeRecordCount} />
                    <Impact label="Eğitim" value={institution.impact.educationRecordCount} />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Bu talep platform yöneticisinin onayına düşer. Onaylanırsa kurum verileri temizlenir;
                  finans ve eğitim kayıtları kişisel bilgiler silinerek anonim saklanır.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="inst-pass">Parola</Label>
                    <Input id="inst-pass" type="password" value={instPassword}
                      onChange={(e) => setInstPassword(e.target.value)} className="w-56" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={instConfirm} onChange={(e) => setInstConfirm(e.target.checked)} />
                    Kurumu silmeyi onaylıyorum
                  </label>
                  <Button variant="destructive" disabled={busy || !instConfirm || !instPassword} onClick={submitInstitution}>
                    <Trash2 className="h-4 w-4 mr-1" /> Kurum silme talebi
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Yönetici görünümü: kurumdaki kişisel silme talepleri (yalnız görüntüleme) */}
        {isAdmin && queue.length > 0 && (
          <div className="rounded-xl border p-4 space-y-2">
            <div className="font-semibold text-sm">Kurumdaki silme talepleri (yalnız görüntüleme)</div>
            {queue.map((item) => (
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
