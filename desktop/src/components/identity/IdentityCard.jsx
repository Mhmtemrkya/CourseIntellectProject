import { BadgeCheck, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';

function initials(name) {
  return String(name || 'SA').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function IdentityCard({
  type,
  name,
  photoUrl,
  institution,
  subtitle,
  status,
  fields = [],
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary/[0.10] via-background to-brand-accent/[0.08] shadow-sm">
      <div className="h-2 bg-gradient-to-r from-brand-primary via-brand-accent to-cyan-500" />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-24 w-24 shrink-0 border-4 border-background shadow-md">
            {photoUrl ? <AvatarImage src={photoUrl} alt={name} className="object-cover" /> : null}
            <AvatarFallback className="bg-brand-primary text-xl font-bold text-white">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-brand-primary text-white">{type}</Badge>
              {status ? <Badge variant="outline">{status}</Badge> : null}
            </div>
            <h3 className="mt-2 truncate text-xl font-bold">{name || 'İsimsiz kayıt'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle || 'Kurum kimlik kartı'}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> {institution || 'SchoolAsist Kurumu'}
            </p>
          </div>
          <BadgeCheck className="h-6 w-6 shrink-0 text-brand-accent" aria-label="Doğrulanmış kurum kaydı" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t pt-4">
          {fields.filter((field) => field?.label).map((field) => (
            <div key={field.label} className={field.wide ? 'col-span-2' : ''}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
              <p className="mt-0.5 break-words text-sm font-medium">{field.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
