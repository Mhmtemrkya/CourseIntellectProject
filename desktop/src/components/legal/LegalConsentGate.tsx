import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LegalDocumentsPanel } from "@/components/legal/LegalDocumentsPanel";
import { legalConsentVersion, optionalConsentItems, type OptionalConsentKey } from "@/legal/legalContent";
import {
  LEGAL_CONSENT_DECIDED_AT_KEY,
  LEGAL_CONSENT_STATUS_KEY,
  LEGAL_CONSENT_VERSION_KEY,
  notifyLegalConsentChanged,
  readLegalConsentStatus,
} from "@/legal/consentState";
import { fetchMyLegalConsent, recordLegalConsent } from "@/lib/api/legalConsent";
import type { LegalConsentResponse } from "@/types/api/generated";

type ConsentChoices = Record<OptionalConsentKey, boolean>;

interface ConsentState {
  accepted: boolean;
  declined: boolean;
}

function readState(): ConsentState {
  const status = readLegalConsentStatus();
  return { accepted: status === "accepted", declined: status === "declined" };
}

/** Gönderilemeyen kararın sahibi; sonraki açılışta sunucuya tekrar gönderilir. */
const PENDING_SYNC_USER_KEY = "courseintellect.legalConsent.pendingUser";

type ConsentStatus = "accepted" | "declined";

function persistLocal(status: ConsentStatus, choices: Partial<ConsentChoices> = {}) {
  try {
    window.localStorage.setItem(LEGAL_CONSENT_STATUS_KEY, status);
    window.localStorage.setItem(LEGAL_CONSENT_VERSION_KEY, legalConsentVersion);
    window.localStorage.setItem(LEGAL_CONSENT_DECIDED_AT_KEY, new Date().toISOString());
    Object.entries(choices).forEach(([key, value]) => {
      window.localStorage.setItem(`courseintellect.legalConsent.${key}`, String(Boolean(value)));
    });
  } catch {
    // Depolama kapalıysa karar yine sunucuya yazılır; yalnız yerel önbellek eksik kalır.
  }
  // Onay beklerken ertelenen tanıtım turu vb. katmanlar karar sonrası açılabilsin.
  notifyLegalConsentChanged();
}

function readLocalChoice(key: OptionalConsentKey): boolean {
  try {
    return window.localStorage.getItem(`courseintellect.legalConsent.${key}`) === "true";
  } catch {
    return false;
  }
}

function isConsentStatus(value: string): value is ConsentStatus {
  return value === "accepted" || value === "declined";
}

/** Kararı sunucuya yazar; başarısızsa kullanıcıya bağlı bekleyen senkron işaretlenir. */
async function sendDecision(userId: string, status: ConsentStatus, choices: Partial<ConsentChoices>, decidedAt: string): Promise<boolean> {
  try {
    await recordLegalConsent({
      version: legalConsentVersion,
      status,
      marketing: Boolean(choices.marketing),
      push: Boolean(choices.push),
      analytics: Boolean(choices.analytics),
      platform: "desktop",
      decidedAtUtc: decidedAt,
    });
    try { window.localStorage.removeItem(PENDING_SYNC_USER_KEY); } catch { /* yok say */ }
    return true;
  } catch {
    try { window.localStorage.setItem(PENDING_SYNC_USER_KEY, userId); } catch { /* yok say */ }
    return false;
  }
}

function applyServerDecision(record: LegalConsentResponse): ConsentState | null {
  if (!isConsentStatus(record.status)) return null;
  persistLocal(record.status, { marketing: record.marketing, push: record.push, analytics: record.analytics });
  return { accepted: record.status === "accepted", declined: record.status === "declined" };
}

