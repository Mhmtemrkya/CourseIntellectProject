import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Edit, Check, X, Users, Building2, HardDrive, 
  Zap, Crown, Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockPlans = [
  {
    id: 1,
    name: 'Starter',
    price: 10,
    priceUnit: 'kullanıcı/ay',
    description: 'Küçük kurumlar için ideal başlangıç paketi',
    color: 'bg-blue-500',
    icon: Package,
    features: {
      maxUsers: 100,
      maxBranches: 1,
      storage: '5 GB',
      apiCalls: '10K/ay',
      support: 'E-posta',
      customBranding: false,
      advancedReports: false,
      prioritySupport: false,
    },
    activeCount: 12,
  },
  {
    id: 2,
    name: 'Business',
    price: 8,
    priceUnit: 'kullanıcı/ay',
    description: 'Orta ölçekli kurumlar için kapsamlı çözüm',
    color: 'bg-brand-accent',
    icon: Zap,
    popular: true,
    features: {
      maxUsers: 500,
      maxBranches: 3,
      storage: '50 GB',
      apiCalls: '100K/ay',
      support: 'E-posta + Telefon',
      customBranding: true,
      advancedReports: true,
      prioritySupport: false,
    },
    activeCount: 28,
  },
  {
    id: 3,
    name: 'Enterprise',
    price: 6,
    priceUnit: 'kullanıcı/ay',
    description: 'Büyük kurumlar için tam özelleştirme',
    color: 'bg-brand-primary',
    icon: Crown,
    features: {
      maxUsers: 'Sınırsız',
      maxBranches: 'Sınırsız',
      storage: '500 GB',
      apiCalls: 'Sınırsız',
      support: '7/24 Destek',
      customBranding: true,
      advancedReports: true,
      prioritySupport: true,
    },
    activeCount: 8,
  },
];

const featureLabels = {
  maxUsers: { label: 'Maksimum Kullanıcı', icon: Users },
  maxBranches: { label: 'Şube Sayısı', icon: Building2 },
  storage: { label: 'Depolama', icon: HardDrive },
  apiCalls: { label: 'API Çağrısı', icon: Zap },
};

function EditPlanDialog({ open, onOpenChange, plan }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan Düzenle: {plan?.name}</DialogTitle>
          <DialogDescription>Plan özelliklerini ve limitlerini güncelleyin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan Adı</Label>
              <Input defaultValue={plan?.name} />
            </div>
            <div className="space-y-2">
              <Label>Fiyat (₺/kullanıcı)</Label>
              <Input type="number" defaultValue={plan?.price} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input defaultValue={plan?.description} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Maksimum Kullanıcı</Label>
              <Input defaultValue={plan?.features?.maxUsers} />
            </div>
            <div className="space-y-2">
              <Label>Şube Sayısı</Label>
              <Input defaultValue={plan?.features?.maxBranches} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Depolama</Label>
              <Input defaultValue={plan?.features?.storage} />
            </div>
            <div className="space-y-2">
              <Label>API Çağrısı</Label>
              <Input defaultValue={plan?.features?.apiCalls} />
            </div>
          </div>
          <div className="space-y-3">
            <Label>Özellikler</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Özel Markalama</span>
                <Switch defaultChecked={plan?.features?.customBranding} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Gelişmiş Raporlar</span>
                <Switch defaultChecked={plan?.features?.advancedReports} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Öncelikli Destek</span>
                <Switch defaultChecked={plan?.features?.prioritySupport} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90">Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Plans() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleEdit = (plan) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="sa-plans-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Paketler</h1>
          <p className="text-muted-foreground mt-1">Abonelik planlarını yönetin</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Yeni Plan
        </Button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockPlans.map((plan) => {
          const Icon = plan.icon;
          return (
            <motion.div key={plan.id} variants={itemVariants}>
              <Card className={`relative overflow-hidden hover:shadow-card-hover transition-all ${plan.popular ? 'ring-2 ring-brand-accent' : ''}`}>
                {plan.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-brand-accent">Popüler</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl ${plan.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">₺{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.priceUnit}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Limits */}
                  <div className="space-y-3">
                    {Object.entries(featureLabels).map(([key, { label, icon: FeatureIcon }]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FeatureIcon className="h-4 w-4" />
                          <span>{label}</span>
                        </div>
                        <span className="font-medium">{plan.features[key]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Boolean Features */}
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {plan.features.customBranding ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={plan.features.customBranding ? '' : 'text-muted-foreground'}>
                        Özel Markalama
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.features.advancedReports ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={plan.features.advancedReports ? '' : 'text-muted-foreground'}>
                        Gelişmiş Raporlar
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {plan.features.prioritySupport ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={plan.features.prioritySupport ? '' : 'text-muted-foreground'}>
                        Öncelikli Destek
                      </span>
                    </div>
                  </div>

                  {/* Stats & Actions */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-muted-foreground">Aktif Kurum</span>
                      <Badge variant="outline">{plan.activeCount}</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleEdit(plan)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Düzenle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <EditPlanDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        plan={selectedPlan}
      />
    </motion.div>
  );
}
