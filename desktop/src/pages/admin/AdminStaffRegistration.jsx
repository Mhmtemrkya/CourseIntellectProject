import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Briefcase, Copy, BusFront, Route } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FeatureGate } from '../../components/FeatureGate';
import { UserStatusButton } from '../../components/UserStatusButton';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import PhotoCapture from '../../components/ui/photo-capture';
import { BranchSelectWithCreate } from '../../components/registration/BranchSelectWithCreate';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  createServiceDriver,
  createServiceRoute,
  createServiceVehicle,
  createStaff,
  deleteServiceDriver,
  deleteServiceVehicle,
  deleteStaffUser,
  fetchCustomRoles,
  fetchStaff,
  fetchOrgUnits,
  fetchPlatformConfigurations,
  updateStaffAssignment,
  updateUserStatus,
  upsertPlatformConfiguration,
} from '../../lib/api/modules';
import { downloadCredentialsPdf } from '../../lib/credentialsPdf';
import { isUserPassive } from '../../lib/userStatus';
import { mergeBranches, readSavedStaffBranches, staffBranchConfigurationPayload } from '../../lib/staffBranches';
import {
  isValidEmail,
  isValidTcKimlik,
  isValidTrPhone,
  isValidTrPlate,
  maskEmail,
  maskPositiveInteger,
  maskTcKimlik,
  maskTrPhone,
  maskTrPlate,
  maskVehicleNumber,
} from '../../lib/inputMasks';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const roles = [
  { value: 'Teacher', label: 'Öğretmen' },
  { value: 'BranchManager', label: 'Şube Müdürü' },
  { value: 'Administrative', label: 'İdari Personel' },
  { value: 'ServiceDriver', label: 'Servis Şoförü' },
  { value: 'Cafeteria', label: 'Yemekhaneci' },
];

const staffRoleFilters = [
  ...roles,
  { value: 'Accounting', label: 'Muhasebe' },
];

const branchOptions = [
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji',
  'Türkçe / Edebiyat', 'Tarih', 'Coğrafya',
  'İngilizce', 'Almanca', 'Fransızca', 'İspanyolca',
  'Felsefe', 'Din Kültürü ve Ahlak Bilgisi',
  'Beden Eğitimi', 'Müzik', 'Görsel Sanatlar',
  'Bilgisayar / Bilişim Teknolojileri',
  'Matematik (İlkokul)', 'Türkçe (İlkokul)',
  'Hayat Bilgisi', 'Fen Bilimleri',
  'Sosyal Bilgiler', 'Rehberlik',
  'Okul Öncesi', 'Özel Eğitim',
  'Diğer',
];

const administrativeBranches = [
  'Öğrenci İşleri', 'İnsan Kaynakları', 'Halkla İlişkiler', 'Kalite', 'Bilgi İşlem', 'Servis Şoförü', 'Diğer',
];

const cafeteriaBranches = ['Yemekhane'];

const emptyForm = {
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
  maritalStatus: 'Bekar',
  childCount: 0,
  note: '',
  photoUrl: '',
  licenseNumber: '',
  vehicleNumber: '',
  plateNumber: '',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleCapacity: '15',
  routeName: '',
  routeType: 'Morning',
  routeStartTime: '07:30',
  routeEndTime: '09:00',
};

