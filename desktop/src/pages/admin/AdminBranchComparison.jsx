import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch, Users, GraduationCap, DollarSign, TrendingUp,
  BarChart3, MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchStudents, fetchStaff, fetchAccountingDashboard } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val || 0);
}

export default function AdminBranchComparison() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, staff, dashboard] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchStaff().catch(() => []),
        fetchAccountingDashboard().catch(() => ({})),
      ]);

      const studentList = Array.isArray(students) ? students : [];
      const staffList = Array.isArray(staff) ? staff : [];

      // Group by campus/branch
      const branchMap = new Map();
      for (const s of studentList) {
        const campus = s.campus || s.branch || 'Merkez Kampus';
        if (!branchMap.has(campus)) branchMap.set(campus, { name: campus, students: 0, staff: 0, teachers: 0 });
        branchMap.get(campus).students++;
      }
      for (const s of staffList) {
        const campus = s.campus || s.branch || 'Merkez Kampus';
        if (!branchMap.has(campus)) branchMap.set(campus, { name: campus, students: 0, staff: 0, teachers: 0 });
        branchMap.get(campus).staff++;
        if (String(s.primaryRole || '').toLowerCase() === 'teacher') {
          branchMap.get(campus).teachers++;
        }
      }

      const branchList = Array.from(branchMap.values()).map((b) => ({
        ...b,
        studentTeacherRatio: b.teachers > 0 ? Math.round(b.students / b.teachers) : '-',
        totalPersonnel: b.staff,
      }));

      setBranches(branchList);
    } catch (err) {
      setError(err.message || 'Veriler yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
          <h1 className="text-2xl font-bold">Sube Karsilastirmasi</h1>
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
              <p className="text-xs text-muted-foreground">Sube</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <GraduationCap className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totals.students}</p>
              <p className="text-xs text-muted-foreground">Toplam Ogrenci</p>
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
              <p className="text-xs text-muted-foreground">Ort. Ogrenci/Ogretmen</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Branch Comparison Bars */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Ogrenci Dagilimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {branches.map((b) => (
              <div key={b.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{b.name}</span>
                  <span className="text-muted-foreground">{b.students} ogrenci</span>
                </div>
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
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
            <CardTitle>Detayli Karsilastirma</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sube</TableHead>
                  <TableHead>Ogrenci</TableHead>
                  <TableHead>Ogretmen</TableHead>
                  <TableHead>Toplam Personel</TableHead>
                  <TableHead>Ogrenci/Ogretmen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Sube verisi bulunamadi.
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
