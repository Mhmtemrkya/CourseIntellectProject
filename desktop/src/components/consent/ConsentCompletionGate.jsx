import { useCallback, useEffect, useState } from 'react';
import { fetchAppointmentConsentStatus, fetchConsentStatus } from '../../lib/api/modules';
import ConsentCenter from './ConsentCenter';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

/**
 * "Tamamlandı" akışının ilk adımındaki onam kapısı.
 *
 * Kapı bilerek YUMUŞAKTIR: eksik form varsa uyarır, formları açma imkânı verir,
 * ama "İmzasız devam et" seçeneğini bırakır. Sert engel kurumun işini durdurur;
 * imzasız işlem yapıldığını görünür kılmak yeterlidir (aynı uyarı öğrenci kartı,
 * cari hesap ve adisyon ekranlarında da durur).
 *
 * Kullanım:
 *   const gate = useConsentGate({ appointmentId });
 *   ...
 *   <ConsentCompletionGate {...gate.props} />
 *   onTamamla={() => gate.run(() => reallyComplete())}
 */
export function useConsentGate(defaults = {}) {
  const [pending, setPending] = useState(null);
  const [status, setStatus] = useState(null);
  // Liste ekranlarında hedef satır satır değişir; run() çağrısındaki hedef
  // burada tutulur ki "formları görüntüle" ve yeniden değerlendirme aynı kayda baksın.
  const [target, setTarget] = useState(defaults);

  const check = useCallback(async (scope) => {
    try {
      if (scope.appointmentId) return await fetchAppointmentConsentStatus(scope.appointmentId);
      if (scope.studentProfileId) {
        const params = {};
        if (scope.contextKind) params.contextKind = scope.contextKind;
        if (scope.contextKey) params.contextKey = scope.contextKey;
        if (scope.contextRefId) params.contextRefId = scope.contextRefId;
        return await fetchConsentStatus(scope.studentProfileId, params);
      }
    } catch {
      // Durum okunamıyorsa kapı hiç kurulmaz — iş akışı asla onam yüzünden kilitlenmez.
    }
    return null;
  }, []);

  const run = useCallback(async (proceed, overrides) => {
    const raw = { ...defaults, ...(overrides || {}) };
    // Randevu kapısında yeni açılacak formlar o randevuya bağlanmalı; aksi hâlde
    // bir sonraki derste aynı form yeniden "imzalı" sayılır.
    const scope = raw.appointmentId
      ? { ...raw, contextKind: raw.contextKind || 'DrivingLesson', contextRefId: raw.contextRefId || raw.appointmentId }
      : raw;
    const next = await check(scope);
    if (!next || next.complete || next.requiredCount === 0) {
      await proceed();
      return;
    }
    setTarget(scope);
    setStatus(next);
    setPending(() => proceed);
  }, [check, defaults]);

  const close = useCallback(() => {
    setPending(null);
    setStatus(null);
  }, []);

  return {
    run,
    props: {
      status,
      open: Boolean(pending),
      onClose: close,
      onProceed: async () => {
        const proceed = pending;
        close();
        if (proceed) await proceed();
      },
      recheck: async () => {
        const next = await check(target);
        setStatus(next);
        if (next?.complete) {
          const proceed = pending;
          close();
          if (proceed) await proceed();
        }
      },
      studentProfileId: target.studentProfileId,
      contextKind: target.contextKind,
      contextKey: target.contextKey,
      contextRefId: target.contextRefId,
    },
  };
}

export default function ConsentCompletionGate({
  status,
  open,
  onClose,
  onProceed,
  recheck,
  studentProfileId,
  contextKind,
  contextKey,
  contextRefId,
}) {
  const [centerOpen, setCenterOpen] = useState(false);
  const missing = (status?.requiredCount || 0) - (status?.signedCount || 0);

  useEffect(() => {
    if (!open) setCenterOpen(false);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <Dialog open={open && !centerOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Eksik onam formu var</DialogTitle>
            <DialogDescription>
              Bu işlem için gereken {missing} form henüz imzalanmadı.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1 text-sm">
            {(status?.requirements || [])
              .filter((row) => row.status !== 'Signed')
              .map((row) => (
                <li key={row.templateId} className="rounded-lg border border-border/50 px-3 py-2">
                  {row.title}
                </li>
              ))}
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onProceed}>
              İmzasız devam et
            </Button>
            <Button onClick={() => setCenterOpen(true)}>Onam formlarını görüntüle</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConsentCenter
        open={centerOpen}
        onOpenChange={async (next) => {
          setCenterOpen(next);
          // Formlar imzalandıysa kapı kendini yeniden değerlendirip geçer.
          if (!next) await recheck();
        }}
        // Randevu üzerinden gelen kapıda öğrenci kimliği durum yanıtından okunur.
        studentProfileId={studentProfileId || status?.studentProfileId}
        studentName={status?.studentName}
        contextKind={contextKind || 'DrivingLesson'}
        contextKey={contextKey}
        contextRefId={contextRefId}
        contextLabel={status?.contextLabel}
      />
    </>
  );
}