export function LegalConsentGate({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isAuthLoading, user } = useApp();
  const userId = user?.id ?? "";
  const [state, setState] = useState(() => readState());
  const [open, setOpen] = useState(false);
  const [understoodKvkk, setUnderstoodKvkk] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [choices, setChoices] = useState<ConsentChoices>({ marketing: false, push: false, analytics: false });

  // Kaynak SUNUCUDUR: yerel kayıt cihaza bağlıydı (aynı bilgisayarda başka
  // kullanıcı önceki kişinin onayını devralıyordu) ve ispat değeri yoktu.
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !userId) return undefined;
    let cancelled = false;
    const local = readState();
    fetchMyLegalConsent()
      .then(async (server) => {
        if (cancelled) return;
        if (server) {
          const next = applyServerDecision(server);
          if (next) {
            setState(next);
            setOpen(!next.accepted && !next.declined);
            return;
          }
        }
        // Sunucuda kayıt yok: bu kullanıcının gönderilemeyen kararı varsa gönder,
        // yoksa onayı iste (kullanıcı başına bir kez).
        let pendingUser: string | null = null;
        try { pendingUser = window.localStorage.getItem(PENDING_SYNC_USER_KEY); } catch { pendingUser = null; }
        const localStatus = local.accepted ? "accepted" : local.declined ? "declined" : null;
        if (pendingUser === userId && localStatus) {
          const choices: ConsentChoices = {
            marketing: readLocalChoice("marketing"),
            push: readLocalChoice("push"),
            analytics: readLocalChoice("analytics"),
          };
          await sendDecision(userId, localStatus, choices, new Date().toISOString());
          if (cancelled) return;
          setState(local);
          return;
        }
        // Bu cihazdaki yerel karar başka bir kullanıcıya ait olabilir: temizlenir
        // ki tanıtım turu vb. onay alınmadan açılmasın.
        try { window.localStorage.removeItem(LEGAL_CONSENT_STATUS_KEY); } catch { /* yok say */ }
        notifyLegalConsentChanged();
        setState({ accepted: false, declined: false });
        setOpen(true);
      })
      .catch(() => {
        // Sunucuya ulaşılamıyor: yerel önbelleğe düşülür, kullanım engellenmez.
        if (cancelled) return;
        setState(local);
        setOpen(!local.accepted && !local.declined);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, isAuthLoading, userId]);

  const decide = (status: ConsentStatus, decisionChoices: Partial<ConsentChoices>) => {
    const decidedAt = new Date().toISOString();
    persistLocal(status, decisionChoices);
    setState({ accepted: status === "accepted", declined: status === "declined" });
    setOpen(false);
    if (userId) void sendDecision(userId, status, decisionChoices, decidedAt);
  };

  if (!isAuthLoading && isAuthenticated && state.declined && !state.accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-600" />
          <h1 className="mt-4 text-2xl font-bold">Yasal koşullar kabul edilmedi</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Uygulamayı kullanabilmek için KVKK aydınlatmasını okuyup anladığınızı ve kullanım koşullarını kabul ettiğinizi onaylamanız gerekir.
          </p>
          <Button className="mt-5 w-full" onClick={() => setOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Metinleri tekrar incele
          </Button>
          <ConsentDialog
            open={open}
            setOpen={setOpen}
            understoodKvkk={understoodKvkk}
            setUnderstoodKvkk={setUnderstoodKvkk}
            acceptedTerms={acceptedTerms}
            setAcceptedTerms={setAcceptedTerms}
            choices={choices}
            setChoices={setChoices}
            onAccept={() => decide("accepted", choices)}
            onDecline={() => decide("declined", {})}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {isAuthenticated ? (
        <ConsentDialog
          open={open}
          setOpen={setOpen}
          understoodKvkk={understoodKvkk}
          setUnderstoodKvkk={setUnderstoodKvkk}
          acceptedTerms={acceptedTerms}
          setAcceptedTerms={setAcceptedTerms}
          choices={choices}
          setChoices={setChoices}
          onAccept={() => decide("accepted", choices)}
          onDecline={() => decide("declined", {})}
        />
      ) : null}
    </>
  );
}

interface ConsentDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  understoodKvkk: boolean;
  setUnderstoodKvkk: Dispatch<SetStateAction<boolean>>;
  acceptedTerms: boolean;
  setAcceptedTerms: Dispatch<SetStateAction<boolean>>;
  choices: ConsentChoices;
  setChoices: Dispatch<SetStateAction<ConsentChoices>>;
  onAccept: () => void;
  onDecline: () => void;
}

function ConsentDialog({
  open,
  understoodKvkk,
  setUnderstoodKvkk,
  acceptedTerms,
  setAcceptedTerms,
  choices,
  setChoices,
  onAccept,
  onDecline,
}: ConsentDialogProps) {
  const canContinue = understoodKvkk && acceptedTerms;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b p-6 pb-4">
            <DialogTitle>KVKK ve Yasal Bilgilendirme</DialogTitle>
            <DialogDescription>
              Aydınlatma metni onayı ve açık rızalar ayrı tutulur. Zorunlu olmayan açık rızaları kapalı bırakabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <LegalDocumentsPanel compact />
            <div className="mt-4 space-y-3 rounded-xl border p-4">
              <label className="flex items-start gap-3">
                <Checkbox checked={understoodKvkk} onCheckedChange={(value) => setUnderstoodKvkk(Boolean(value))} />
                <span>
                  <span className="block font-medium">KVKK aydınlatma metnini okudum ve anladım.</span>
                  <span className="text-sm text-muted-foreground">Bu bir açık rıza değildir; veri işleme hakkında bilgilendirme teyididir.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <Checkbox checked={acceptedTerms} onCheckedChange={(value) => setAcceptedTerms(Boolean(value))} />
                <span>
                  <span className="block font-medium">Kullanım koşullarını kabul ediyorum.</span>
                  <span className="text-sm text-muted-foreground">Hesap güvenliği, yetkili kullanım ve kurum kurallarını kapsar.</span>
                </span>
              </label>
            </div>
            <div className="mt-4 space-y-3">
              {optionalConsentItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-start justify-between gap-4 rounded-xl border p-4">
                    <div className="flex gap-3">
                      <Icon className="mt-0.5 h-5 w-5 text-brand-primary" />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={choices[item.key]}
                      onCheckedChange={(value) => setChoices((prev) => ({ ...prev, [item.key]: value }))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onDecline}>
              Reddet
            </Button>
            <Button type="button" disabled={!canContinue} onClick={onAccept}>
              Kabul Et ve Devam Et
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
