import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ClipboardCheck, CreditCard, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchParentDashboardData } from '../../lib/api/dashboardData';

export default function ParentChildren() {
  const { user } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadChildren = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchParentDashboardData(user));
    } catch (err) {
      setError(err.message || 'Çocuklar görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-children-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Çocuklarım</h1>
        <p className="text-muted-foreground mt-1">Bağlı öğrenci kayıtlarının genel görünümü</p>
      </div>

      {error ? <ErrorBanner title="Çocuklar alınamadı" message={error} onRetry={loadChildren} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(data?.children || []).map((child) => (
          <Card key={child.username || child.fullName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-brand-primary" />{child.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-muted/40 p-4"><p className="text-sm text-muted-foreground">Sınıf</p><p className="font-semibold">{child.className || 'Tanımsız'}</p></div>
              <div className="rounded-xl bg-muted/40 p-4"><p className="text-sm text-muted-foreground">Devamsızlık</p><p className="font-semibold flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-green-600" />Takipte</p></div>
              <div className="rounded-xl bg-muted/40 p-4"><p className="text-sm text-muted-foreground">Finans</p><p className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-brand-accent" />Bağlı</p></div>
              <div className="md:col-span-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Akademik görünüm</p>
                    <p className="text-sm text-muted-foreground">İçerik, sınav ve ödev akışları bu öğrenci için masaüstünde aktif.</p>
                  </div>
                  <Badge variant="outline"><BookOpen className="h-3 w-3 mr-1" />Aktif</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
