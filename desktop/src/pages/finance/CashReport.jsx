import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt, TrendingUp, TrendingDown, CreditCard, Banknote, Building2,
  Calendar, Download, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAccountingDashboard } from '../../lib/api/modules';

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

function parseAmount(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export default function CashReport() {
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('month');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchAccountingDashboard();
      setDashboard(data || {});
    } catch (err) {
      setError(err.message || 'Rapor yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const collections = useMemo(() => {
    const list = dashboard?.recentCollections || dashboard?.collections || [];
    return Array.isArray(list) ? list : [];
  }, [dashboard]);

  const cashTotal = useMemo(
    () => collections.filter((c) => String(c.method || c.paymentMethod || c.type || '').toLowerCase().includes('nakit')).reduce((s, c) => s + parseAmount(c.amount), 0),
    [collections],
  );

  const cardTotal = useMemo(
    () => collections.filter((c) => String(c.method || c.paymentMethod || c.type || '').toLowerCase().includes('kart') || String(c.method || c.paymentMethod || c.type || '').toLowerCase().includes('credit')).reduce((s, c) => s + parseAmount(c.amount), 0),
    [collections],
  );

  const bankTotal = useMemo(
    () => collections.filter((c) => String(c.method || c.paymentMethod || c.type || '').toLowerCase().includes('havale') || String(c.method || c.paymentMethod || c.type || '').toLowerCase().includes('eft') || String(c.method || c.paymentMethod || c.type || '').toLowerCase().includes('bank')).reduce((s, c) => s + parseAmount(c.amount), 0),
    [collections],
  );

  const grandTotal = cashTotal + cardTotal + bankTotal;

  if (loading) return <div className="flex justify-center py-20"><LoadingDots /></div>;
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Kasa Raporu</h1>
            <p className="text-sm text-muted-foreground">Nakit, kart ve havale akisi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Gunluk</SelectItem>
              <SelectItem value="week">Haftalik</SelectItem>
              <SelectItem value="month">Aylik</SelectItem>
              <SelectItem value="year">Yillik</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatCurrency(grandTotal)}</p>
              <p className="text-xs text-muted-foreground">Toplam Tahsilat</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Banknote className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatCurrency(cashTotal)}</p>
              <p className="text-xs text-muted-foreground">Nakit</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatCurrency(cardTotal)}</p>
              <p className="text-xs text-muted-foreground">Kredi Karti</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatCurrency(bankTotal)}</p>
              <p className="text-xs text-muted-foreground">Havale/EFT</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Payment Breakdown Bar */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Odeme Yontemi Dagilimi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              {grandTotal > 0 && (
                <>
                  <div className="bg-emerald-500 transition-all" style={{ width: `${(cashTotal / grandTotal) * 100}%` }} title={`Nakit: ${formatCurrency(cashTotal)}`} />
                  <div className="bg-blue-500 transition-all" style={{ width: `${(cardTotal / grandTotal) * 100}%` }} title={`Kart: ${formatCurrency(cardTotal)}`} />
                  <div className="bg-purple-500 transition-all" style={{ width: `${(bankTotal / grandTotal) * 100}%` }} title={`Havale: ${formatCurrency(bankTotal)}`} />
                </>
              )}
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span>Nakit ({grandTotal ? Math.round((cashTotal / grandTotal) * 100) : 0}%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span>Kart ({grandTotal ? Math.round((cardTotal / grandTotal) * 100) : 0}%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span>Havale ({grandTotal ? Math.round((bankTotal / grandTotal) * 100) : 0}%)</span></div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Son Islemler</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ogrenci</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Yontem</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Henuz islem kaydi yok.
                    </TableCell>
                  </TableRow>
                ) : (
                  collections.slice(0, 20).map((c, idx) => (
                    <TableRow key={c.id || idx}>
                      <TableCell className="font-medium">{c.name || c.studentName || c.description || '-'}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(parseAmount(c.amount))}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.method || c.paymentMethod || c.type || 'Belirtilmemis'}</Badge>
                      </TableCell>
                      <TableCell>{c.time || (c.date ? new Date(c.date).toLocaleDateString('tr-TR') : '-')}</TableCell>
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
