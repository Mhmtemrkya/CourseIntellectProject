import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ReceiptText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAccountingDashboard, fetchStudents } from '../../lib/api/modules';

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .trim();
}

function downloadText(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ParentReceipts() {
  const { user } = useApp();
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [accounting, studentList] = await Promise.all([
        fetchAccountingDashboard(),
        fetchStudents().catch(() => []),
      ]);
      setDashboard(accounting);
      setStudents(studentList);
    } catch (err) {
      setError(err.message || 'Makbuz arşivi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  const childNames = useMemo(() => students
    .filter((student) => {
      const parentName = normalize(student.parentName || '');
      const userName = normalize(user?.name || '');
      const userUsername = normalize(user?.username || '');
      return parentName && (parentName.includes(userName) || parentName.includes(userUsername) || userName.includes(parentName));
    })
    .map((student) => normalize(student.fullName)), [students, user?.name, user?.username]);

  const receipts = useMemo(() => {
    const collections = dashboard?.collections || [];
    const filtered = childNames.length > 0
      ? collections.filter((item) => childNames.includes(normalize(item.name || '')))
      : collections;
    return filtered.slice(0, 12);
  }, [dashboard, childNames]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-receipts-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Makbuz Arşivi</h1>
        <p className="text-muted-foreground mt-1">Bağlı çocuklara ait ödeme kayıtlarından oluşan makbuz arşivi</p>
      </div>
      {error ? <ErrorBanner title="Makbuz arşivi alınamadı" message={error} onRetry={loadReceipts} /> : null}
      <div className="grid gap-4">
        {receipts.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><ReceiptText className="h-5 w-5 text-brand-primary" />{item.name || 'Ödeme kaydı'}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">₺{Number(item.amount || 0).toLocaleString('tr-TR')}</p>
                <p className="text-sm text-muted-foreground">{item.date || item.createdAt || 'Tarih yok'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedReceipt(item)}>Detay</Button>
                <Button variant="outline" onClick={() => downloadText(`makbuz-${item.id}.txt`, JSON.stringify(item, null, 2))}>
                  <Download className="h-4 w-4 mr-2" />
                  İndir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Makbuz Detayı</DialogTitle>
          </DialogHeader>
          {selectedReceipt ? (
            <div className="space-y-3 text-sm">
              <div><p className="font-medium">Kayıt</p><p className="text-muted-foreground">{selectedReceipt.name || 'Ödeme kaydı'}</p></div>
              <div><p className="font-medium">Tutar</p><p className="text-muted-foreground">₺{Number(selectedReceipt.amount || 0).toLocaleString('tr-TR')}</p></div>
              <div><p className="font-medium">Tarih</p><p className="text-muted-foreground">{selectedReceipt.date || selectedReceipt.createdAt || 'Tarih yok'}</p></div>
              <div><p className="font-medium">Not</p><p className="text-muted-foreground">{selectedReceipt.note || 'Not yok'}</p></div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
