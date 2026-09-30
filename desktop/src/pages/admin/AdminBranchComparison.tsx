import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  GitBranch, Users, GraduationCap,
  BarChart3, MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchStudents, fetchStaff} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';

interface BranchCounts {
  name: string;
  students: number;
  staff: number;
  teachers: number;
}

type BranchRow = BranchCounts & { studentTeacherRatio: number | string; totalPersonnel: number };

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function AdminBranchComparison() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Muhasebe panosu eskiden de yükleniyor ama hiç kullanılmıyordu (gereksiz istek).
      const [students, staff] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchStaff().catch(() => []),
      ]);

      const studentList = Array.isArray(students) ? students : [];
      const staffList = Array.isArray(staff) ? staff : [];

      // Group by campus/branch
      const branchMap = new Map<string, BranchCounts>();
      const bucketFor = (campus: string): BranchCounts => {
        const existing = branchMap.get(campus);
        if (existing) return existing;
        const created: BranchCounts = { name: campus, students: 0, staff: 0, teachers: 0 };
        branchMap.set(campus, created);
        return created;
      };
      // Öğrenci özetinde kampüs/şube alanı yok; öğrenciler şimdilik tek grupta sayılır.
      if (studentList.length > 0) {
        bucketFor('Merkez Kampüs').students += studentList.length;
      }
      for (const s of staffList) {
        const bucket = bucketFor(s.campus || 'Merkez Kampüs');
        bucket.staff += 1;
        // Personel DTO'sunda rol `role` alanındadır (primaryRole yok; öğretmen sayısı hep 0 çıkıyordu).
        if (String(s.role || '').toLowerCase() === 'teacher') {
          bucket.teachers += 1;
        }
      }

      const branchList = Array.from(branchMap.values()).map((b): BranchRow => ({
        ...b,
        studentTeacherRatio: b.teachers > 0 ? Math.round(b.students / b.teachers) : '-',
        totalPersonnel: b.staff,
      }));

      setBranches(branchList);
    } catch (err) {
      setError(errorMessage(err, 'Veriler yuklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const totals = useMemo(() => ({
    students: branches.reduce((s, b) => s + b.students, 0),
    staff: branches.reduce((s, b) => s + b.staff, 0),
    teachers: branches.reduce((s, b) => s + b.teachers, 0),
  }), [branches]);

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl text-white">
          <GitBranch className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Şube Karşılaştırması</h1>
          <p className="text-sm text-muted-foreground">{branches.length} sube analizi</p>
        </div>
      </motion.div>

      {/* Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <MapPin className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{branches.length}</p>
              <p className="text-xs text-muted-foreground">Şube</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <GraduationCap className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totals.students}</p>
              <p className="text-xs text-muted-foreground">Toplam Öğrenci</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{totals.staff}</p>
              <p className="text-xs text-muted-foreground">Toplam Personel</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <BarChart3 className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{totals.teachers > 0 ? Math.round(totals.students / totals.teachers) : '-'}:1</p>
              <p className="text-xs text-muted-foreground">Ort. Öğrenci/Öğretmen</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Branch Comparison Bars */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Öğrenci Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {branches.map((b) => (
              <div key={b.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-muted-foreground">{b.students} öğrenci</span>
                </div>
                <div className="ci-chart-track h-4 rounded-full overflow-hidden">
                  <div
                    className="ci-chart-fill h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all"
                    style={{ width: `${totals.students > 0 ? (b.students / totals.students) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Comparison Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Detaylı Karşılaştırma</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şube</TableHead>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Öğretmen</TableHead>
                  <TableHead>Toplam Personel</TableHead>
                  <TableHead>Öğrenci/Öğretmen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Şube verisi bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((b) => (
                    <TableRow key={b.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {b.name}
                        </div>
                      </TableCell>
                      <TableCell>{b.students}</TableCell>
                      <TableCell>{b.teachers}</TableCell>
                      <TableCell>{b.totalPersonnel}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.studentTeacherRatio}:1</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
