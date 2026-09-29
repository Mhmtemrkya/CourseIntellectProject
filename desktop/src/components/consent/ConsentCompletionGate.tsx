import { useCallback, useEffect, useState } from 'react';
import { fetchAppointmentConsentStatus, fetchConsentStatus } from '../../lib/api/modules';
import ConsentCenter, { buildConsentStatusQuery } from './ConsentCenter';
import type { ConsentContextKind, ConsentStatusDto } from '../../types/api/generated';

/** Kapının hangi kayda baktığı: randevu ya da öğrenci + bağlam. */
export interface ConsentGateScope {
  appointmentId?: string | null;
  studentProfileId?: string | null;
  contextKind?: ConsentContextKind | null;
  contextKey?: string | null;
  contextRefId?: string | null;
}

type Proceed = () => Promise<unknown> | unknown;

export interface ConsentCompletionGateProps {
  status: ConsentStatusDto | null;
  open: boolean;
  onClose: () => void;
  onProceed: () => Promise<void>;
  recheck: () => Promise<void>;
  studentProfileId?: string | null;
  contextKind?: ConsentContextKind | null;
  contextKey?: string | null;
  contextRefId?: string | null;
}
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
export function useConsentGate(defaults: ConsentGateScope = {}) {
  const [pending, setPending] = useState<Proceed | null>(null);
  const [status, setStatus] = useState<ConsentStatusDto | null>(null);
  // Liste ekranlarında hedef satır satır değişir; run() çağrısındaki hedef
  // burada tutulur ki "formları görüntüle" ve yeniden değerlendirme aynı kayda baksın.
  const [target, setTarget] = useState<ConsentGateScope>(defaults);

  const check = useCallback(async (scope: ConsentGateScope): Promise<ConsentStatusDto | null> => {
    try {
      if (scope.appointmentId) return await fetchAppointmentConsentStatus(scope.appointmentId);
      if (scope.studentProfileId) {
        const params = buildConsentStatusQuery(scope.contextKind, scope.contextKey, scope.contextRefId);
        return await fetchConsentStatus(scope.studentProfileId, params);
      }
    } catch {
      // Durum okunamıyorsa kapı hiç kurulmaz — iş akışı asla onam yüzünden kilitlenmez.
    }
    return null;
  }, []);

  const run = useCallback(async (proceed: Proceed, overrides?: ConsentGateScope) => {
    const raw: ConsentGateScope = { ...defaults, ...(overrides || {}) };
    // Randevu kapısında yeni açılacak formlar o randevuya bağlanmalı; aksi hâlde
    // bir sonraki derste aynı form yeniden "imzalı" sayılır.
    const scope: ConsentGateScope = raw.appointmentId
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

  const props: ConsentCompletionGateProps = {
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
  };

  return { run, props };
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
}: ConsentCompletionGateProps) {
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
            <Button variant="ghost" onClick={() => { void onProceed(); }}>
              İmzasız devam et
            </Button>
            <Button onClick={() => setCenterOpen(true)}>Onam formlarını görüntüle</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConsentCenter
        open={centerOpen}
        onOpenChange={(next) => {
          setCenterOpen(next);
          // Formlar imzalandıysa kapı kendini yeniden değerlendirip geçer.
          if (!next) void recheck();
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
