import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Percent, Gift, Users, Search, Plus,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createAccountingBenefit, fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export default function DiscountsScholarships() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('discounts');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    studentId: '',
    name: '',
    rate: '15',
    totalAmount: '120000',
    criteria: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, accounting] = await Promise.all([
        fetchStudents(),
        fetchAccountingDashboard(),
      ]);
      setStudents(studentList);
      setDashboard(accounting);
      setProfileForm((prev) => ({
        ...prev,
        studentId: prev.studentId || (studentList[0] ? String(studentList[0].id) : ''),
      }));
    } catch (err) {
      setError(err.message || 'İndirim ve burs verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const benefits = useMemo(() => (dashboard?.benefits || []).map((item) => ({
    id: item.id,
    name: item.studentName,
    username: item.studentUsername,
    className: item.className,
    type: item.benefitType,
    title: item.title,
    rate: Number(String(item.rate || '0').replace('%', '').replace(',', '.')) || 0,
    totalAmount: parseMoney(item.totalAmount),
    netAmount: parseMoney(item.netAmount),
    status: item.status || 'Onay Bekliyor',
    note: item.note || '',
    createdAtLabel: item.createdAtLabel || '',
  })), [dashboard]);

  const discounts = useMemo(() => {
    return benefits.filter((item) => item.type === 'İndirim');
  }, [benefits]);

  const scholarships = useMemo(() => {
    return benefits.filter((item) => item.type === 'Burs');
  }, [benefits]);

  const filteredStudents = useMemo(() => benefits.filter((student) => (
    `${student.name} ${student.className} ${student.type || ''} ${student.title || ''}`.toLowerCase().includes(search.toLowerCase())
  )), [benefits, search]);

  const stats = {
    totalDiscounts: discounts.length,
    totalScholarships: scholarships.length,
    studentsWithDiscount: benefits.length,
    totalDiscountAmount: discounts.reduce((sum, item) => sum + item.totalAmount, 0),
  };

  const handleCreateProfile = async () => {
    try {
      const selectedStudent = students.find((item) => String(item.id) === profileForm.studentId) || students[0];
      if (!selectedStudent) {
        toast({ title: 'Öğrenci seçin', description: 'İndirim veya burs için bir öğrenci seçmeniz gerekiyor.', variant: 'destructive' });
        return;
      }
      await createAccountingBenefit({
        studentName: selectedStudent.fullName,
        studentUsername: selectedStudent.username,
        className: selectedStudent.className,
        benefitType: activeTab === 'scholarships' ? 'Burs' : 'İndirim',
        title: profileForm.name.trim() || (activeTab === 'scholarships' ? 'Yeni Burs Tanımı' : 'Yeni İndirim Tanımı'),
        rate: profileForm.rate,
        totalAmount: profileForm.totalAmount,
        note: profileForm.criteria.trim(),
      });
      setDialogOpen(false);
      setProfileForm({
        studentId: students[0] ? String(students[0].id) : '',
        name: '',
        rate: '15',
        totalAmount: '120000',
        criteria: '',
      });
      await loadData();
      toast({ title: `${activeTab === 'scholarships' ? 'Burs' : 'İndirim'} kaydı oluşturuldu`, description: 'Kayıt backend üzerinde kalıcı olarak saklandı.' });
    } catch (err) {
      toast({
        title: 'Kayıt oluşturulamadı',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">İndirim ve burs verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="finance-discounts-page"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
        <div className="flex-1 rounded-3xl bg-gradient-to-br from-rose-500 via-fuchsia-600 to-indigo-700 p-6 text-white shadow-xl">
          <h1 className="text-3xl font-bold font-heading">İndirim & Burs</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">Gerçek öğrenci kayıtları ve backend üzerinde saklanan burs/indirim profilleri tek ekranda yönetilir.</p>
        </div>
        <Card className="xl:w-[320px]">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Yeni Profil</p>
              <p className="mt-2 text-sm text-muted-foreground">İndirim veya burs tanımı oluşturup backend’e kalıcı olarak kaydedin.</p>
            </div>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Tanım
            </Button>
          </CardContent>
        </Card>
      </div>

      {error ? <ErrorBanner title="İndirim ve burs verileri alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          [stats.totalDiscounts, 'Aktif İndirim', Percent, 'text-brand-primary'],
          [stats.totalScholarships, 'Aktif Burs', Gift, 'text-brand-accent'],
          [stats.studentsWithDiscount, 'Yararlanan Öğrenci', Users, 'text-green-600'],
          [`₺${stats.totalDiscountAmount.toLocaleString('tr-TR')}`, 'Toplam İndirim', Percent, 'text-blue-600'],
        ].map(([value, label, Icon, color]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted/70">
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="discounts" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="discounts">İndirimler</TabsTrigger>
          <TabsTrigger value="scholarships">Burslar</TabsTrigger>
          <TabsTrigger value="students">Öğrenci Listesi</TabsTrigger>
        </TabsList>

        <TabsContent value="discounts" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İndirim Adı</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Değer</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Toplam</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.map((discount) => (
                    <TableRow key={discount.id}>
                      <TableCell className="font-medium">{discount.title}</TableCell>
                      <TableCell><Badge variant="outline">{discount.className || '-'}</Badge></TableCell>
                      <TableCell>%{discount.rate}</TableCell>
                      <TableCell>{discount.name}</TableCell>
                      <TableCell>₺{discount.totalAmount.toLocaleString('tr-TR')}</TableCell>
                      <TableCell><Badge className="bg-amber-100 text-amber-700">{discount.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scholarships" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Burs Adı</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Karşılama</TableHead>
                    <TableHead>Kriter</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scholarships.map((scholarship) => (
                    <TableRow key={scholarship.id}>
                      <TableCell className="font-medium">{scholarship.title}</TableCell>
                      <TableCell><Badge variant="outline">{scholarship.className || '-'}</Badge></TableCell>
                      <TableCell>%{scholarship.rate}</TableCell>
                      <TableCell>{scholarship.note || '-'}</TableCell>
                      <TableCell>{scholarship.name}</TableCell>
                      <TableCell><Badge className="bg-amber-100 text-amber-700">{scholarship.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Öğrenci ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 max-w-sm"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>İndirim</TableHead>
                    <TableHead>İndirim Tutarı</TableHead>
                    <TableHead>Burs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.className}</TableCell>
                      <TableCell>
                        {student.type === 'İndirim' ? <Badge variant="outline">{student.title}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {student.type === 'İndirim' ? <span className="text-green-600">₺{student.netAmount.toLocaleString('tr-TR')}</span> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {student.type === 'Burs' ? <Badge className="bg-brand-accent/10 text-brand-accent">{student.title}</Badge> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeTab === 'scholarships' ? 'Yeni Burs Tanımı' : 'Yeni İndirim Tanımı'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Öğrenci</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileForm.studentId}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, studentId: e.target.value }))}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{student.fullName} • {student.className}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tanım Adı</Label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Örn: Kardeş İndirimi" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{activeTab === 'scholarships' ? 'Kapsam (%)' : 'Oran (%)'}</Label>
                <Input value={profileForm.rate} onChange={(e) => setProfileForm((prev) => ({ ...prev, rate: e.target.value }))} type="number" />
              </div>
              <div className="space-y-2">
                <Label>Toplam Tutar</Label>
                <Input value={profileForm.totalAmount} onChange={(e) => setProfileForm((prev) => ({ ...prev, totalAmount: e.target.value }))} type="number" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kriter / Açıklama</Label>
              <Input value={profileForm.criteria} onChange={(e) => setProfileForm((prev) => ({ ...prev, criteria: e.target.value }))} placeholder="Örn: Erken kayıt + kardeş desteği" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleCreateProfile}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
