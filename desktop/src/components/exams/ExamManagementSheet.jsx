import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';

export default function ExamManagementSheet({
  exam,
  open,
  onOpenChange,
  actions = [],
  title = 'Sınav İşlemleri',
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[calc(100%-1.5rem)] max-w-md flex-col p-0 [&>button]:hidden sm:w-full"
      >
        <SheetHeader className="border-b border-border/70 px-6 py-6 text-left">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <SheetTitle className="pr-0 text-2xl font-black">
            {exam?.title || exam?.name || 'Sınav'}
          </SheetTitle>
          <SheetDescription>
            {[exam?.subject, exam?.className, exam?.dateLabel || exam?.date]
              .filter(Boolean)
              .join(' • ')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-background/55">
            {actions.filter((action) => !action.hidden).map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  action.onClick?.();
                  if (action.close !== false) onOpenChange(false);
                }}
                className={`flex min-h-14 w-full items-center px-5 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  action.destructive
                    ? 'text-red-600 hover:bg-red-500/10'
                    : 'text-foreground hover:bg-muted/70'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border/70 p-4">
          <SheetClose asChild>
            <Button variant="outline" className="h-12 w-full rounded-xl">
              Kapat
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
