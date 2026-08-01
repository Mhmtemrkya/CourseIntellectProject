import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  Mail,
  Phone,
  Users,
  CalendarDays,
  MessageSquare,
  Info,
  KeyRound,
  UserCheck,
  UserMinus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import DirectoryPage, { DIRECTORY_ALL } from '../components/directory/DirectoryPage';
import { FeatureGate } from '../components/FeatureGate';
import { UserStatusButton } from '../components/UserStatusButton';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { IdentityCard } from '../components/identity/IdentityCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { fetchMeetingRequests, fetchParentAccounts, fetchStudents, updateUserStatus } from '../lib/api/modules';
import { isUserPassive } from '../lib/userStatus';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function groupParents(students, meetings) {
  const map = new Map();

  students.forEach((student) => {
    const key = `${normalizeText(student.parentName)}|${normalizeText(student.parentEmail)}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: student.parentName,
        email: student.parentEmail,
        phone: student.parentPhone,
        children: [],
        classNames: new Set(),
        meetings: 0,
      });
    }

    const item = map.get(key);
    item.children.push(student);
    if (student.className) item.classNames.add(student.className);
  });

  meetings.forEach((meeting) => {
    const match = Array.from(map.values()).find((parent) => normalizeText(parent.name) === normalizeText(meeting.parentName));
    if (match) {
      match.meetings += 1;
    }
  });

  return Array.from(map.values()).map((parent) => ({
    ...parent,
    classNames: Array.from(parent.classNames),
  }));
}

function ParentDetailDrawer({ parent }) {
  if (!parent) return null;

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Veli Detayı</SheetTitle>
        <SheetDescription>Bağlı öğrenciler ve görüşme özeti</SheetDescription>
      </SheetHeader>

      <IdentityCard
        type="Veli Kimlik Kartı"
        name={parent.name}
        subtitle={`${parent.children.length} öğrenci velisi`}
        fields={[
          { label: 'Telefon', value: parent.phone },
          { label: 'E-posta', value: parent.email },
          { label: 'Bağlı Öğrenciler', value: parent.children.map((student) => student.fullName).join(', '), wide: true },
          { label: 'Sınıflar', value: parent.classNames.join(', '), wide: true },
        ]}
      />

      <div className="space-y-2">
        <h4 className="font-medium">İletişim</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{parent.email || 'E-posta yok'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{parent.phone || 'Telefon yok'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Bağlı Öğrenciler</h4>
        <div className="space-y-2">
          {parent.children.map((student) => (
            <div key={student.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">{student.fullName}</p>
                <p className="text-sm text-muted-foreground">{student.className} • {student.programType}</p>
              </div>
              <Badge variant="outline">{student.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sınıflar</p>
            <p className="text-xl font-semibold">{parent.classNames.join(', ') || 'Yok'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Görüşme Talebi</p>
            <p className="text-xl font-semibold">{parent.meetings}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Parents() {
  const navigate = useNavigate();
  const { openDrawer } = useApp();
  const { toast } = useToast();
  const [parents, setParents] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(DIRECTORY_ALL);
  const [classFilter, setClassFilter] = useState(DIRECTORY_ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadParents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, meetings, parentAccounts] = await Promise.all([
        fetchStudents(),
        fetchMeetingRequests().catch(() => []),
        fetchParentAccounts().catch(() => []),
      ]);
      setParents(groupParents(students, meetings));
      setAccounts(parentAccounts);
    } catch (err) {
      setError(err.message || 'Veli listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParents();
  }, [loadParents]);

  const nameKey = (value = '') => value.trim().toLocaleLowerCase('tr-TR');

  // Veli listesi öğrencilerden türetilir; giriş HESABI ayrı uçtan gelir. İkisi
  // tek satırda birleştirilir ki pasifleştirme listeden yapılabilsin.
  const parentRows = useMemo(() => {
    const accountByName = new Map(accounts.map((account) => [nameKey(account.fullName), account]));
    const used = new Set();
    const rows = parents.map((parent) => {
      const account = accountByName.get(nameKey(parent.name));
      if (account) used.add(nameKey(parent.name));
      return { ...parent, account: account || null, status: account?.status || null };
    });
    // Öğrencisi listede olmayan (ör. çocuğu pasif) hesaplar da görünsün.
    accounts
      .filter((account) => !used.has(nameKey(account.fullName)))
      .forEach((account) => rows.push({
        id: `account:${account.userId}`,
        name: account.fullName,
        email: account.email || '',
        phone: account.phone || '',
        children: (account.children || []).map((child) => ({ id: child, fullName: child })),
        classNames: [],
        meetings: 0,
        account,
        status: account.status,
      }));
    return rows;
  }, [parents, accounts]);

  const parentClasses = useMemo(
    () => [...new Set(parentRows.flatMap((parent) => parent.classNames || []))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr')),
    [parentRows],
  );

  const filteredParents = useMemo(() => parentRows.filter((parent) => {
    const haystack = `${parent.name} ${parent.email} ${parent.phone} ${parent.account?.username || ''}`.toLowerCase();
    if (!haystack.includes(search.toLowerCase())) return false;
    if (classFilter !== DIRECTORY_ALL && !(parent.classNames || []).includes(classFilter)) return false;
    if (statusFilter !== DIRECTORY_ALL) {
      const passive = isUserPassive(parent.status);
      if (statusFilter === 'active' && passive) return false;
      if (statusFilter === 'passive' && !passive) return false;
    }
    return true;
  }), [parentRows, search, classFilter, statusFilter]);

  // Veli hesabını pasife alma / aktifleştirme: hesap silinmez, girişi engellenir.
  const handleToggleAccountStatus = useCallback(async (account) => {
    const isPassive = isUserPassive(account.status);
    const nextStatus = isPassive ? 'Active' : 'Passive';
    try {
      await updateUserStatus(account.username, nextStatus);
      setAccounts((prev) => prev.map((item) => (item.userId === account.userId ? { ...item, status: nextStatus } : item)));
      toast({
        title: isPassive ? 'Veli hesabı aktifleştirildi' : 'Veli hesabı pasife alındı',
        description: isPassive
          ? `${account.fullName} yeniden giriş yapabilir.`
          : `${account.fullName} artık giriş yapamaz; açık oturumları sonlandırıldı.`,
      });
    } catch (err) {
      toast({ title: 'Durum güncellenemedi', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) => `${account.fullName} ${account.username} ${(account.children || []).join(' ')}`.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  const withAccount = parentRows.filter((parent) => parent.account).length;
  const passiveAccounts = parentRows.filter((parent) => isUserPassive(parent.status)).length;
  const childCount = parentRows.reduce((sum, parent) => sum + (parent.children?.length || 0), 0);

  return (
    <DirectoryPage
      testId="parents-page"
      title="Veliler"
      subtitle={`${parentRows.length} veliniz bulunuyor`}
      rangeLabel={(from, to, total) => `${total} veliden ${from}-${to} arası gösteriliyor`}
      emptyTitle="Veli bulunamadı"
      emptyDescription="Filtreleri değiştirin veya öğrenci kaydından veli ekleyin."
      banner={error ? <ErrorBanner title="Veliler alınamadı" message={error} onRetry={loadParents} /> : null}
      actions={(
        <FeatureGate module="parents" action="create">
          <Button variant="outline" onClick={() => navigate('/admin/student-registration')}>
            <Info className="mr-2 h-4 w-4" /> Öğrenci kaydından ekle
          </Button>
        </FeatureGate>
      )}
      stats={[
        { label: 'Toplam Veli', value: parentRows.length, caption: 'Tüm zamanlar', icon: Users, tint: 'bg-sky-500/12 text-sky-600' },
        { label: 'Giriş Hesabı Olan', value: withAccount, caption: 'Veli paneline girebilir', icon: KeyRound, tint: 'bg-emerald-500/12 text-emerald-600' },
        { label: 'Bağlı Öğrenci', value: childCount, caption: 'Veli-öğrenci eşleşmesi', icon: UserCheck, tint: 'bg-violet-500/12 text-violet-600' },
        { label: 'Pasif Hesap', value: passiveAccounts, caption: 'Girişi kapalı', icon: UserMinus, tint: 'bg-rose-500/12 text-rose-600' },
      ]}
      search={{ value: search, onChange: setSearch, placeholder: 'Veli ara...' }}
      filters={[
        { value: classFilter, onChange: setClassFilter, placeholder: 'Tüm Sınıflar', options: parentClasses },
        {
          value: statusFilter,
          onChange: setStatusFilter,
          placeholder: 'Tüm Durumlar',
          options: [{ value: 'active', label: 'Aktif' }, { value: 'passive', label: 'Pasif' }],
        },
      ]}
      rows={filteredParents}
      getRowId={(parent) => parent.id}
      onRowClick={(parent) => openDrawer(<ParentDetailDrawer parent={parent} />)}
      columns={[
        {
          key: 'name',
          label: 'Veli',
          sortable: true,
          width: 'minmax(0,1.8fr)',
          render: (parent) => (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-brand-primary text-white">
                  {parent.name.split(' ').map((part) => part[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{parent.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {parent.account?.username || parent.classNames.join(', ') || 'Giriş hesabı yok'}
                </p>
              </div>
            </div>
          ),
        },
        {
          key: 'contact',
          label: 'İletişim',
          width: 'minmax(0,1.3fr)',
          render: (parent) => (
            <div className="min-w-0 text-xs">
              <p className="flex items-center gap-1.5 font-medium"><Phone className="h-3 w-3 text-muted-foreground" />{parent.phone || '—'}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-muted-foreground"><Mail className="h-3 w-3" />{parent.email || '—'}</p>
            </div>
          ),
        },
        {
          key: 'children',
          label: 'Öğrenciler',
          width: 'minmax(0,1.4fr)',
          render: (parent) => (
            <div className="flex flex-wrap gap-1">
              {(parent.children || []).slice(0, 3).map((child) => (
                <Badge key={child.id || child.fullName} variant="outline" className="text-xs">{child.fullName}</Badge>
              ))}
              {(parent.children || []).length > 3 ? (
                <Badge variant="outline" className="text-xs">+{parent.children.length - 3}</Badge>
              ) : null}
              {(parent.children || []).length === 0 ? <span className="text-xs text-muted-foreground">Bağlantı yok</span> : null}
            </div>
          ),
        },
        {
          key: 'meetings',
          label: 'Görüşme',
          sortable: true,
          width: 'minmax(0,0.6fr)',
          render: (parent) => <Badge variant="secondary">{parent.meetings}</Badge>,
        },
        {
          key: 'lastLogin',
          label: 'Son Giriş',
          width: 'minmax(0,0.9fr)',
          sortValue: (parent) => parent.account?.lastLoginAtUtc || '',
          render: (parent) => (
            <span className="text-xs text-muted-foreground">
              {parent.account?.lastLoginAtUtc
                ? new Date(parent.account.lastLoginAtUtc).toLocaleDateString('tr-TR')
                : 'Hiç girmedi'}
            </span>
          ),
        },
        {
          key: 'status',
          label: 'Durum',
          sortable: true,
          width: 'minmax(0,0.7fr)',
          render: (parent) => {
            if (!parent.account) return <span className="text-xs text-muted-foreground">Hesap yok</span>;
            return isUserPassive(parent.status)
              ? <Badge className="bg-red-100 text-red-700">Pasif</Badge>
              : <Badge className="bg-green-100 text-green-700">Aktif</Badge>;
          },
        },
      ]}
      rowActions={(parent) => (
        <>
          <Button variant="ghost" size="icon" title="Detay" onClick={() => openDrawer(<ParentDetailDrawer parent={parent} />)}>
            <Eye className="h-4 w-4" />
          </Button>
          {/* Giriş hesabı olan veli listeden pasife alınabilir. */}
          {parent.account ? (
            <FeatureGate module="parents" action="status">
              <UserStatusButton
                iconOnly
                isPassive={isUserPassive(parent.status)}
                onToggle={() => handleToggleAccountStatus(parent.account)}
              />
            </FeatureGate>
          ) : null}
        </>
      )}
      cardRender={(parent) => (
        <button
          type="button"
          onClick={() => openDrawer(<ParentDetailDrawer parent={parent} />)}
          className="flex w-full flex-col items-start gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4 text-left transition hover:border-[hsl(var(--brand-accent)/0.35)]"
        >
          <div className="flex w-full items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-brand-primary text-white">
                {parent.name.split(' ').map((part) => part[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{parent.name}</p>
              <p className="truncate text-xs text-muted-foreground">{parent.phone || parent.email || '—'}</p>
            </div>
            {parent.account && isUserPassive(parent.status)
              ? <Badge className="bg-red-100 text-red-700">Pasif</Badge>
              : null}
          </div>
          <p className="w-full truncate text-xs text-muted-foreground">
            {(parent.children || []).map((child) => child.fullName).join(', ') || 'Bağlı öğrenci yok'}
          </p>
        </button>
      )}
    />
  );
}
