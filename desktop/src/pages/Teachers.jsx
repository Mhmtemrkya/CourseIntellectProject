import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Mail,
  Phone,
  School,
  Pencil,
  Users,
  UserCheck,
  UserMinus,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FeatureGate } from '../components/FeatureGate';
import { UserStatusButton } from '../components/UserStatusButton';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import PhotoCapture from '../components/ui/photo-capture';
import { BranchSelectWithCreate } from '../components/registration/BranchSelectWithCreate';
import { IdentityCard } from '../components/identity/IdentityCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { createStaff, updateStaff, fetchStaff, fetchClasses, fetchPlatformConfigurations, updateUserStatus, upsertPlatformConfiguration } from '../lib/api/modules';
import DirectoryPage, { DIRECTORY_ALL } from '../components/directory/DirectoryPage';
import { downloadCredentialsPdf } from '../lib/credentialsPdf';
import { isUserPassive } from '../lib/userStatus';
import { assetUrl } from '../lib/assetUrl';
import { mergeBranches, readSavedStaffBranches, staffBranchConfigurationPayload } from '../lib/staffBranches';
import {
  isValidTcKimlik, isValidTrPhone, maskPositiveInteger, maskTcKimlik, maskTrPhone,
} from '../lib/inputMasks';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const PREDEFINED_BRANCHES = [
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji',
  'Türkçe / Edebiyat', 'Tarih', 'Coğrafya',
  'İngilizce', 'Almanca', 'Fransızca', 'İspanyolca',
  'Felsefe', 'Din Kültürü ve Ahlak Bilgisi',
  'Beden Eğitimi', 'Müzik', 'Görsel Sanatlar',
  'Bilgisayar / Bilişim Teknolojileri',
  'Matematik (İlkokul)', 'Türkçe (İlkokul)',
  'Hayat Bilgisi', 'Fen Bilimleri',
  'Sosyal Bilgiler', 'Rehberlik',
  'Okul Öncesi', 'Özel Eğitim',
  'Diğer',
];

const ROLE_LABELS = {
  Teacher: 'Öğretmen',
  Administrative: 'İdari Personel',
  Admin: 'Yönetici',
};

