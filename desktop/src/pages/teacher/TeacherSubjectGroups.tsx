import { useCallback, useEffect, useState } from 'react';
import { BookMarked, Crown, Users } from 'lucide-react';
import { Page, PageHeader, PageLoading, PageNotice } from '../../components/layout/PageKit';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchMySubjectGroups } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type { SubjectGroupDto } from '../../types/api/generated';

/** Öğretmen görünümü: üyesi olduğu zümreler (salt okunur). */
export default function TeacherSubjectGroups() {
  const { toast } = useToast();
  const { user } = useApp();
  const [groups, setGroups] = useState<SubjectGroupDto[] | null>(null);

  const load = useCallback(async () => {
    try {
      setGroups((await fetchMySubjectGroups()) ?? []);
    } catch (error) {
      setGroups([]);
      toast({ title: 'Zümreler alınamadı', description: errorMessage(error), variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  if (!groups) return <PageLoading />;

  return (
    <Page testId="teacher-subject-groups-page">
      <PageHeader title="Zümrem" description="Üyesi olduğunuz ders zümreleri ve zümre arkadaşlarınız." icon={BookMarked} onRefresh={load} />
      {groups.length === 0 ? (
        <PageNotice icon={Users} title="Henüz bir zümrede değilsiniz" message="Zümreler kurum yöneticisi tarafından oluşturulur." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => {
            const iAmHead = Boolean(user?.id) && group.headTeacherUserId === user?.id;
            return (
              <section key={group.id} className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: group.color }} />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.subject} • {group.academicYear}</p>
                    <h3 className="mt-1 text-lg font-bold">{group.name}</h3>
                  </div>
                  {iAmHead ? <Badge className="gap-1 bg-amber-500 text-white"><Crown className="h-3 w-3" />Başkansınız</Badge> : null}
                </div>
                <p className="mt-3 flex items-center gap-1 text-sm">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">Zümre Başkanı:</span>
                  <b>{group.headTeacherName || 'Atanmadı'}</b>
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.members.map((member) => (
                    <Badge key={member.teacherUserId} variant="outline" className="font-normal">{member.teacherName}</Badge>
                  ))}
                </div>
                {group.description ? <p className="mt-3 text-sm text-muted-foreground">{group.description}</p> : null}
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}
