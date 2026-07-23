import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ReceiptText, RotateCcw, Search, UserRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { FeatureGate } from '../../components/FeatureGate';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/use-toast';
import {
  fetchDrivingCharges,
  fetchDrivingCollectionList,
  fetchFinanceSummaries,
  fetchStudentFinanceAccount,
  refundDrivingCharge,
  refundFinancePayment,
} from '../../lib/api/modules';
import { resolveUserInstitutionType } from '../../lib/auth';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { assetUrl } from '../../lib/assetUrl';

const EMPTY_FORM = {
  amount: '',
  type: 'PaymentReversal',
  channel: 'Nakit',
  reference: '',
  reason: '',
};

const CHARGE_LABELS = {
  ExtraLesson: 'Ek direksiyon dersi',
  ExamFee: 'Sınav ücreti',
  FileFee: 'Dosya masrafı',
  ExtraService: 'Ek hizmet',
  PackageDifference: 'Paket / vites farkı',
  Other: 'Diğer ücret',
};

function money(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(Number(value) || 0);
}

function dateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

function paymentLabel(item) {
  return item.receiptNo || item.description || 'Tahsilat';
}

export default function Refunds() {
  const { user } = useApp();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, loading: permissionLoading } = useDrivingPermissions();
  const isDrivingSchool = resolveUserInstitutionType(user) === 'DrivingSchool';
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('student') || '');
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = isDrivingSchool ? await fetchDrivingCollectionList() : await fetchFinanceSummaries();
      setStudents((Array.isArray(rows) ? rows : []).map((row) => ({
        ...row,
        id: String(isDrivingSchool ? row.profileId : row.studentUserId || row.studentName),
        name: isDrivingSchool ? row.fullName : row.studentName,
        secondary: isDrivingSchool
          ? row.studentNumber != null ? `Kursiyer No: #${row.studentNumber}` : row.groupName || ''
          : row.className || '',
      })));
    } catch (err) {
      setError(err.message || 'İade verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [isDrivingSchool]);

  const loadDetail = useCallback(async (studentId) => {
    if (!studentId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setError('');
    setSelectedRecord(null);
    setForm(EMPTY_FORM);
    try {
      if (isDrivingSchool) {
        setDetail({ charges: await fetchDrivingCharges(studentId) || [], currency: 'TRY' });
      } else {
        const student = students.find((item) => item.id === String(studentId));
        setDetail(await fetchStudentFinanceAccount({
          studentUserId: student?.studentUserId || undefined,
          studentName: student?.studentName || student?.name || '',
        }));
      }
    } catch (err) {
      setDetail(null);
      setError(err.message || 'Kursiyer hesabı yüklenemedi.');
    } finally {
      setDetailLoading(false);
    }
  }, [isDrivingSchool, students]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => {
    if (selectedId && students.length > 0) {
      const exists = students.some((item) => item.id === String(selectedId));
      if (exists) loadDetail(selectedId);
    }
  }, [loadDetail, selectedId, students.length]);

  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return students;
    return students.filter((item) =>
      `${item.name || ''} ${item.secondary || ''}`.toLocaleLowerCase('tr-TR').includes(needle));
  }, [search, students]);

  const records = isDrivingSchool ? detail?.charges || [] : detail?.payments || [];
  const refundable = records.filter((item) => (
    isDrivingSchool
      ? !item.refundedAtUtc && Number(item.netAmount) > 0
      : item.entryType !== 'Refund' && Number(item.amount) > 0 && Number(item.refundableAmount) > 0
  ));
  const history = records.filter((item) => (
    isDrivingSchool ? !!item.refundedAtUtc : item.entryType === 'Refund' || Number(item.amount) < 0
  ));
  const currency = detail?.currency || 'TRY';
  const selectedStudent = students.find((item) => item.id === String(selectedId));
  const refundableTotal = refundable.reduce(
    (sum, item) => sum + Number(isDrivingSchool ? item.netAmount : item.refundableAmount || 0), 0,
  );
  const refundedTotal = history.reduce(
    (sum, item) => sum + Math.abs(Number(isDrivingSchool ? item.refundedAmount : item.amount || 0)), 0,
  );
  const maxAmount = selectedRecord
    ? Number(isDrivingSchool
      ? selectedRecord.netAmount
      : form.type === 'AdvanceReturn'
        ? selectedRecord.unallocatedRefundableAmount || 0
        : form.type === 'ContractReduction' && Number(selectedRecord.allocatedRefundableAmount || 0) > 0
          ? selectedRecord.allocatedRefundableAmount
          : selectedRecord.refundableAmount || 0)
    : 0;
  const canSubmitDrivingRefund = !permissionLoading && can(DRIVING.financeRefund);

  function selectStudent(student) {
    setSelectedId(student.id);
    setSearchParams({ student: student.id }, { replace: true });
  }

  function startRefund(record) {
    const normalizedMethod = String(record.method || '').toLocaleLowerCase('tr-TR');
    setSelectedRecord(record);
    setForm({
      ...EMPTY_FORM,
      amount: String(isDrivingSchool ? record.netAmount : record.refundableAmount || ''),
      channel: normalizedMethod.includes('kart') || normalizedMethod.includes('online')
        ? 'Karta İade'
        : normalizedMethod.includes('havale') || normalizedMethod.includes('eft')
          ? 'Havale/EFT'
          : 'Nakit',
    });
  }

  async function submitRefund(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!selectedRecord || !amount || amount <= 0 || amount > maxAmount) {
      toast({ title: 'Geçerli bir iade tutarı girin.', variant: 'destructive' });
      return;
    }
    if (form.reason.trim().length < (isDrivingSchool ? 5 : 1)) {
      toast({ title: isDrivingSchool ? 'Gerekçe en az 5 karakter olmalıdır.' : 'İade gerekçesi zorunludur.', variant: 'destructive' });
      return;
    }
    if (!isDrivingSchool && form.channel !== 'Nakit' && !form.reference.trim()) {
      toast({ title: 'Kart ve banka iadelerinde işlem referansı zorunludur.', variant: 'destructive' });
      return;
    }

    try {
      setBusy(true);
      if (isDrivingSchool) {
        await refundDrivingCharge(selectedRecord.id, { amount, reason: form.reason.trim() });
      } else {
        await refundFinancePayment({
          paymentId: selectedRecord.id,
          amount,
          refundType: form.type,
          reason: form.reason.trim(),
          refundChannel: form.channel,
          externalReference: form.reference.trim() || null,
        });
      }
      toast({ title: 'İade başarıyla işlendi', description: money(amount, currency) });
      setSelectedRecord(null);
      setForm(EMPTY_FORM);
      await loadDetail(selectedId);
    } catch (err) {
      toast({ title: 'İade yapılamadı', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const refundForm = selectedRecord ? (
    <form onSubmit={submitRefund} className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-black"><RotateCcw className="h-4 w-4 text-red-600" /> İade bilgileri</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isDrivingSchool ? CHARGE_LABELS[selectedRecord.chargeType] || selectedRecord.chargeType : paymentLabel(selectedRecord)}
            {' · '}En fazla {money(maxAmount, currency)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedRecord(null)} disabled={busy}>Vazgeç</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {!isDrivingSchool && (
          <label className="text-xs font-bold">İade türü
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.type} onChange={(e) => {
              const nextType = e.target.value;
              const nextMax = nextType === 'AdvanceReturn'
                ? Number(selectedRecord.unallocatedRefundableAmount || 0)
                : nextType === 'ContractReduction' && Number(selectedRecord.allocatedRefundableAmount || 0) > 0
                  ? Number(selectedRecord.allocatedRefundableAmount)
                  : Number(selectedRecord.refundableAmount || 0);
              setForm({ ...form, type: nextType, amount: String(Math.min(Number(form.amount) || nextMax, nextMax)) });
            }}>
              <option value="PaymentReversal">Tahsilat iptali / düzeltmesi</option>
              {!selectedRecord.isDownPayment && <option value="AdvanceReturn">Fazla ödeme / avans iadesi</option>}
              {!selectedRecord.isDownPayment && <option value="ContractReduction">Ücret indirimi kaynaklı iade</option>}
            </select>
          </label>
        )}
        <label className="text-xs font-bold">İade tutarı
          <Input className="mt-1" type="number" min="0.01" step="0.01" max={maxAmount} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </label>
        {!isDrivingSchool && (
          <>
            <label className="text-xs font-bold">İade kanalı
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option>Nakit</option><option>Karta İade</option><option>Havale/EFT</option>
              </select>
            </label>
            <label className="text-xs font-bold">Banka / POS referansı
              <Input className="mt-1" placeholder={form.channel === 'Nakit' ? 'İsteğe bağlı' : 'Zorunlu'} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </label>
          </>
        )}
        <label className="text-xs font-bold sm:col-span-2">İade gerekçesi
          <textarea className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={500} placeholder="İşlem geçmişinde görünecek zorunlu açıklama" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </label>
      </div>
      <div className="rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-bold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-600" /> İşlem geri alınamaz.</p>
        <p className="mt-1">Yetki, iade edilebilir tutar ve mükerrer işlem kontrolleri sunucuda yeniden doğrulanır; gerekçe denetim kaydına yazılır.</p>
      </div>
      <Button type="submit" disabled={busy || Number(form.amount) <= 0 || Number(form.amount) > maxAmount || !form.reason.trim()} className="w-full bg-red-600 text-white hover:bg-red-700">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} İadeyi Onayla
      </Button>
    </form>
  ) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 text-white shadow-lg">
          <RotateCcw className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">İadeler</h1>
          <p className="mt-1 text-muted-foreground">Kursiyer tahsilatlarını tek ve denetlenebilir bir ekrandan yönetin.</p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['İade Edilebilir', money(refundableTotal, currency), ReceiptText, 'text-emerald-600 bg-emerald-500/10'],
          ['İade Edilen', money(refundedTotal, currency), CheckCircle2, 'text-red-600 bg-red-500/10'],
          ['Seçili Kursiyer', selectedStudent?.name || 'Seçilmedi', UserRound, 'text-blue-600 bg-blue-500/10'],
        ].map(([label, value, Icon, tone]) => (
          <Card key={label}><CardContent className="flex items-center gap-3 p-4">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-black">{value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Kursiyer seçin</CardTitle></CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Ad veya kursiyer no ara" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? <div className="py-8 text-center"><LoadingDots /></div> : (
              <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                {filteredStudents.map((student) => (
                  <button key={student.id} type="button" onClick={() => selectStudent(student)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedId === student.id ? 'border-red-500/50 bg-red-500/[0.07]' : 'hover:bg-muted/60'}`}>
                    {student.displayPhotoUrl || student.livePhotoUrl || student.photoUrl
                      ? <img src={assetUrl(student.displayPhotoUrl || student.livePhotoUrl || student.photoUrl)} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                      : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted"><UserRound className="h-5 w-5" /></div>}
                    <div className="min-w-0"><p className="truncate text-sm font-black">{student.name}</p><p className="truncate text-xs text-muted-foreground">{student.secondary || 'Finans hesabı'}</p></div>
                  </button>
                ))}
                {filteredStudents.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Eşleşen kursiyer bulunamadı.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-5">
          {!selectedId ? (
            <Card><CardContent className="py-16 text-center"><UserRound className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-bold">İşlem yapmak için bir kursiyer seçin.</p></CardContent></Card>
          ) : detailLoading ? (
            <Card><CardContent className="py-16 text-center"><LoadingDots /></CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ReceiptText className="h-5 w-5" /> İade edilebilir işlemler</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {refundable.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-black">{isDrivingSchool ? CHARGE_LABELS[item.chargeType] || item.chargeType : paymentLabel(item)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{dateTime(item.createdAtUtc || item.paidAtUtc)}{item.method ? ` · ${item.method}` : ''}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="text-right"><p className="font-black">{money(isDrivingSchool ? item.netAmount : item.refundableAmount, currency)}</p><p className="text-[11px] text-muted-foreground">İade edilebilir</p></div>
                        {isDrivingSchool ? (
                          canSubmitDrivingRefund && <Button variant="outline" className="border-red-500/30 text-red-600" onClick={() => startRefund(item)}>İade Et</Button>
                        ) : (
                          <FeatureGate module="collections" action="refund">
                            <Button variant="outline" className="border-red-500/30 text-red-600" onClick={() => startRefund(item)}>İade Et</Button>
                          </FeatureGate>
                        )}
                      </div>
                    </div>
                  ))}
                  {refundable.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Bu kursiyer için iade edilebilir işlem yok.</p>}
                </CardContent>
              </Card>

              {selectedRecord && (isDrivingSchool ? canSubmitDrivingRefund : true)
                ? isDrivingSchool ? refundForm : <FeatureGate module="collections" action="refund">{refundForm}</FeatureGate>
                : null}

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><RotateCcw className="h-5 w-5" /> İade geçmişi</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="font-black">{isDrivingSchool ? CHARGE_LABELS[item.chargeType] || item.chargeType : paymentLabel(item)}</p><p className="mt-1 text-xs text-muted-foreground">{dateTime(item.refundedAtUtc || item.paidAtUtc)}</p></div>
                        <Badge className="border-0 bg-red-500/10 text-red-600">{money(Math.abs(Number(isDrivingSchool ? item.refundedAmount : item.amount)), currency)}</Badge>
                      </div>
                      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{item.refundReason || item.note || 'Gerekçe kaydı'}{item.externalReference ? ` · Referans: ${item.externalReference}` : ''}</p>
                    </div>
                  ))}
                  {history.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Henüz iade kaydı yok.</p>}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
