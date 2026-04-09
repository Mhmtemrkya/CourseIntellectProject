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
import { createStaff, fetchQuestionBank, fetchStaff } from '../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
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
          <p className="text-sm text-muted-foreground">{teacher.departmentOrBranch || teacher.department || 'Branş atanmadı'} • {teacher.role}</p>
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

function AddTeacherDialog({
  open, onOpenChange, branches, classes, onCreated,
}) {
  const { toast } = useToast();
  const EMPTY_HOME_ROOM = '__none__';
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    role: 'Teacher',
    departmentOrBranch: '',
    tcNo: '',
    phone: '',
    email: '',
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
    if (!form.fullName || !form.departmentOrBranch || !form.email) {
      toast({
        title: 'Eksik bilgi',
        description: 'Ad, branş ve e-posta zorunlu.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSaving(true);
      const created = await createStaff(form);
      onCreated(created);
      toast({
        title: 'Personel oluşturuldu',
        description: `${created.fullName} için ${created.username} kullanıcısı üretildi.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Personel oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAssignedClass = (value) => {
    setForm((prev) => ({
      ...prev,
      assignedClasses: prev.assignedClasses.includes(value)
        ? prev.assignedClasses.filter((item) => item !== value)
        : [...prev.assignedClasses, value],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yeni Öğretmen Ekle</DialogTitle>
          <DialogDescription>Öğretmen bilgilerini girin</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2 col-span-2">
            <Label>Ad Soyad</Label>
            <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={form.role} onValueChange={(value) => setForm((p) => ({ ...p, role: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Teacher">Teacher</SelectItem>
                <SelectItem value="Administrative">Administrative</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Branş / Birim</Label>
            <Select value={form.departmentOrBranch} onValueChange={(value) => setForm((p) => ({ ...p, departmentOrBranch: value }))}>
              <SelectTrigger><SelectValue placeholder="Branş seçin" /></SelectTrigger>
              <SelectContent>
                {branches.map((branch) => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>TC No</Label>
            <Input value={form.tcNo} onChange={(e) => setForm((p) => ({ ...p, tcNo: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>E-posta</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Eğitim</Label>
            <Input value={form.education} onChange={(e) => setForm((p) => ({ ...p, education: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Başlangıç Tarihi</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
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
  const [staff, setStaff] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staffList, questions] = await Promise.all([
        fetchStaff('Teacher'),
        fetchQuestionBank().catch(() => []),
      ]);
      setStaff(staffList);
      setQuestionBank(questions);
    } catch (err) {
      setError(err.message || 'Öğretmen listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const branches = useMemo(() => [...new Set(staff.map((t) => t.departmentOrBranch).filter(Boolean))], [staff]);
  const classes = useMemo(() => {
    const merged = [
      ...staff.flatMap((t) => t.assignedClasses || []),
      '9-A',
      '10-A',
      '10-B',
      '11-Sayisal',
      '12-Dil',
    ];
    return [...new Set(merged.filter(Boolean))];
  }, [staff]);

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
      id: created.userId,
      fullName: created.fullName,
      username: created.username,
      role: created.role,
      departmentOrBranch: created.departmentOrBranch || '',
      assignedClasses: Array.isArray(created.assignedClasses) ? created.assignedClasses : [],
      email: created.email || '',
      phone: created.phone || '',
    }, ...prev]);
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
                  <TableCell><Badge className="bg-brand-accent">{teacher.departmentOrBranch || teacher.role}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(teacher.assignedClasses || []).slice(0, 3).map((cls) => <Badge key={cls} variant="outline" className="text-xs">{cls}</Badge>)}
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
    </motion.div>
  );
}
