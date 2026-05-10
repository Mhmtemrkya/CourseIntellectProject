import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Mail,
  Phone,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Pencil,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
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
import { createStaff, updateStaff, fetchQuestionBank, fetchStaff, fetchClasses } from '../lib/api/modules';
import { downloadCredentialsPdf } from '../lib/credentialsPdf';

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

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function TeacherDetailDrawer({ teacher }) {
  if (!teacher) return null;
  const assignedClasses = Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses : [];
  const initials = String(teacher.fullName || 'OG')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Öğretmen Detayı</SheetTitle>
        <SheetDescription>Öğretmen bilgileri ve istatistikleri</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-brand-primary text-white text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{teacher.fullName}</h3>
          <p className="text-sm text-muted-foreground">{teacher.departmentOrBranch || 'Branş atanmadı'} • {ROLE_LABELS[teacher.role] || teacher.role}</p>
          <Badge className="bg-brand-accent mt-1">{assignedClasses.length} Sınıf</Badge>
        </div>
      </div>

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
        <h4 className="font-medium">Bekleyen Sorular</h4>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/10">
              <HelpCircle className="h-5 w-5 text-brand-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{teacher.pendingQuestions}</p>
              <p className="text-xs text-muted-foreground">Yanıt bekleyen soru</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeacherFormFields({ form, setForm, branches, classes }) {
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
      {form.role !== undefined && (
        <div className="space-y-2">
          <Label>Rol</Label>
          <Select value={form.role} onValueChange={(value) => setForm((p) => ({ ...p, role: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Teacher">Öğretmen</SelectItem>
              <SelectItem value="Administrative">İdari Personel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Branş / Birim</Label>
        <Select value={form.departmentOrBranch} onValueChange={(value) => setForm((p) => ({ ...p, departmentOrBranch: value }))}>
          <SelectTrigger><SelectValue placeholder="Branş seçin" /></SelectTrigger>
          <SelectContent>
            {branches.map((branch) => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {form.tcNo !== undefined && (
        <div className="space-y-2">
          <Label>TC No</Label>
          <Input value={form.tcNo} onChange={(e) => setForm((p) => ({ ...p, tcNo: e.target.value }))} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Telefon</Label>
        <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
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
        <Label>Kampus</Label>
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
        <Input type="number" value={form.childCount} onChange={(e) => setForm((p) => ({ ...p, childCount: Number(e.target.value) }))} />
      </div>
      <div className="space-y-2 col-span-2">
        <Label>Not</Label>
        <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
      </div>
    </div>
  );
}

function AddTeacherDialog({
  open, onOpenChange, branches, classes, onCreated,
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
    campus: 'Merkez Kampus',
    homeroomClass: '',
    assignedClasses: [],
    maritalStatus: 'Bekar',
    childCount: 0,
    note: '',
  });

  const handleSave = async () => {
    if (!form.fullName?.trim() || !form.departmentOrBranch) {
      toast({ title: 'Eksik bilgi', description: 'Ad-soyad ve branş zorunlu.', variant: 'destructive' });
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
        <TeacherFormFields form={form} setForm={setForm} branches={branches} classes={classes} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTeacherDialog({
  open, onOpenChange, teacher, branches, classes, onUpdated,
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
  });

  useEffect(() => {
    if (teacher) {
      setForm({
        fullName: teacher.fullName || '',
        departmentOrBranch: teacher.departmentOrBranch || '',
        phone: teacher.phone || '',
        education: teacher.education || 'Lisans',
        campus: teacher.campus || 'Merkez Kampus',
        homeroomClass: teacher.homeroomClass || '',
        assignedClasses: Array.isArray(teacher.assignedClasses) ? [...teacher.assignedClasses] : [],
        maritalStatus: teacher.maritalStatus || 'Bekar',
        childCount: teacher.childCount || 0,
        note: teacher.note || '',
      });
    }
  }, [teacher]);

  const handleSave = async () => {
    if (!form.fullName?.trim() || !form.departmentOrBranch) {
      toast({ title: 'Eksik bilgi', description: 'Ad-soyad ve branş zorunlu.', variant: 'destructive' });
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
        <TeacherFormFields form={form} setForm={setForm} branches={branches} classes={classes} />
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
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [sortField, setSortField] = useState('fullName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [staff, setStaff] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [classNames, setClassNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staffList, questions, classList] = await Promise.all([
        fetchStaff('Teacher'),
        fetchQuestionBank().catch(() => []),
        fetchClasses().catch(() => []),
      ]);
      setStaff(staffList);
      setQuestionBank(questions);
      setClassNames(Array.isArray(classList) ? classList : []);
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
    return [...new Set([...PREDEFINED_BRANCHES, ...fromStaff])];
  }, [staff]);

  const classes = useMemo(
    () => [...new Set((classNames || []).filter(Boolean))],
    [classNames],
  );

  const enrichedTeachers = useMemo(() => staff.map((teacher) => ({
    ...teacher,
    pendingQuestions: questionBank.filter((item) => normalizeText(item.teacher) === normalizeText(teacher.fullName)).length,
  })), [staff, questionBank]);

  const filteredTeachers = useMemo(() => {
    return enrichedTeachers
      .filter((teacher) => {
        const matchesSearch = `${teacher.fullName} ${teacher.email}`.toLowerCase().includes(search.toLowerCase());
        const matchesBranch = branchFilter === 'all' || teacher.departmentOrBranch === branchFilter;
        return matchesSearch && matchesBranch;
      })
      .sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });
  }, [enrichedTeachers, search, branchFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="teachers-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Öğretmenler</h1>
          <p className="text-muted-foreground mt-1">{staff.length} kayıtlı öğretmen</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Öğretmen
        </Button>
      </div>

      {error ? <ErrorBanner title="Öğretmenler alınamadı" message={error} onRetry={loadTeachers} /> : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Öğretmen ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Branş" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Branşlar</SelectItem>
                {branches.map((branch) => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('fullName')}>
                  <div className="flex items-center gap-2">Öğretmen<SortIcon field="fullName" /></div>
                </TableHead>
                <TableHead>Branş</TableHead>
                <TableHead>Sınıflar</TableHead>
                <TableHead>Bekleyen Soru</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((teacher) => (
                <TableRow key={teacher.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openDrawer(<TeacherDetailDrawer teacher={teacher} />)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-brand-primary text-white">
                          {teacher.fullName.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{teacher.fullName}</p>
                        <p className="text-sm text-muted-foreground">{teacher.email || teacher.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge className="bg-brand-accent">{teacher.departmentOrBranch || (ROLE_LABELS[teacher.role] || teacher.role)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(teacher.assignedClasses || []).slice(0, 3).map((cls) => <Badge key={cls} variant="outline" className="text-xs">{cls}</Badge>)}
                      {(teacher.assignedClasses || []).length === 0 && <span className="text-xs text-muted-foreground">Atama yok</span>}
                    </div>
                  </TableCell>
                  <TableCell>{teacher.pendingQuestions}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDrawer(<TeacherDetailDrawer teacher={teacher} />)}>
                          <Eye className="h-4 w-4 mr-2" /> Detay
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(teacher); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Düzenle
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddTeacherDialog open={dialogOpen} onOpenChange={setDialogOpen} branches={branches} classes={classes} onCreated={handleCreated} />
      <EditTeacherDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} teacher={editingTeacher} branches={branches} classes={classes} onUpdated={handleUpdated} />
    </motion.div>
  );
}