export default function AdminStaffRegistration() {
  const { toast } = useToast();
  const { user } = useApp();
  const tenantName = user?.tenant || '';
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [allStaff, setAllStaff] = useState([]);
  const [roleFilter, setRoleFilter] = useState('Teacher');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [customRoles, setCustomRoles] = useState([]);
  const [savedBranches, setSavedBranches] = useState([]);
  const [editStaff, setEditStaff] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', branchId: '', customRoleId: '' });
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState(null);

  const loadRecent = useCallback(async () => {
    try {
      setLoading(true);
      const [data, orgUnits, customRoleList, branchConfigurations] = await Promise.all([
        fetchStaff().catch(() => []),
        fetchOrgUnits().catch(() => []),
        fetchCustomRoles().catch(() => []),
        fetchPlatformConfigurations('staff-branches').catch(() => []),
      ]);
      setAllStaff(Array.isArray(data) ? data : []);
      setCustomRoles(Array.isArray(customRoleList) ? customRoleList : []);
      setSavedBranches(readSavedStaffBranches(branchConfigurations));
      const all = Array.isArray(orgUnits) ? orgUnits : [];
      // Pasif birimler seçim listesinde görünmez.
      const activeUnits = all.filter((u) => u.isActive !== false);
      const branchUnits = activeUnits.filter((u) => ['şube', 'sube', 'kampüs', 'kampus'].includes(String(u.unitType || '').toLowerCase()));
      setBranches(branchUnits.length > 0 ? branchUnits : activeUnits);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'role'
        ? {
            departmentOrBranch: value === 'Cafeteria' ? 'Yemekhane'
              : value === 'ServiceDriver' ? 'Servis Şoförü'
              : value === 'BranchManager' ? 'Şube Yönetimi'
              : String(value).startsWith('custom:')
                ? (customRoles.find((r) => `custom:${r.id}` === value)?.name || 'Özel Rol')
                : '',
          }
        : {}),
    }));
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) {
      toast({ title: 'Ad soyad zorunludur.', variant: 'destructive' });
      return;
    }
    if (!form.departmentOrBranch.trim()) {
      toast({ title: 'Branş / bölüm seçimi zorunludur.', variant: 'destructive' });
      return;
    }
    if (form.role === 'BranchManager' && !branchId) {
      toast({ title: 'Şube müdürü için şube seçimi zorunludur.', variant: 'destructive' });
      return;
    }
    if (!isValidTcKimlik(form.tcNo)) {
      toast({ title: 'Geçerli bir TC kimlik numarası girin (11 haneli).', variant: 'destructive' });
      return;
    }
    if (form.phone && !isValidTrPhone(form.phone)) {
      toast({ title: 'Telefon +90 5XX XXX XX XX biçiminde olmalıdır.', variant: 'destructive' });
      return;
    }
    if (form.email && !isValidEmail(form.email)) {
      toast({ title: 'Geçerli bir e-posta adresi girin.', variant: 'destructive' });
      return;
    }
    if (form.role === 'ServiceDriver') {
      const capacity = Number(form.vehicleCapacity);
      const email = form.email.trim();
      if (!form.phone.trim() || !email || !isValidEmail(email) || !form.licenseNumber.trim() || !isValidTrPlate(form.plateNumber) || !Number.isInteger(capacity) || capacity < 2) {
        toast({ title: 'Servis şoförü için telefon, geçerli e-posta, ehliyet, plaka ve geçerli kapasite zorunludur.', variant: 'destructive' });
        return;
      }
      if (!form.routeName.trim()) {
        toast({ title: 'Şoförün kullanacağı rota adı zorunludur.', variant: 'destructive' });
        return;
      }
    }
    let createdStaffUserId = null;
    let createdVehicleId = null;
    let createdDriverId = null;
    try {
      setSaving(true);
      // Özel rol: taban rolü backend'e, kimliği customRoleId olarak gider.
      const selectedCustomRole = form.role.startsWith('custom:')
        ? customRoles.find((r) => `custom:${r.id}` === form.role)
        : null;
      const backendRole = selectedCustomRole
        ? selectedCustomRole.baseRole
        : form.role === 'ServiceDriver' ? 'Administrative' : form.role;
      const departmentOrBranch = form.role === 'ServiceDriver' ? 'Servis Şoförü' : form.departmentOrBranch;
      const response = await createStaff({
        fullName: form.fullName.trim(),
        role: backendRole,
        departmentOrBranch,
        tcNo: form.tcNo.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        education: form.education.trim(),
        startDate: form.startDate.trim(),
        campus: form.campus.trim(),
        homeroomClass: form.homeroomClass.trim(),
        assignedClasses: [],
        maritalStatus: form.maritalStatus,
        childCount: Number(form.childCount || 0),
        note: form.note.trim(),
        photoUrl: form.photoUrl || null,
        branchId: branchId || undefined,
        customRoleId: selectedCustomRole?.id || undefined,
      }, branchId || undefined);
      createdStaffUserId = response?.userId || null;
      let serviceSummary = '';
      if (form.role === 'ServiceDriver') {
        if (!response?.userId) {
          throw new Error('Şoför kullanıcısı oluşturuldu fakat kullanıcı ID alınamadı.');
        }
        const vehicle = await createServiceVehicle({
          vehicleNumber: form.vehicleNumber.trim(),
          plateNumber: form.plateNumber.trim(),
          brand: form.vehicleBrand.trim(),
          model: form.vehicleModel.trim(),
          capacity: Number(form.vehicleCapacity),
          isActive: true,
        });
        createdVehicleId = vehicle?.id || null;
        const driver = await createServiceDriver({
          userId: response?.userId,
          phoneNumber: form.phone.trim(),
          licenseNumber: form.licenseNumber.trim(),
          isActive: true,
        });
        createdDriverId = driver?.id || null;
        const route = await createServiceRoute({
          name: form.routeName.trim(),
          routeType: form.routeType,
          vehicleId: vehicle?.id,
          driverId: driver?.id,
          startTime: form.routeStartTime,
          endTime: form.routeEndTime,
          isActive: false,
        });
        serviceSummary = `E-posta: ${form.email.trim()} • Araç: ${form.plateNumber.trim()}${form.vehicleNumber.trim() ? ` / No: ${form.vehicleNumber.trim()}` : ''} • Rota: ${route?.name || form.routeName.trim()}`;
      }
      const roleLabel = form.role === 'ServiceDriver'
        ? 'Servis Şoförü'
        : form.role === 'Cafeteria'
        ? 'Yemekhaneci'
        : form.role === 'Administrative' ? 'İdari Personel' : 'Öğretmen';
      const fullName = response?.fullName || form.fullName.trim();
      setCredentials({
        fullName,
        username: response?.username,
        password: response?.password,
        roleLabel,
        branch: departmentOrBranch,
        email: form.email.trim(),
        serviceSummary,
      });
      try {
        await downloadCredentialsPdf({
          tenantName,
          fullName,
          role: roleLabel,
          username: response?.username,
          temporaryPassword: response?.password,
          extra: serviceSummary || (departmentOrBranch ? `Brans: ${departmentOrBranch}` : undefined),
        });
      } catch (pdfErr) {
        console.warn('PDF üretimi başarısız', pdfErr);
      }
      toast({
        title: form.role === 'ServiceDriver' ? 'Servis şoförü, aracı ve rotası oluşturuldu.' : 'Personel başarıyla kaydedildi.',
        description: 'Bilgiler PDF olarak indirildi.',
      });
      setForm(emptyForm);
      loadRecent();
    } catch (err) {
      if (form.role === 'ServiceDriver') {
        await rollbackServiceDriverRegistration({
          driverId: createdDriverId,
          vehicleId: createdVehicleId,
          staffUserId: createdStaffUserId,
        });
      }
      const message = err?.response?.data?.message || err?.message || 'Kayıt başarısız.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    const text = `Kullanıcı adı: ${credentials.username}${credentials.email ? `\nE-posta ile giriş: ${credentials.email}` : ''}\nGeçici Şifre: ${credentials.password}`;
    await navigator.clipboard?.writeText(text);
    toast({ title: 'Giriş bilgileri kopyalandı.' });
  };

  const downloadAgain = async () => {
    if (!credentials) return;
    await downloadCredentialsPdf({
      tenantName,
      fullName: credentials.fullName,
      role: credentials.roleLabel,
      username: credentials.username,
      temporaryPassword: credentials.password,
      extra: credentials.serviceSummary || (credentials.branch ? `Brans: ${credentials.branch}` : undefined),
    });
  };

  const rollbackServiceDriverRegistration = async ({ driverId, vehicleId, staffUserId }) => {
    try {
      if (driverId) await deleteServiceDriver(driverId);
    } catch (error) {
      console.warn('Şoför rollback başarısız', error);
    }
    try {
      if (vehicleId) await deleteServiceVehicle(vehicleId);
    } catch (error) {
      console.warn('Araç rollback başarısız', error);
    }
    try {
      if (staffUserId) await deleteStaffUser(staffUserId);
    } catch (error) {
      console.warn('Personel rollback başarısız', error);
    }
  };

  const teacherBranches = mergeBranches(branchOptions, [
    ...savedBranches,
    ...allStaff.filter((item) => item.role === 'Teacher').map((item) => item.departmentOrBranch).filter(Boolean),
  ]);
  const branchList = form.role === 'Cafeteria'
    ? cafeteriaBranches
    : form.role === 'Administrative' || form.role === 'ServiceDriver' ? administrativeBranches : teacherBranches;
  const isServiceDriver = form.role === 'ServiceDriver';

  const createTeacherBranch = async (name) => {
    const next = mergeBranches(savedBranches, [name]);
    try {
      await upsertPlatformConfiguration(staffBranchConfigurationPayload(next));
      setSavedBranches(next);
      toast({ title: 'Branş oluşturuldu', description: `${name} seçim listesine eklendi.` });
      return true;
    } catch (err) {
      toast({ title: 'Branş oluşturulamadı', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl text-white">
          <Briefcase className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Personel Kaydı</h1>
          <p className="text-sm text-muted-foreground">
            Öğretmen, idari personel veya yemekhaneci kaydı. Kullanıcı adı ve geçici şifre otomatik üretilir.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personel Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Personel Fotoğrafı</Label>
                  <div className="mt-1">
                    <PhotoCapture value={form.photoUrl} onChange={(photoUrl) => handleChange('photoUrl', photoUrl)} folder="staff-photos" size={112} />
                  </div>
                </div>
                <div>
                  <Label>Ad Soyad *</Label>
                  <Input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Örn: Ayşe Demir" autoComplete="name" maxLength={100} />
                </div>
                <div>
                  <Label>Rol *</Label>
                  <Select value={form.role} onValueChange={(v) => handleChange('role', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                      {customRoles.map((r) => (
                        <SelectItem key={r.id} value={`custom:${r.id}`}>{r.name} (özel rol)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.role === 'Teacher' ? (
                  <BranchSelectWithCreate
                    value={form.departmentOrBranch}
                    onValueChange={(value) => handleChange('departmentOrBranch', value)}
                    options={branchList}
                    onCreate={createTeacherBranch}
                  />
                ) : (
                  <div>
                    <Label>Birim *</Label>
                    <Select value={form.departmentOrBranch} onValueChange={(value) => handleChange('departmentOrBranch', value)}>
                      <SelectTrigger><SelectValue placeholder="Birim seçin..." /></SelectTrigger>
                      <SelectContent>{branchList.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {branches.length > 0 ? (
                  <div>
                    <Label>Şube</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger><SelectValue placeholder="Şube seçin" /></SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div>
                  <Label>TC Kimlik No *</Label>
                  <Input maxLength={11} value={form.tcNo} onChange={(e) => handleChange('tcNo', maskTcKimlik(e.target.value))} inputMode="numeric" pattern="[0-9]{11}" placeholder="11 haneli kimlik no" />
                </div>
                <div>
                  <Label>Telefon</Label>
                  <Input value={form.phone} onChange={(e) => handleChange('phone', maskTrPhone(e.target.value))} inputMode="tel" autoComplete="tel" maxLength={17} placeholder="+90 5XX XXX XX XX" />
                </div>
                <div>
                  <Label>{isServiceDriver ? 'Giriş E-postası *' : 'E-posta'}</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', maskEmail(e.target.value))}
                    placeholder="sofor@kurum.com"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={254}
                  />
                </div>
                <div>
                  <Label>Eğitim</Label>
                  <Input value={form.education} onChange={(e) => handleChange('education', e.target.value)} />
                </div>
                <div>
                  <Label>İşe Başlama Tarihi</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} />
                </div>
                <div>
                  <Label>Kampüs</Label>
                  <Input value={form.campus} onChange={(e) => handleChange('campus', e.target.value)} />
                </div>
                {form.role === 'Teacher' && (
                  <div>
                    <Label>Sınıf Öğretmenliği (opsiyonel)</Label>
                    <Input value={form.homeroomClass} onChange={(e) => handleChange('homeroomClass', e.target.value)} placeholder="Örn: 9-A" />
                  </div>
                )}
                {isServiceDriver && (
                  <div>
                    <Label>Ehliyet No / Sınıfı *</Label>
                    <Input value={form.licenseNumber} onChange={(e) => handleChange('licenseNumber', e.target.value)} placeholder="D sınıfı / belge no" />
                  </div>
                )}
                <div>
                  <Label>Medeni Durum</Label>
                  <Select value={form.maritalStatus} onValueChange={(v) => handleChange('maritalStatus', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bekar">Bekar</SelectItem>
                      <SelectItem value="Evli">Evli</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Çocuk Sayısı</Label>
                  <Input value={form.childCount} onChange={(e) => handleChange('childCount', maskPositiveInteger(e.target.value, 2))} inputMode="numeric" maxLength={2} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Notlar</Label>
                <Textarea value={form.note} onChange={(e) => handleChange('note', e.target.value)} placeholder="Ek bilgiler..." rows={2} />
              </div>

              {isServiceDriver && (
                <div className="space-y-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500">
                      <BusFront className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Servis Aracı ve Rota Bilgileri</h3>
                      <p className="text-sm text-muted-foreground">
                        Şoför hesabı, aracı ve ilk rotası tek kayıt akışında oluşturulur.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Araç No</Label>
                      <Input value={form.vehicleNumber} onChange={(e) => handleChange('vehicleNumber', maskVehicleNumber(e.target.value))} placeholder="Örn: S-01" maxLength={12} />
                    </div>
                    <div>
                      <Label>Plaka *</Label>
                      <Input value={form.plateNumber} onChange={(e) => handleChange('plateNumber', maskTrPlate(e.target.value))} placeholder="34 ABC 123" maxLength={11} />
                    </div>
                    <div>
                      <Label>Marka</Label>
                      <Input value={form.vehicleBrand} onChange={(e) => handleChange('vehicleBrand', e.target.value)} placeholder="Mercedes" />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input value={form.vehicleModel} onChange={(e) => handleChange('vehicleModel', e.target.value)} placeholder="Sprinter" />
                    </div>
                    <div>
                      <Label>Kapasite *</Label>
                      <Input value={form.vehicleCapacity} onChange={(e) => handleChange('vehicleCapacity', maskPositiveInteger(e.target.value, 2))} inputMode="numeric" maxLength={2} placeholder="15" />
                    </div>
                    <div>
                      <Label>Rota Adı *</Label>
                      <Input value={form.routeName} onChange={(e) => handleChange('routeName', e.target.value)} placeholder="Sabah 1. Bölge" />
                    </div>
                    <div>
                      <Label>Rota Tipi</Label>
                      <Select value={form.routeType} onValueChange={(v) => handleChange('routeType', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Morning">Sabah</SelectItem>
                          <SelectItem value="Evening">Akşam</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rota Saati</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="time" value={form.routeStartTime} onChange={(e) => handleChange('routeStartTime', e.target.value)} />
                        <Input type="time" value={form.routeEndTime} onChange={(e) => handleChange('routeEndTime', e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border bg-background/40 p-3 text-sm text-muted-foreground">
                    <Route className="h-4 w-4 text-orange-500" />
                    Rota pasif oluşturulur. Durak ve öğrenci ataması tamamlanınca servis yönetiminden aktifleştirilir.
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                <strong>Bilgi:</strong> Personel kaydedildiğinde kurum domain'inizi kullanan bir kullanıcı adı
                ve güçlü bir geçici şifre otomatik üretilir. Personel ilk girişinde şifresini değiştirmek zorundadır.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setForm(emptyForm)}>Temizle</Button>
                <FeatureGate module="registrations" action="staff-register">
                  <Button onClick={handleSubmit} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" /> {saving ? 'Kaydediliyor...' : isServiceDriver ? 'Şoför, Araç ve Rota Kaydet' : 'Personeli Kaydet'}
                  </Button>
                </FeatureGate>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Göre Personel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger><SelectValue placeholder="Rol seçin" /></SelectTrigger>
                <SelectContent>
                  {staffRoleFilters.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>

              {(() => {
                const selectedRole = staffRoleFilters.find((r) => r.value === roleFilter);
                const norm = (v) => String(v || '').trim().toLocaleLowerCase('tr');
                const filtered = allStaff.filter((s) => {
                  const role = norm(s.primaryRole || s.role);
                  return role === norm(selectedRole?.value) || role === norm(selectedRole?.label);
                });
                return (
                  <>
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">{selectedRole?.label} Sayısı</p>
                      <p className="mt-1 text-2xl font-bold">{filtered.length}</p>
                    </div>
                    {loading ? (
                      <div className="flex justify-center py-4"><LoadingDots /></div>
                    ) : filtered.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Bu rolde kayıtlı personel yok.</p>
                    ) : (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto">
                        {filtered.map((s, i) => {
                          const isPassive = isUserPassive(s.status);
                          return (
                            <div key={s.id || i} className={`flex items-center gap-3 p-2 rounded-lg bg-muted/40 ${isPassive ? 'opacity-60' : ''}`}>
                              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-600">
                                {(s.fullName || '?')[0]}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{s.fullName}{isPassive ? ' · Pasif' : ''}</p>
                                <p className="text-xs text-muted-foreground">{s.departmentOrBranch || selectedRole?.label}</p>
                              </div>
                              <button
                                type="button"
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                title="Rol / şube / özel rol atamasını düzenle"
                                onClick={() => {
                                  setEditStaff(s);
                                  setEditForm({ role: s.role || '', branchId: '', customRoleId: '' });
                                }}
                              >
                                Atama
                              </button>
                              <FeatureGate module="staff-hr" action="status">
                                <UserStatusButton
                                  isPassive={isPassive}
                                  className="h-8 px-2 text-xs"
                                  onToggle={async () => {
                                    try {
                                      await updateUserStatus(s.username, isPassive ? 'Active' : 'Passive');
                                      toast({ title: isPassive ? 'Kullanıcı aktifleştirildi.' : 'Kullanıcı pasife alındı (giriş yapamaz).' });
                                      await loadRecent();
                                    } catch (err) {
                                      toast({ title: err.message || 'Durum değiştirilemedi.', variant: 'destructive' });
                                    }
                                  }}
                                />
                              </FeatureGate>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{credentials?.roleLabel} Oluşturuldu</DialogTitle>
            <DialogDescription>
              Bilgiler PDF olarak indirildi. Kaybederseniz aşağıdan tekrar indirebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Ad Soyad</p>
              <p className="mt-1 font-medium">{credentials?.fullName || '-'}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Kullanıcı Adı</p>
              <p className="mt-1 font-mono text-base font-bold break-all">{credentials?.username || '-'}</p>
            </div>
            {credentials?.email ? (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">E-posta ile giriş</p>
                <p className="mt-1 font-mono text-base font-bold break-all">{credentials.email}</p>
              </div>
            ) : null}
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Geçici Şifre</p>
              <p className="mt-1 font-mono text-base font-bold tracking-wider">{credentials?.password || '-'}</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">İlk girişte değiştirilmesi zorunludur.</p>
            </div>
            {credentials?.serviceSummary ? (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Servis Bağlantısı</p>
                <p className="mt-1 font-medium">{credentials.serviceSummary}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentials(null)}>Kapat</Button>
            <Button variant="outline" onClick={copyCredentials}>
              <Copy className="mr-2 h-4 w-4" /> Kopyala
            </Button>
            <Button onClick={downloadAgain}>PDF İndir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Var olan personelin rol / şube / özel rol atamasını düzenleme */}
      <Dialog open={!!editStaff} onOpenChange={(open) => !open && setEditStaff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atama Düzenle — {editStaff?.fullName}</DialogTitle>
            <DialogDescription>Rol, şube ve özel rol ataması; kaydedince görünürlük kapsamı da güncellenir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rol</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value, customRoleId: '' }))}
              >
                <option value="">— Değiştirme —</option>
                <option value="Teacher">Öğretmen</option>
                <option value="BranchManager">Şube Müdürü</option>
                <option value="Administrative">İdari Personel</option>
                <option value="Accounting">Muhasebe</option>
                <option value="Cafeteria">Yemekhaneci</option>
              </select>
            </div>
            <div>
              <Label>Şube {editForm.role === 'BranchManager' ? '(zorunlu)' : '(opsiyonel)'}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editForm.branchId}
                onChange={(e) => setEditForm((f) => ({ ...f, branchId: e.target.value }))}
              >
                <option value="">— Değiştirme —</option>
                {branches.filter((b) => b.isActive !== false).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Özel rol</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editForm.customRoleId}
                onChange={(e) => setEditForm((f) => ({ ...f, customRoleId: e.target.value }))}
              >
                <option value="">— Değiştirme —</option>
                <option value="__clear__">(özel rolü kaldır)</option>
                {customRoles
                  .filter((r) => !editForm.role || r.baseRole === editForm.role)
                  .map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditStaff(null)}>Vazgeç</Button>
              <Button
                onClick={async () => {
                  try {
                    await updateStaffAssignment(editStaff.userId, {
                      role: editForm.role || null,
                      branchId: editForm.branchId || null,
                      customRoleId: editForm.customRoleId && editForm.customRoleId !== '__clear__' ? editForm.customRoleId : null,
                      clearCustomRole: editForm.customRoleId === '__clear__',
                    });
                    toast({ title: 'Atama güncellendi.' });
                    setEditStaff(null);
                    await loadRecent();
                  } catch (err) { toast({ title: err.message || 'Atama güncellenemedi.', variant: 'destructive' }); }
                }}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
