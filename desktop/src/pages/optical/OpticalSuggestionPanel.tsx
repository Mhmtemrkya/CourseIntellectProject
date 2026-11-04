import { AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { OpticalTemplateSuggestionDto } from '../../types/api/generated';
import { AI_STATUS_LABEL, CONFIDENCE_LABEL } from './templateSuggestion';

const CONFIDENCE_CLASS: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  low: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  none: 'bg-muted text-muted-foreground',
};

const spanText = (start: number, length: number) => (length === 1 ? `${start}. karakter` : `${start}–${start + length - 1}. karakterler`);

function Badge({ confidence }: { confidence: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONFIDENCE_CLASS[confidence] ?? CONFIDENCE_CLASS.none}`}>
      {CONFIDENCE_LABEL[confidence] ?? CONFIDENCE_LABEL.none}
    </span>
  );
}

/**
 * Dosyadan gelen şablon önerisi: alan başına güven ve gerekçe, numara adayları, cevap blokları,
 * şüpheli satırlar ve doğrulanması gerekenler. Düzenlenen şablonda form ancak "Öneriyi uygula" ile değişir.
 */
export function OpticalSuggestionPanel({ suggestion, applied, numberChoice, onChooseNumber, onApply }: {
  suggestion: OpticalTemplateSuggestionDto;
  applied: boolean;
  numberChoice: string;
  onChooseNumber: (id: string) => void;
  onApply: () => void;
}) {
  const varying = suggestion.numberCandidates.filter((item) => !item.constant);
  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-sky-500/40 bg-sky-500/5 p-3 text-sm" data-testid="optical-suggestion">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
        <div className="min-w-0">
          <p className="font-semibold">{suggestion.supported ? 'Dosyadan önerilen şablon' : 'Bu dosyadan öneri üretilemedi'}</p>
          <p className="text-xs text-muted-foreground">{suggestion.message}</p>
          {suggestion.supported ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {`${suggestion.totalLines} satır · ${suggestion.sampledLines} satır incelendi · kodlama: ${suggestion.encoding === 'utf-8' ? 'UTF-8' : 'Türkçe Windows (1254)'}`}
            </p>
          ) : null}
        </div>
      </div>
      <p className="flex gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Bu özellik dosya düzenini önerir. Cevap anahtarı ve soru konuları ayrıca girilir.
      </p>

      {suggestion.supported ? (
        <>
          <ul className="space-y-1.5" aria-label="Önerilen alanlar">
            {suggestion.fields.map((field) => (
              <li key={field.key} className="rounded-lg border bg-background/60 px-2.5 py-1.5" data-testid={`suggested-${field.key}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{field.label}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="tabular-nums text-muted-foreground">{field.length > 0 ? spanText(field.start, field.length) : '—'}</span>
                    <Badge confidence={field.confidence} />
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{field.reason}</p>
              </li>
            ))}
            {suggestion.answerBlocks.map((block) => (
              <li key={block.label} className="rounded-lg border bg-background/60 px-2.5 py-1.5" data-testid="suggested-answers">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{`${block.label} · ${block.count} soru`}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="tabular-nums text-muted-foreground">{spanText(block.start, block.count)}</span>
                    <Badge confidence={block.confidence} />
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{block.reason}</p>
              </li>
            ))}
          </ul>

          {varying.length > 1 ? (
            <fieldset className="space-y-1 rounded-lg border px-2.5 py-2">
              <legend className="px-1 text-xs font-semibold">Öğrenci numarası hangisi?</legend>
              {suggestion.numberCandidates.map((candidate) => (
                <label key={candidate.id} className="flex items-start gap-2 text-xs">
                  <input type="radio" name="optical-number-candidate" className="mt-0.5" checked={numberChoice === candidate.id}
                    onChange={() => onChooseNumber(candidate.id)} />
                  <span><span className="font-medium tabular-nums">{spanText(candidate.start, candidate.length)}</span> — {candidate.note}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {suggestion.booklets.length > 0 ? (
            <p className="text-xs"><span className="font-medium">Kitapçık türleri: </span>{suggestion.booklets.join(', ')}</p>
          ) : null}
        </>
      ) : null}

      {[...suggestion.confirmations.map((text) => ({ text, tone: 'confirm' })), ...suggestion.warnings.map((text) => ({ text, tone: 'warn' }))].map((item) => (
        <p key={item.text} className={`flex gap-1.5 text-xs ${item.tone === 'confirm' ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{item.text}
        </p>
      ))}

      {suggestion.flaggedLines.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 px-2.5 py-2 text-xs">
          <p className="font-semibold">Kontrol edilmesi gereken satırlar</p>
          <ul className="mt-1 space-y-0.5">
            {suggestion.flaggedLines.map((line) => <li key={line.line}>{`${line.line}. satır: ${line.reason}`}</li>)}
          </ul>
        </div>
      ) : null}

      {suggestion.supported ? (
        <p className="text-[11px] text-muted-foreground">
          {AI_STATUS_LABEL[suggestion.aiStatus] ?? ''}
          {suggestion.aiNotes.length > 0 ? ` ${suggestion.aiNotes.join(' ')}` : ''}
        </p>
      ) : null}

      {suggestion.supported && !suggestion.manualRecommended ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onApply} disabled={applied}>{applied ? 'Öneri forma uygulandı' : 'Öneriyi uygula'}</Button>
          {applied ? (
            <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />Değerleri aşağıda kontrol edip düzeltebilirsiniz; Kaydet’e basana kadar hiçbir şey kaydedilmez.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