function TeacherDetailDrawer({ teacher }) {
  if (!teacher) return null;
  const assignedClasses = Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses : [];

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Öğretmen Detayı</SheetTitle>
        <SheetDescription>Öğretmen bilgileri ve istatistikleri</SheetDescription>
      </SheetHeader>

      <IdentityCard
        type="Personel Kimlik Kartı"
        name={teacher.fullName}
        photoUrl={teacher.photoUrl}
        institution={teacher.campus}
        subtitle={`${ROLE_LABELS[teacher.role] || teacher.role || 'Öğretmen'} • ${teacher.departmentOrBranch || 'Branş atanmadı'}`}
        status={teacher.status}
        fields={[
          { label: 'TC Kimlik No', value: teacher.tcNo },
          { label: 'Kullanıcı Adı', value: teacher.username },
          { label: 'Telefon', value: teacher.phone },
          { label: 'E-posta', value: teacher.email },
          { label: 'Eğitim', value: teacher.education },
          { label: 'İşe Başlama', value: teacher.startDate },
          { label: 'Sınıf Öğretmenliği', value: teacher.homeroomClass },
          { label: 'Atanan Sınıflar', value: assignedClasses.join(', '), wide: true },
          { label: 'Not', value: teacher.note, wide: true },
        ]}
      />

      <div className="space-y-3">
        <h4 className="font-medium">İletişim Bilgileri</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{teacher.email || 'E-posta yok'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{teacher.phone || 'Telefon yok'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Atanan Sınıflar</h4>
        <div className="flex flex-wrap gap-2">
          {assignedClasses.length > 0 ? assignedClasses.map((cls) => (
            <Badge key={cls} variant="outline">{cls}</Badge>
          )) : <Badge variant="outline">Atama yok</Badge>}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Sınıf Öğretmenliği</h4>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/10">
              <School className="h-5 w-5 text-brand-accent" />
            </div>
            <div>
              <p className="text-lg font-bold">{teacher.homeroomClass || 'Atanmadı'}</p>
              <p className="text-xs text-muted-foreground">{teacher.homeroomClass ? 'sınıfının sınıf öğretmeni' : 'Sınıf öğretmenliği görevi yok'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeacherFormFields({ form, setForm, branches, classes, onCreateBranch }) {
  const EMPTY_HOME_ROOM = '__none__';

  const toggleAssignedClass = (value) => {
    setForm((prev) => ({
      ...prev,
      assignedClasses: prev.assignedClasses.includes(value)
        ? prev.assignedClasses.filter((item) => item !== value)
        : [...prev.assignedClasses, value],
    }));
  };

  return (
    <div className="grid grid-cols-2 gap-4 py-4">
      <div className="space-y-2 col-span-2">
        <Label>Ad Soyad</Label>
        <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
      </div>
      {form.photoUrl !== undefined ? (
        <div className="space-y-2 col-span-2">
          <Label>Personel Fotoğrafı</Label>
          <PhotoCapture value={form.photoUrl} onChange={(photoUrl) => setForm((prev) => ({ ...prev, photoUrl }))} folder="staff-photos" size={112} />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Rol</Label>
        <Input value="Öğretmen" readOnly className="bg-muted cursor-not-allowed" />
      </div>
      <BranchSelectWithCreate
        value={form.departmentOrBranch}
        onValueChange={(value) => setForm((prev) => ({ ...prev, departmentOrBranch: value }))}
        options={branches}
        onCreate={onCreateBranch}
      />
      {form.tcNo !== undefined && (
        <div className="space-y-2">
          <Label>TC No *</Label>
          <Input value={form.tcNo} onChange={(e) => setForm((p) => ({ ...p, tcNo: maskTcKimlik(e.target.value) }))} inputMode="numeric" pattern="[0-9]{11}" maxLength={11} placeholder="11 haneli kimlik no" />
        </div>
      )}
      <div className="space-y-2">
        <Label>Telefon</Label>
        <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: maskTrPhone(e.target.value) }))} inputMode="tel" autoComplete="tel" maxLength={17} placeholder="+90 5XX XXX XX XX" />
      </div>
      <div className="space-y-2">
        <Label>Eğitim</Label>
        <Input value={form.education} onChange={(e) => setForm((p) => ({ ...p, education: e.target.value }))} />
      </div>
      {form.startDate !== undefined && (
        <div className="space-y-2">
          <Label>Başlangıç Tarihi</Label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Kampüs</Label>
        <Input value={form.campus} onChange={(e) => setForm((p) => ({ ...p, campus: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Sınıf Öğretmenliği</Label>
        <Select
          value={form.homeroomClass || EMPTY_HOME_ROOM}
          onValueChange={(value) => setForm((p) => ({ ...p, homeroomClass: value === EMPTY_HOME_ROOM ? '' : value }))}
        >
          <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_HOME_ROOM}>Yok</SelectItem>
            {classes.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 col-span-2">
        <Label>Atanan Sınıflar</Label>
        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => (
            <Button key={cls} type="button" variant={form.assignedClasses.includes(cls) ? 'default' : 'outline'} size="sm" onClick={() => toggleAssignedClass(cls)}>
              {cls}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Medeni Durum</Label>
        <Select value={form.maritalStatus} onValueChange={(value) => setForm((p) => ({ ...p, maritalStatus: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Bekar">Bekar</SelectItem>
            <SelectItem value="Evli">Evli</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Çocuk Sayısı</Label>
        <Input value={form.childCount} onChange={(e) => {
          const value = maskPositiveInteger(e.target.value, 2);
          setForm((p) => ({ ...p, childCount: value === '' ? 0 : Number(value) }));
        }} inputMode="numeric" maxLength={2} placeholder="0" />
      </div>
      <div className="space-y-2 col-span-2">
        <Label>Not</Label>
        <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
      </div>
    </div>
  );
}

function AddTeacherDialog({
  open, onOpenChange, branches, classes, onCreated, onCreateBranch,
}) {
  const { toast } = useToast();
  const { user } = useApp();
  const tenantName = user?.tenant || '';
  const [saving, setSaving] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    role: 'Teacher',
    departmentOrBranch: '',
    tcNo: '',
    phone: '',
    education: 'Lisans',
    startDate: '',
    campus: 'Merkez Kampüs',
    homeroomClass: '',
    assignedClasses: [],
    maritalStatus: 'Bekar',
    childCount: 0,
    note: '',
    photoUrl: '',
  });

  const handleSave = async () => {
    if (!form.fullName?.trim() || !form.departmentOrBranch) {
      toast({ title: 'Eksik bilgi', description: 'Ad-soyad ve branş zorunlu.', variant: 'destructive' });
      return;
    }
    if (!isValidTcKimlik(form.tcNo)) {
      toast({ title: 'Geçersiz TC kimlik no', description: 'Geçerli bir TC kimlik numarası girin (11 haneli).', variant: 'destructive' });
      return;
    }
    if (form.phone && !isValidTrPhone(form.phone)) {
      toast({ title: 'Geçersiz telefon', description: 'Telefon +90 5XX XXX XX XX biçiminde olmalıdır.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const created = await createStaff({ ...form, email: '' });
      onCreated({ ...created, assignedClasses: form.assignedClasses, departmentOrBranch: form.departmentOrBranch, phone: form.phone });
      const roleLabel = form.role === 'Administrative' ? 'İdari Personel'
        : form.role === 'Accounting' ? 'Muhasebe'
        : 'Öğretmen';
      setCreatedCredentials({
        fullName: created.fullName || form.fullName,
        username: created.username,
        password: created.password,
        roleLabel,
        branch: form.departmentOrBranch,
      });
      try {
        await downloadCredentialsPdf({
          tenantName,
          fullName: created.fullName || form.fullName,
          role: roleLabel,
          username: created.username,
          temporaryPassword: created.password,
          extra: form.departmentOrBranch ? `Brans: ${form.departmentOrBranch}` : undefined,
        });
      } catch (pdfErr) {
        console.warn('PDF üretimi başarısız', pdfErr);
      }
      toast({ title: 'Personel oluşturuldu', description: 'Bilgiler PDF olarak indirildi.' });
    } catch (err) {
      toast({ title: 'Personel oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCreatedCredentials(null);
    onOpenChange(false);
  };

  const handleDownloadAgain = async () => {
    if (!createdCredentials) return;
    await downloadCredentialsPdf({
      tenantName,
      fullName: createdCredentials.fullName,
      role: createdCredentials.roleLabel,
      username: createdCredentials.username,
      temporaryPassword: createdCredentials.password,
      extra: createdCredentials.branch ? `Brans: ${createdCredentials.branch}` : undefined,
    });
  };

  if (createdCredentials) {
    return (
      <Dialog open={open} onOpenChange={(value) => { if (!value) handleClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createdCredentials.roleLabel} Oluşturuldu</DialogTitle>
            <DialogDescription>
              Bilgiler PDF olarak indirildi. Kaybederseniz aşağıdan tekrar indirebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Ad Soyad</div>
              <div className="font-medium">{createdCredentials.fullName}</div>
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-xs text-muted-foreground">Kullanıcı Adı</div>
              <div className="font-mono text-sm break-all">{createdCredentials.username}</div>
            </div>
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</div>
              <div className="font-mono text-base font-bold tracking-wider">{createdCredentials.password}</div>
              <div className="text-xs text-amber-700 dark:text-amber-400">İlk girişte değiştirilmesi zorunludur.</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDownloadAgain}>PDF İndir</Button>
            <Button onClick={handleClose}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Öğretmen Ekle</DialogTitle>
          <DialogDescription>Öğretmen bilgilerini girin</DialogDescription>
        </DialogHeader>
        <TeacherFormFields form={form} setForm={setForm} branches={branches} classes={classes} onCreateBranch={onCreateBranch} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTeacherDialog({
  open, onOpenChange, teacher, branches, classes, onUpdated, onCreateBranch,
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    departmentOrBranch: '',
    phone: '',
    education: '',
    campus: '',
    homeroomClass: '',
    assignedClasses: [],
    maritalStatus: 'Bekar',
    childCount: 0,
    note: '',
    photoUrl: '',
  });

  useEffect(() => {
    if (teacher) {
      setForm({
        fullName: teacher.fullName || '',
        departmentOrBranch: teacher.departmentOrBranch || '',
        phone: maskTrPhone(teacher.phone || ''),
        education: teacher.education || 'Lisans',
        campus: teacher.campus || 'Merkez Kampüs',
        homeroomClass: teacher.homeroomClass || '',
        assignedClasses: Array.isArray(teacher.assignedClasses) ? [...teacher.assignedClasses] : [],
        maritalStatus: teacher.maritalStatus || 'Bekar',
        childCount: teacher.childCount || 0,
        note: teacher.note || '',
        photoUrl: teacher.photoUrl || '',
      });
    }
  }, [teacher]);

  const handleSave = async () => {
    if (!form.fullName?.trim() || !form.departmentOrBranch) {
      toast({ title: 'Eksik bilgi', description: 'Ad-soyad ve branş zorunlu.', variant: 'destructive' });
      return;
    }
    if (form.phone && !isValidTrPhone(form.phone)) {
      toast({ title: 'Geçersiz telefon', description: 'Telefon +90 5XX XXX XX XX biçiminde olmalıdır.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const updated = await updateStaff(teacher.id, { ...form, email: teacher?.email || '' });
      onUpdated(updated);
      toast({ title: 'Güncellendi', description: `${updated.fullName} bilgileri güncellendi.` });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Güncellenemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Öğretmen Bilgilerini Düzenle</DialogTitle>
          <DialogDescription>{teacher?.fullName}</DialogDescription>
        </DialogHeader>
        <TeacherFormFields form={form} setForm={setForm} branches={branches} classes={classes} onCreateBranch={onCreateBranch} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Güncelle'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Teachers() {
  const { openDrawer } = useApp();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState(DIRECTORY_ALL);
  const [statusFilter, setStatusFilter] = useState(DIRECTORY_ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [staff, setStaff] = useState([]);
  const [classNames, setClassNames] = useState([]);
  const [savedBranches, setSavedBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staffList, classList, branchConfigurations] = await Promise.all([
        fetchStaff('Teacher'),
        fetchClasses().catch(() => []),
        fetchPlatformConfigurations('staff-branches').catch(() => []),
      ]);
      setStaff(staffList);
      setClassNames(Array.isArray(classList) ? classList : []);
      setSavedBranches(readSavedStaffBranches(branchConfigurations));
    } catch (err) {
      setError(err.message || 'Öğretmen listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const branches = useMemo(() => {
    const fromStaff = staff.map((t) => t.departmentOrBranch).filter(Boolean);
    return mergeBranches(PREDEFINED_BRANCHES, [...fromStaff, ...savedBranches]);
  }, [savedBranches, staff]);

  const createBranch = async (name) => {
    const next = mergeBranches(savedBranches, [name]);
    try {
      await upsertPlatformConfiguration(staffBranchConfigurationPayload(next));
      setSavedBranches(next);
      toast({ title: 'Branş oluşturuldu', description: `${name} seçim listesine eklendi.` });
      return true;
    } catch (err) {
      toast({ title: 'Branş oluşturulamadı', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  const classes = useMemo(
    () => [...new Set((classNames || []).filter(Boolean))],
    [classNames],
  );

  const filteredTeachers = useMemo(() => staff.filter((teacher) => {
    const haystack = `${teacher.fullName} ${teacher.email} ${teacher.username} ${teacher.phone}`;
    const matchesSearch = haystack.toLowerCase().includes(search.toLowerCase());
    const matchesBranch = branchFilter === DIRECTORY_ALL || teacher.departmentOrBranch === branchFilter;
    const isPassive = isUserPassive(teacher.status);
    const matchesStatus = statusFilter === DIRECTORY_ALL
      || (statusFilter === 'active' && !isPassive)
      || (statusFilter === 'passive' && isPassive);
    return matchesSearch && matchesBranch && matchesStatus;
  }), [staff, search, branchFilter, statusFilter]);

  // Öğretmeni pasife alma / aktifleştirme: hesap kapatılmaz, girişi engellenir.
  const handleToggleStatus = useCallback(async (teacher) => {
    if (!teacher?.username) {
      toast({ title: 'İşlem yapılamadı', description: 'Bu kayıt için kullanıcı adı bulunamadı.', variant: 'destructive' });
      return;
    }
    const isPassive = isUserPassive(teacher.status);
    const nextStatus = isPassive ? 'Active' : 'Passive';
    try {
      await updateUserStatus(teacher.username, nextStatus);
      setStaff((prev) => prev.map((t) => (t.id === teacher.id ? { ...t, status: nextStatus } : t)));
      toast({
        title: isPassive ? 'Öğretmen aktifleştirildi' : 'Öğretmen pasife alındı',
        description: isPassive
          ? `${teacher.fullName} yeniden giriş yapabilir.`
          : `${teacher.fullName} artık giriş yapamaz; açık oturumları sonlandırıldı.`,
      });
    } catch (err) {
      toast({ title: 'Durum güncellenemedi', description: err.message, variant: 'destructive' });
    }
  }, [toast]);

  const handleCreated = (created) => {
    setStaff((prev) => [{
      id: created.userId || created.id,
      fullName: created.fullName,
      username: created.username,
      role: created.role,
      departmentOrBranch: created.departmentOrBranch || '',
      assignedClasses: Array.isArray(created.assignedClasses) ? created.assignedClasses : [],
      email: created.email || '',
      phone: created.phone || '',
      homeroomClass: created.homeroomClass || '',
      education: created.education || '',
      maritalStatus: created.maritalStatus || '',
      childCount: created.childCount || 0,
      note: created.note || '',
      photoUrl: created.photoUrl || '',
    }, ...prev]);
  };

  const handleUpdated = (updated) => {
    setStaff((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
  };

  const openEditDialog = (teacher) => {
    setEditingTeacher(teacher);
    setEditDialogOpen(true);
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  const activeCount = staff.filter((teacher) => !isUserPassive(teacher.status)).length;
  const homeroomCount = staff.filter((teacher) => Boolean(teacher.homeroomClass)).length;
  const unassignedCount = staff.filter((teacher) => (teacher.assignedClasses || []).length === 0).length;

  return (
    <>
      <DirectoryPage
        testId="teachers-page"
        title="Öğretmenler"
        subtitle={`${activeCount} öğretmeniniz bulunuyor`}
        rangeLabel={(from, to, total) => `${total} öğretmenden ${from}-${to} arası gösteriliyor`}
        emptyTitle="Öğretmen bulunamadı"
        emptyDescription="Filtreleri değiştirin veya yeni bir öğretmen ekleyin."
        banner={error ? <ErrorBanner title="Öğretmenler alınamadı" message={error} onRetry={loadTeachers} /> : null}
        actions={(
          <FeatureGate module="teachers" action="create">
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Yeni Öğretmen
            </Button>
          </FeatureGate>
        )}
        stats={[
          { label: 'Toplam Öğretmen', value: staff.length, caption: 'Tüm zamanlar', icon: Users, tint: 'bg-sky-500/12 text-sky-600' },
          { label: 'Aktif Öğretmen', value: activeCount, caption: `%${staff.length ? Math.round((activeCount / staff.length) * 1000) / 10 : 0}`, icon: UserCheck, tint: 'bg-emerald-500/12 text-emerald-600' },
          { label: 'Sınıf Öğretmeni', value: homeroomCount, caption: 'Şube sorumlusu', icon: GraduationCap, tint: 'bg-violet-500/12 text-violet-600' },
          { label: 'Sınıf Ataması Yok', value: unassignedCount, caption: 'Ders programı beklemede', icon: UserMinus, tint: 'bg-amber-500/12 text-amber-600' },
        ]}
        search={{ value: search, onChange: setSearch, placeholder: 'Öğretmen ara...' }}
        filters={[
          { value: branchFilter, onChange: setBranchFilter, placeholder: 'Tüm Branşlar', options: branches },
          { value: statusFilter, onChange: setStatusFilter, placeholder: 'Tüm Durumlar', options: [{ value: 'active', label: 'Aktif' }] },
        ]}
        rows={filteredTeachers}
        getRowId={(teacher) => teacher.id}
        onRowClick={(teacher) => openDrawer(<TeacherDetailDrawer teacher={teacher} />)}
        columns={[
          {
            key: 'fullName',
            label: 'Öğretmen',
            sortable: true,
            width: 'minmax(0,2fr)',
            render: (teacher) => (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {teacher.photoUrl ? <AvatarImage src={assetUrl(teacher.photoUrl)} alt={teacher.fullName} className="object-cover" /> : null}
                  <AvatarFallback className="bg-brand-primary text-white">
                    {teacher.fullName.split(' ').map((part) => part[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{teacher.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{teacher.email || teacher.username}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'departmentOrBranch',
            label: 'Branş',
            sortable: true,
            width: 'minmax(0,1fr)',
            render: (teacher) => (
              <Badge className="bg-brand-accent text-white">
                {teacher.departmentOrBranch || (ROLE_LABELS[teacher.role] || teacher.role)}
              </Badge>
            ),
          },
          {
            key: 'contact',
            label: 'İletişim',
            width: 'minmax(0,1.2fr)',
            render: (teacher) => (
              <div className="min-w-0 text-xs">
                <p className="flex items-center gap-1.5 font-medium"><Phone className="h-3 w-3 text-muted-foreground" />{teacher.phone || '—'}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-muted-foreground"><Mail className="h-3 w-3" />{teacher.email || '—'}</p>
              </div>
            ),
          },
          {
            key: 'assignedClasses',
            label: 'Sınıflar',
            width: 'minmax(0,1.2fr)',
            render: (teacher) => (
              <div className="flex flex-wrap gap-1">
                {(teacher.assignedClasses || []).slice(0, 3).map((item) => (
                  <Badge key={item} variant="outline" className="text-xs">{item}</Badge>
                ))}
                {(teacher.assignedClasses || []).length > 3 ? (
                  <Badge variant="outline" className="text-xs">+{teacher.assignedClasses.length - 3}</Badge>
                ) : null}
                {(teacher.assignedClasses || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">Atama yok</span>
                ) : null}
              </div>
            ),
          },
          {
            key: 'homeroomClass',
            label: 'Sınıf Öğretmeni',
            sortable: true,
            width: 'minmax(0,0.9fr)',
            render: (teacher) => (teacher.homeroomClass
              ? <Badge variant="outline" className="border-brand-accent/40 text-brand-accent">{teacher.homeroomClass}</Badge>
              : <span className="text-xs text-muted-foreground">—</span>),
          },
          {
            key: 'status',
            label: 'Durum',
            sortable: true,
            width: 'minmax(0,0.7fr)',
            render: (teacher) => (isUserPassive(teacher.status)
              ? <Badge className="bg-red-100 text-red-700">Pasif</Badge>
              : <Badge className="bg-green-100 text-green-700">Aktif</Badge>),
          },
        ]}
        rowActions={(teacher) => (
          <>
            <Button variant="ghost" size="icon" title="Detay" onClick={() => openDrawer(<TeacherDetailDrawer teacher={teacher} />)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Düzenle" onClick={() => openEditDialog(teacher)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <FeatureGate module="teachers" action="status">
              <UserStatusButton
                iconOnly
                isPassive={isUserPassive(teacher.status)}
                onToggle={() => handleToggleStatus(teacher)}
              />
            </FeatureGate>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openDrawer(<TeacherDetailDrawer teacher={teacher} />)}>
                  <Eye className="mr-2 h-4 w-4" /> Detay
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                  <Pencil className="mr-2 h-4 w-4" /> Düzenle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        cardRender={(teacher) => (
          <button
            type="button"
            onClick={() => openDrawer(<TeacherDetailDrawer teacher={teacher} />)}
            className="flex w-full flex-col items-start gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4 text-left transition hover:border-[hsl(var(--brand-accent)/0.35)]"
          >
            <div className="flex w-full items-center gap-3">
              <Avatar className="h-11 w-11">
                {teacher.photoUrl ? <AvatarImage src={assetUrl(teacher.photoUrl)} alt={teacher.fullName} className="object-cover" /> : null}
                <AvatarFallback className="bg-brand-primary text-white">
                  {teacher.fullName.split(' ').map((part) => part[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{teacher.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{teacher.departmentOrBranch || '—'}</p>
              </div>
              {isUserPassive(teacher.status)
                ? <Badge className="bg-red-100 text-red-700">Pasif</Badge>
                : <Badge className="bg-green-100 text-green-700">Aktif</Badge>}
            </div>
            <div className="w-full text-xs text-muted-foreground">
              <p className="truncate">{teacher.email || teacher.username}</p>
              <p className="truncate">{(teacher.assignedClasses || []).join(', ') || 'Sınıf ataması yok'}</p>
            </div>
          </button>
        )}
      />

      <AddTeacherDialog open={dialogOpen} onOpenChange={setDialogOpen} branches={branches} classes={classes} onCreated={handleCreated} onCreateBranch={createBranch} />
      <EditTeacherDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} teacher={editingTeacher} branches={branches} classes={classes} onUpdated={handleUpdated} onCreateBranch={createBranch} />
    </>
  );
}
