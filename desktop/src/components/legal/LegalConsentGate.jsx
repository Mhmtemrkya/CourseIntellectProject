import { useEffect, useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { LegalDocumentsPanel } from "@/components/legal/LegalDocumentsPanel";
import { legalConsentVersion, optionalConsentItems } from "@/legal/legalContent";

const statusKey = "courseintellect.legalConsent.status";
const versionKey = "courseintellect.legalConsent.version";
const decidedAtKey = "courseintellect.legalConsent.decidedAt";

function readState() {
  if (typeof window === "undefined") return { accepted: true, declined: false };
  const status = window.localStorage.getItem(statusKey);
  const version = window.localStorage.getItem(versionKey);
  return {
    accepted: status === "accepted" && version === legalConsentVersion,
    declined: status === "declined" && version === legalConsentVersion,
  };
}

function persistDecision(status, choices = {}) {
  window.localStorage.setItem(statusKey, status);
  window.localStorage.setItem(versionKey, legalConsentVersion);
  window.localStorage.setItem(decidedAtKey, new Date().toISOString());
  Object.entries(choices).forEach(([key, value]) => {
    window.localStorage.setItem(`courseintellect.legalConsent.${key}`, String(Boolean(value)));
  });
}

export function LegalConsentGate({ children }) {
  const { isAuthenticated, isAuthLoading } = useApp();
  const [state, setState] = useState(() => readState());
  const [open, setOpen] = useState(false);
  const [understoodKvkk, setUnderstoodKvkk] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [choices, setChoices] = useState({ marketing: false, push: false, analytics: false });

  useEffect(() => {
    const next = readState();
    setState(next);
    if (!isAuthLoading && isAuthenticated && !next.accepted && !next.declined) {
      setOpen(true);
    }
  }, [isAuthenticated, isAuthLoading]);

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
            onAccept={() => {
              persistDecision("accepted", choices);
              setState({ accepted: true, declined: false });
              setOpen(false);
            }}
            onDecline={() => {
              persistDecision("declined");
              setState({ accepted: false, declined: true });
              setOpen(false);
            }}
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
          onAccept={() => {
            persistDecision("accepted", choices);
            setState({ accepted: true, declined: false });
            setOpen(false);
          }}
          onDecline={() => {
            persistDecision("declined");
            setState({ accepted: false, declined: true });
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function ConsentDialog({
  open,
  setOpen,
  understoodKvkk,
  setUnderstoodKvkk,
  acceptedTerms,
  setAcceptedTerms,
  choices,
  setChoices,
  onAccept,
  onDecline,
}) {
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
