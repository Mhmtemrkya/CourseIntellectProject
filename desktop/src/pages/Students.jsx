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
import { Progress } from '../components/ui/progress';
import { SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { createStudent, fetchAttendance, fetchClasses, fetchExamResults, fetchStudents } from '../lib/api/modules';
import { downloadCredentialsPdf } from '../lib/credentialsPdf';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const FALLBACK_CLASSES = [];

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function StudentDetailDrawer({ student }) {
  if (!student) return null;

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Öğrenci Detayı</SheetTitle>
        <SheetDescription>Öğrenci bilgileri ve istatistikleri</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-brand-primary text-white text-lg">
            {student.fullName.split(' ').map((n) => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{student.fullName}</h3>
          <p className="text-sm text-muted-foreground">{student.className} • {student.programType}</p>
          <Badge className={student.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {student.status}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">İletişim Bilgileri</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{student.parentEmail}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{student.parentPhone}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">İstatistikler</h4>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-brand-primary">{student.attendanceRate}%</p>
              <p className="text-xs text-muted-foreground">Devam Oranı</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-brand-accent">{student.lastExamScore}</p>
              <p className="text-xs text-muted-foreground">Son Sınav</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Devam Durumu</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Katılım</span>
            <span>{student.attendanceRate}%</span>
          </div>
          <Progress value={student.attendanceRate} className="h-2" />
        </div>
      </div>
    </div>
  );
}

function AddStudentDialog({
  open, onOpenChange, classes, onCreated,
}) {
  const { toast } = useToast();
  const { user } = useApp();
  const tenantName = user?.tenant || '';
  const [saving, setSaving] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    tcNo: '',
    className: '',
    currentSchool: tenantName,
    schoolNumber: '',
    birthDate: '',
    programType: 'Sayisal',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    address: '',
    note: '',
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, currentSchool: tenantName }));
  }, [tenantName]);

  const handleSave = async () => {
    if (!form.fullName || !form.className || !form.parentName) {
      toast({
        title: 'Eksik bilgi',
        description: 'Ad, sınıf ve veli adı zorunlu.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSaving(true);
      const created = await createStudent(form);
      onCreated(created);
      const studentInfo = {
        fullName: created.fullName || form.fullName,
        username: created.username,
        password: created.password,
        className: created.className || form.className,
      };
      const parentInfo = created.parent
        ? {
          fullName: created.parent.fullName || form.parentName,
          username: created.parent.username,
          password: created.parent.password,
        }
        : null;
      setCreatedCredentials({ student: studentInfo, parent: parentInfo });
      try {
        await downloadCredentialsPdf({
          tenantName,
          fullName: studentInfo.fullName,
          role: 'Öğrenci',
          username: studentInfo.username,
          temporaryPassword: studentInfo.password,
          className: studentInfo.className,
        });
        if (parentInfo) {
          await downloadCredentialsPdf({
            tenantName,
            fullName: parentInfo.fullName,
            role: 'Veli',
            username: parentInfo.username,
            temporaryPassword: parentInfo.password,
            extra: `Velisi olduğu öğrenci: ${studentInfo.fullName} (${studentInfo.className})`,
          });
        }
      } catch (pdfErr) {
        console.warn('PDF üretimi başarısız', pdfErr);
      }
      toast({
        title: 'Öğrenci oluşturuldu',
        description: parentInfo
          ? 'Öğrenci ve veli bilgileri PDF olarak indirildi.'
          : 'Bilgiler PDF olarak indirildi.',
      });
    } catch (err) {
      toast({
        title: 'Öğrenci oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCreatedCredentials(null);
    onOpenChange(false);
  };

  const handleDownloadStudent = async () => {
    if (!createdCredentials?.student) return;
    const s = createdCredentials.student;
    await downloadCredentialsPdf({
      tenantName,
      fullName: s.fullName,
      role: 'Öğrenci',
      username: s.username,
      temporaryPassword: s.password,
      className: s.className,
    });
  };

  const handleDownloadParent = async () => {
    if (!createdCredentials?.parent || !createdCredentials?.student) return;
    const p = createdCredentials.parent;
    const s = createdCredentials.student;
    await downloadCredentialsPdf({
      tenantName,
      fullName: p.fullName,
      role: 'Veli',
      username: p.username,
      temporaryPassword: p.password,
      extra: `Velisi olduğu öğrenci: ${s.fullName} (${s.className})`,
    });
  };

  if (createdCredentials) {
    const s = createdCredentials.student;
    const p = createdCredentials.parent;
    return (
      <Dialog open={open} onOpenChange={(value) => { if (!value) handleClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kayıt Tamamlandı</DialogTitle>
            <DialogDescription>
              {p ? 'Öğrenci ve veli bilgileri PDF olarak indirildi.' : 'Öğrenci bilgileri PDF olarak indirildi.'}
              {' '}Her iki taraf da ilk girişte şifrelerini değiştirmek zorundadır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">Öğrenci</span>
                {s.fullName} {s.className ? `• ${s.className}` : ''}
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Kullanıcı Adı</div>
                <div className="font-mono text-sm break-all">{s.username}</div>
              </div>
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</div>
                <div className="font-mono text-base font-bold tracking-wider">{s.password}</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadStudent} className="w-full">
                Öğrenci PDF'ini Tekrar İndir
              </Button>
            </div>

            {p && (
              <div className="space-y-2 pt-2 border-t">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs">Veli</span>
                  {p.fullName}
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Kullanıcı Adı</div>
                  <div className="font-mono text-sm break-all">{p.username}</div>
                </div>
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1">
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</div>
                  <div className="font-mono text-base font-bold tracking-wider">{p.password}</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadParent} className="w-full">
                  Veli PDF'ini Tekrar İndir
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yeni Öğrenci Ekle</DialogTitle>
          <DialogDescription>Öğrenci bilgilerini girin</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2 col-span-2">
            <Label>Ad Soyad</Label>
            <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>TC No</Label>
            <Input value={form.tcNo} onChange={(e) => setForm((p) => ({ ...p, tcNo: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Sınıf</Label>
            <Select value={form.className} onValueChange={(value) => setForm((p) => ({ ...p, className: value }))}>
              <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
              <SelectContent>
                {classes.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mevcut Okul</Label>
            <Input value={tenantName} readOnly className="bg-muted cursor-not-allowed" />
          </div>
          <div className="space-y-2">
            <Label>Okul No</Label>
            <Input value={form.schoolNumber} onChange={(e) => setForm((p) => ({ ...p, schoolNumber: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Doğum Tarihi</Label>
            <Input type="date" value={form.birthDate} onChange={(e) => setForm((p) => ({ ...p, birthDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Program</Label>
            <Select value={form.programType} onValueChange={(value) => setForm((p) => ({ ...p, programType: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sayisal">Sayısal</SelectItem>
                <SelectItem value="Sozel">Sözel</SelectItem>
                <SelectItem value="EA">Eşit Ağırlık</SelectItem>
                <SelectItem value="Dil">Dil</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Veli Adı</Label>
            <Input value={form.parentName} onChange={(e) => setForm((p) => ({ ...p, parentName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Veli Telefon</Label>
            <Input value={form.parentPhone} onChange={(e) => setForm((p) => ({ ...p, parentPhone: e.target.value }))} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Veli E-posta</Label>
            <Input type="email" value={form.parentEmail} onChange={(e) => setForm((p) => ({ ...p, parentEmail: e.target.value }))} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Adres</Label>
            <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
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

export default function Students() {
  const { openDrawer } = useApp();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('fullName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [classNames, setClassNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, attendanceList, examList, classList] = await Promise.all([
        fetchStudents(),
        fetchAttendance().catch(() => []),
        fetchExamResults().catch(() => []),
        fetchClasses().catch(() => []),
      ]);
      setStudents(studentList);
      setAttendance(attendanceList);
      setExamResults(examList);
      setClassNames(Array.isArray(classList) ? classList : []);
    } catch (err) {
      setError(err.message || 'Öğrenci listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const classes = useMemo(
    () => [...new Set((classNames || []).filter(Boolean))],
    [classNames],
  );

  const enrichedStudents = useMemo(() => students.map((student) => {
    const studentAttendance = attendance.filter((item) => normalizeText(item.studentName) === normalizeText(student.fullName));
    const presentCount = studentAttendance.filter((item) => normalizeText(item.status) === 'katildi').length;
    const attendanceRate = studentAttendance.length > 0 ? Math.round((presentCount / studentAttendance.length) * 100) : 0;
    const relatedExam = examResults
      .filter((item) => normalizeText(item.studentName) === normalizeText(student.fullName))
      .sort((a, b) => String(b.dateLabel || '').localeCompare(String(a.dateLabel || '')))[0];
    return {
      ...student,
      attendanceRate,
      lastExamScore: relatedExam?.score || '-',
    };
  }), [students, attendance, examResults]);

  const filteredStudents = useMemo(() => {
    return enrichedStudents
      .filter((student) => {
        const matchesSearch = `${student.fullName} ${student.parentEmail}`.toLowerCase().includes(search.toLowerCase());
        const matchesClass = classFilter === 'all' || student.className === classFilter;
        const matchesStatus = statusFilter === 'all' || normalizeText(student.status) === normalizeText(statusFilter);
        return matchesSearch && matchesClass && matchesStatus;
      })
      .sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });
  }, [enrichedStudents, search, classFilter, statusFilter, sortField, sortDirection]);

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
    setStudents((prev) => [{
      id: created.userId,
      fullName: created.fullName,
      username: created.username,
      className: created.className,
      status: 'Aktif',
      parentEmail: '',
      parentPhone: '',
      parentName: '',
      programType: '',
    }, ...prev]);
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="students-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Öğrenciler</h1>
          <p className="text-muted-foreground mt-1">{students.length} kayıtlı öğrenci</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Öğrenci
        </Button>
      </div>

      {error ? <ErrorBanner title="Öğrenciler alınamadı" message={error} onRetry={loadStudents} /> : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Öğrenci ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Sınıf" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {classes.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="Aktif">Aktif</SelectItem>
                <SelectItem value="Pasif">Pasif</SelectItem>
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
                  <div className="flex items-center gap-2">Öğrenci<SortIcon field="fullName" /></div>
                </TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('attendanceRate')}>
                  <div className="flex items-center gap-2">Devam<SortIcon field="attendanceRate" /></div>
                </TableHead>
                <TableHead>Son Sınav</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openDrawer(<StudentDetailDrawer student={student} />)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-brand-primary text-white">
                          {student.fullName.split(' ').map((n) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-sm text-muted-foreground">{student.parentEmail || student.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{student.className}</Badge></TableCell>
                  <TableCell>{student.attendanceRate}%</TableCell>
                  <TableCell>{student.lastExamScore}</TableCell>
                  <TableCell>
                    <Badge className={normalizeText(student.status) === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDrawer(<StudentDetailDrawer student={student} />)}>
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

      <AddStudentDialog open={dialogOpen} onOpenChange={setDialogOpen} classes={classes} onCreated={handleCreated} />
    </motion.div>
  );
}
