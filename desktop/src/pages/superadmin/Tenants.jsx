import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Building2, Users } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchPlatformTenants } from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setTenants(await fetchPlatformTenants());
    } catch (err) {
      setError(err.message || 'Kurum görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const matchesSearch = tenant.name.toLowerCase().includes(search.toLowerCase()) || tenant.email.toLowerCase().includes(search.toLowerCase());
      const matchesPlan = planFilter === 'all' || tenant.plan === planFilter;
      const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [tenants, search, planFilter, statusFilter]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="sa-tenants-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Kurumlar</h1>
        <p className="text-muted-foreground mt-1">{tenants.length || 0} aktif kurum görünümü</p>
      </div>

      {error ? <ErrorBanner title="Kurumlar alınamadı" message={error} onRetry={loadTenants} /> : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Kurum ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Planlar</SelectItem>
                <SelectItem value="Starter">Starter</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="trial">İzleme</SelectItem>
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
                <TableHead>Kurum</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Şube</TableHead>
                <TableHead>Aylık Tutar</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-28">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.map((tenant) => (
                <TableRow key={tenant.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-primary/10"><Building2 className="h-5 w-5 text-brand-primary" /></div>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{tenant.plan}</Badge></TableCell>
                  <TableCell><div className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" /><span>{tenant.users}</span></div></TableCell>
                  <TableCell>{tenant.branches}</TableCell>
                  <TableCell><span className="font-medium">₺{Number(tenant.monthlyFee || 0).toLocaleString('tr-TR')}</span></TableCell>
                  <TableCell><Badge className={tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{tenant.status === 'active' ? 'Aktif' : 'İzleme'}</Badge></TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTenant(tenant)}>Detay</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kurum Detayı</DialogTitle>
          </DialogHeader>
          {selectedTenant ? (
            <div className="space-y-3 text-sm">
              <div><p className="font-medium">Kurum</p><p className="text-muted-foreground">{selectedTenant.name}</p></div>
              <div><p className="font-medium">İletişim</p><p className="text-muted-foreground">{selectedTenant.email}</p></div>
              <div><p className="font-medium">Plan</p><p className="text-muted-foreground">{selectedTenant.plan}</p></div>
              <div><p className="font-medium">Kullanıcı / Şube</p><p className="text-muted-foreground">{selectedTenant.users} kullanıcı • {selectedTenant.branches} şube</p></div>
              <div><p className="font-medium">Aylık Tutar</p><p className="text-muted-foreground">₺{Number(selectedTenant.monthlyFee || 0).toLocaleString('tr-TR')}</p></div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
