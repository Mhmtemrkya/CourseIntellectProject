import { useCallback, useEffect, useState } from 'react';
import { fetchConsentStatus } from '../../lib/api/modules';
import ConsentCenter, { buildConsentStatusQuery, type ConsentContextProps } from './ConsentCenter';
import type { ConsentStatusDto } from '../../types/api/generated';
import { cn } from '@/lib/utils';

/**
 * Eksik onam formu uyarı şeridi.
 *
 * SESSİZ olmak zorunda: kurum hiç şablon tanımlamamışsa ya da eksik yoksa
 * hiçbir şey çizmez. Onam özelliğini kullanmayan kurumun ekranını kirletmez.
 * Tıklanınca Onam Merkezi açılır.
 */
export interface ConsentAlertBannerProps extends ConsentContextProps {
  showWhenComplete?: boolean;
  className?: string;
}

export default function ConsentAlertBanner({
  studentProfileId,
  studentName,
  contextKind,
  contextKey,
  contextRefId,
  contextLabel,
  showWhenComplete = false,
  className,
}: ConsentAlertBannerProps) {
  const [status, setStatus] = useState<ConsentStatusDto | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!studentProfileId) return;
    try {
      const params = buildConsentStatusQuery(contextKind, contextKey, contextRefId);
      setStatus(await fetchConsentStatus(studentProfileId, params));
    } catch {
      // Onam modülü kurulmamış / yetki yok → şerit hiç görünmez.
      setStatus(null);
    }
  }, [studentProfileId, contextKind, contextKey, contextRefId]);

  useEffect(() => {
    void load();
  }, [load]);

  const missing = (status?.requiredCount || 0) - (status?.signedCount || 0);
  const hasRequirements = (status?.requiredCount || 0) > 0;

  if (!hasRequirements) return null;
  if (missing <= 0 && !showWhenComplete) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition',
          missing > 0
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
          className,
        )}
      >
        <span>
          {missing > 0
            ? `${missing} onam formu imzasız — görüntülemek için tıklayın`
            : 'Tüm onam formları imzalı'}
        </span>
        <span className="shrink-0 text-xs opacity-80">
          {status?.signedCount ?? 0}/{status?.requiredCount ?? 0}
        </span>
      </button>

      <ConsentCenter
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) void load();
        }}
        studentProfileId={studentProfileId}
        studentName={studentName}
        contextKind={contextKind}
        contextKey={contextKey}
        contextRefId={contextRefId}
        contextLabel={contextLabel}
        onStatusChange={setStatus}
      />
    </>
  );
}
