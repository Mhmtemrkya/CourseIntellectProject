import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save, Briefcase, Copy, BusFront, Route, ShieldCheck,
  Users, UserCheck, GraduationCap, Mail, Phone, Pencil, Plus,
} from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import DirectoryPage from '../../components/directory/DirectoryPage';
import { assetUrl } from '../../lib/assetUrl';
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
  updateStaff,
  updateStaffAssignment,
  updateUserStatus,
  upsertPlatformConfiguration,
} from '../../lib/api/modules';
import { downloadCredentialsPdf } from '../../lib/credentialsPdf';
import { isUserPassive } from '../../lib/userStatus';
import { getInstitutionType } from '../../lib/institutionType';
import { mergeBranches, readSavedStaffBranches, staffBranchConfigurationPayload } from '../../lib/staffBranches';
import { StatusBadge } from '../../components/ui/status-badge';
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

// Sürücü kursu personeli: yalnız bu 4 rol seçilebilir. "Sekreter" backend'de ayrı
// bir rol değildir → Administrative'e eşlenir (sürücü izin sisteminde Secretary).
const drivingRoles = [
  { value: 'Teacher', label: 'Öğretmen' },
  { value: 'Secretary', label: 'Sekreter' },
  { value: 'BranchManager', label: 'Şube Müdürü' },
  { value: 'Administrative', label: 'İdari Personel' },
];
const drivingRoleValues = drivingRoles.map((r) => r.value);
// Sürücü kursunda öğretmen branşı yalnız bu ikisi olabilir. Direksiyon/teorik
// AYRIMI izin sisteminde DrivingInstructorProfile varlığından çözülür (Atama &
// Kurallar ekranı) — burada seçilen değer branş etiketi olarak saklanır.
const drivingTeacherBranches = ['Direksiyon Öğretmeni', 'Teorik Öğretmen'];

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
  campus: 'Merkez Kampüs',
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

const buildStaffEditForm = (staff = {}) => ({
  fullName: staff.fullName || '',
  phone: staff.phone || '',
  email: staff.email || '',
  departmentOrBranch: staff.departmentOrBranch || '',
  education: staff.education || '',
  campus: staff.campus || '',
  homeroomClass: staff.homeroomClass || '',
  assignedClasses: Array.isArray(staff.assignedClasses) ? staff.assignedClasses.join(', ') : '',
  maritalStatus: staff.maritalStatus || 'Bekar',
  childCount: Number(staff.childCount || 0),
  note: staff.note || '',
  photoUrl: staff.photoUrl || '',
  role: staff.role || '',
  branchId: staff.branchId || '',
  customRoleId: staff.customRoleId || '',
});

export default function AdminStaffRegistration({ mode = 'registration' }) {
  const { toast } = useToast();
  const { user } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const directoryMode = mode === 'directory';
  const tenantName = user?.tenant || '';
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [allStaff, setAllStaff] = useState([]);
  const [roleFilter, setRoleFilter] = useState(() => (
    directoryMode ? searchParams.get('role') || 'all' : 'Teacher'
  ));
  const [staffSearch, setStaffSearch] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [customRoles, setCustomRoles] = useState([]);
  const [savedBranches, setSavedBranches] = useState([]);
  const [editStaff, setEditStaff] = useState(null);
  const [editForm, setEditForm] = useState(() => buildStaffEditForm());
  const [editSaving, setEditSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState(null);
  const [isDrivingSchool, setIsDrivingSchool] = useState(false);

  // Kurum türü sürücü kursuysa rol ve öğretmen branşı listeleri daraltılır.
  useEffect(() => {
    getInstitutionType()
      .then((type) => setIsDrivingSchool(type === 'DrivingSchool'))
      .catch(() => {});
  }, []);

  // Sürücü kursuna geçilince, seçili rol izinli 4 rolden biri değilse Öğretmen'e çek.
  useEffect(() => {
    if (isDrivingSchool && !drivingRoleValues.includes(form.role)) {
      setForm((prev) => ({ ...prev, role: 'Teacher', departmentOrBranch: '' }));
    }
  }, [isDrivingSchool, form.role]);

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
            // Öğretmen dışındaki rollerde birim/branş elle sorulmaz; role göre
            // otomatik atanır. Yalnız öğretmende '' bırakılıp branş seçtirilir.
            departmentOrBranch: value === 'Cafeteria' ? 'Yemekhane'
              : value === 'ServiceDriver' ? 'Servis Şoförü'
              : value === 'BranchManager' ? 'Şube Yönetimi'
              : value === 'Secretary' ? 'Sekreter'
              : value === 'Administrative' ? 'İdari Personel'
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
    if (form.role === 'Teacher' && !form.departmentOrBranch.trim()) {
      toast({ title: 'Öğretmen için branş seçimi zorunludur.', variant: 'destructive' });
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
      // "Secretary" backend'de ayrı rol değil; Administrative olarak gider
      // (sürücü izin sisteminde bu rol Secretary'e çözülür).
      const backendRole = selectedCustomRole
        ? selectedCustomRole.baseRole
        : (form.role === 'ServiceDriver' || form.role === 'Secretary') ? 'Administrative' : form.role;
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
        : form.role === 'Secretary'
        ? 'Sekreter'
        : form.role === 'BranchManager'
        ? 'Şube Müdürü'
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
          extra: serviceSummary || (form.role === 'Teacher' && departmentOrBranch ? `Branş: ${departmentOrBranch}` : undefined),
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

  const canManageAssignments = String(user?.role || user?.primaryRole || '').toLowerCase() === 'admin';
  const selectedEditCustomRole = customRoles.find((role) => role.id === editForm.customRoleId);

  const handleEditStaff = async () => {
    if (!editStaff) return;
    if (!editForm.fullName.trim()) {
      toast({ title: 'Ad soyad zorunludur.', variant: 'destructive' });
      return;
    }
    if (editForm.phone && !isValidTrPhone(editForm.phone)) {
      toast({ title: 'Telefon +90 5XX XXX XX XX biçiminde olmalıdır.', variant: 'destructive' });
      return;
    }
    if (editForm.email && !isValidEmail(editForm.email)) {
      toast({ title: 'Geçerli bir e-posta adresi girin.', variant: 'destructive' });
      return;
    }
    if (canManageAssignments && editForm.role === 'BranchManager' && !editForm.branchId) {
      toast({ title: 'Şube müdürü için şube seçimi zorunludur.', variant: 'destructive' });
      return;
    }

    try {
      setEditSaving(true);
      await updateStaff(editStaff.id, {
        fullName: editForm.fullName.trim(),
        departmentOrBranch: editForm.departmentOrBranch.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        education: editForm.education.trim(),
        campus: editForm.campus.trim(),
        homeroomClass: editForm.homeroomClass.trim(),
        assignedClasses: editForm.assignedClasses.split(',').map((item) => item.trim()).filter(Boolean),
        maritalStatus: editForm.maritalStatus,
        childCount: Number(editForm.childCount || 0),
        note: editForm.note.trim(),
        photoUrl: editForm.photoUrl || '',
      });
      if (canManageAssignments) {
        await updateStaffAssignment(editStaff.userId, {
          role: editForm.role || null,
          branchId: editForm.branchId || null,
          customRoleId: editForm.customRoleId || null,
          clearCustomRole: !editForm.customRoleId,
          clearBranch: !editForm.branchId,
        });
      }
      toast({ title: 'Personel bilgileri güncellendi.' });
      setEditStaff(null);
      await loadRecent();
    } catch (err) {
      toast({ title: err.message || 'Personel güncellenemedi.', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const teacherBranches = mergeBranches(branchOptions, [
    ...savedBranches,
    ...allStaff.filter((item) => item.role === 'Teacher').map((item) => item.departmentOrBranch).filter(Boolean),
  ]);
  // Sürücü kursunda: rol listesi 4 rolle, öğretmen branşı 2 seçenekle sınırlanır.
  const roleOptions = isDrivingSchool ? drivingRoles : roles;
  const branchList = isDrivingSchool && form.role === 'Teacher'
    ? drivingTeacherBranches
    : form.role === 'Cafeteria'
      ? cafeteriaBranches
      : form.role === 'Administrative' || form.role === 'ServiceDriver' ? administrativeBranches : teacherBranches;
  const isServiceDriver = form.role === 'ServiceDriver';

  const staffFilterOptions = useMemo(() => {
    const custom = customRoles.map((role) => ({ value: `custom:${role.id}`, label: role.name }));
    return [{ value: 'all', label: 'Tüm Roller' }, ...staffRoleFilters, ...custom];
  }, [customRoles]);

  const selectedStaffRole = staffFilterOptions.find((role) => role.value === roleFilter) || staffFilterOptions[0];
  const filteredStaff = useMemo(() => {
    const normalize = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');
    const query = normalize(staffSearch);
    return allStaff.filter((staff) => {
      if (directoryMode && isUserPassive(staff.status)) return false;
      const matchesRole = roleFilter === 'all'
        || (roleFilter.startsWith('custom:')
          ? String(staff.customRoleId || '') === roleFilter.slice(7)
          : [staff.primaryRole, staff.role].some((value) => (
            normalize(value) === normalize(selectedStaffRole?.value)
            || normalize(value) === normalize(selectedStaffRole?.label)
          )));
      if (!matchesRole) return false;
      if (!query) return true;
      return [staff.fullName, staff.username, staff.departmentOrBranch, staff.campus]
        .some((value) => normalize(value).includes(query));
    });
  }, [allStaff, directoryMode, roleFilter, selectedStaffRole, staffSearch]);

  const handleStaffRoleChange = (value) => {
    setRoleFilter(value);
    if (!directoryMode) return;
    const next = new URLSearchParams(searchParams);
    next.set('role', value);
    setSearchParams(next, { replace: true });
  };

  const openRegistrationForm = () => navigate('/admin/staff-registration');

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

  // Kayıt ve dizin görünümü aynı diyalogları paylaşır (kimlik bilgisi + düzenleme).
  const dialogs = (
    <>
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

      {/* Personel bilgileri ve yöneticiye özel yetki ataması */}
      <Dialog open={!!editStaff} onOpenChange={(open) => !open && setEditStaff(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Personel Düzenle — {editStaff?.fullName}</DialogTitle>
            <DialogDescription>
              İletişim, görev ve özlük bilgilerini güncelleyin. Yetki ve şube ataması yalnızca kurum yöneticisi tarafından değiştirilebilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <section className="rounded-xl border p-4">
              <h3 className="mb-4 text-sm font-semibold">Personel bilgileri</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Personel fotoğrafı</Label>
                  <div className="mt-2">
                    <PhotoCapture value={editForm.photoUrl} onChange={(photoUrl) => setEditForm((f) => ({ ...f, photoUrl }))} folder="staff-photos" size={96} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ad Soyad *</Label>
                  <Input value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} maxLength={150} />
                </div>
                <div className="space-y-2">
                  <Label>Kullanıcı Adı</Label>
                  <Input value={editStaff?.username || ''} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>TC Kimlik No</Label>
                  <Input value={editStaff?.tcNo || ''} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>İşe Başlama Tarihi</Label>
                  <Input value={editStaff?.startDate || ''} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: maskTrPhone(e.target.value) }))} placeholder="+90 5XX XXX XX XX" inputMode="tel" maxLength={17} />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: maskEmail(e.target.value) }))} maxLength={254} />
                </div>
                <div className="space-y-2">
                  <Label>Birim / Branş</Label>
                  <Input value={editForm.departmentOrBranch} onChange={(e) => setEditForm((f) => ({ ...f, departmentOrBranch: e.target.value }))} maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label>Eğitim</Label>
                  <Input value={editForm.education} onChange={(e) => setEditForm((f) => ({ ...f, education: e.target.value }))} maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label>Kampüs</Label>
                  <Input value={editForm.campus} onChange={(e) => setEditForm((f) => ({ ...f, campus: e.target.value }))} maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label>Rehberlik Sınıfı</Label>
                  <Input value={editForm.homeroomClass} onChange={(e) => setEditForm((f) => ({ ...f, homeroomClass: e.target.value }))} maxLength={40} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Atanan Sınıflar</Label>
                  <Input value={editForm.assignedClasses} onChange={(e) => setEditForm((f) => ({ ...f, assignedClasses: e.target.value }))} placeholder="9-A, 10-B (virgülle ayırın)" />
                </div>
                <div className="space-y-2">
                  <Label>Medeni Durum</Label>
                  <Select value={editForm.maritalStatus} onValueChange={(value) => setEditForm((f) => ({ ...f, maritalStatus: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bekar">Bekar</SelectItem>
                      <SelectItem value="Evli">Evli</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Çocuk Sayısı</Label>
                  <Input type="number" min="0" max="20" value={editForm.childCount} onChange={(e) => setEditForm((f) => ({ ...f, childCount: maskPositiveInteger(e.target.value, 20) }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Not</Label>
                  <Textarea value={editForm.note} onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} rows={3} maxLength={1000} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="mb-4 flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-semibold">Rol, şube ve yetki profili</h3>
                  <p className="text-xs text-muted-foreground">
                    {canManageAssignments
                      ? 'Seçilen yetki profili personelin erişebileceği modül ve işlemleri belirler.'
                      : 'Bu alanı yalnızca kurum yöneticisi değiştirebilir.'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Temel Rol</Label>
                  <Select
                    disabled={!canManageAssignments}
                    value={editForm.role}
                    onValueChange={(value) => setEditForm((f) => ({ ...f, role: value, customRoleId: '' }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Rol seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Teacher">Öğretmen</SelectItem>
                      <SelectItem value="BranchManager">Şube Müdürü</SelectItem>
                      <SelectItem value="Administrative">İdari Personel</SelectItem>
                      <SelectItem value="Accounting">Muhasebe</SelectItem>
                      <SelectItem value="Cafeteria">Yemekhaneci</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Şube {editForm.role === 'BranchManager' ? '*' : ''}</Label>
                  <Select disabled={!canManageAssignments} value={editForm.branchId || '__none__'} onValueChange={(value) => setEditForm((f) => ({ ...f, branchId: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Şube seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kurum geneli</SelectItem>
                      {branches.filter((branch) => branch.isActive !== false).map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Yetki Profili</Label>
                  <Select
                    disabled={!canManageAssignments}
                    value={editForm.customRoleId || '__base__'}
                    onValueChange={(value) => {
                      const role = customRoles.find((item) => item.id === value);
                      setEditForm((formValue) => ({
                        ...formValue,
                        customRoleId: value === '__base__' ? '' : value,
                        role: role?.baseRole || formValue.role,
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Yetki profili seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__base__">Temel rol yetkileri</SelectItem>
                      {customRoles
                        .filter((role) => !editForm.role || role.baseRole === editForm.role)
                        .map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedEditCustomRole ? (
                <div className="mt-4 rounded-lg border bg-background p-3">
                  <p className="text-xs font-semibold">Verilecek erişimler</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedEditCustomRole.modules || []).map((module) => (
                      <span key={`module-${module}`} className="rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">{module}</span>
                    ))}
                    {(selectedEditCustomRole.permissions || []).map((permission) => (
                      <span key={`permission-${permission}`} className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">{permission}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setEditStaff(null)} disabled={editSaving}>Vazgeç</Button>
              <Button onClick={handleEditStaff} disabled={editSaving}>
                <Save className="mr-2 h-4 w-4" />
                {editSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  // ── Dizin görünümü: kurum genelindeki aktif kadro, ortak dizin iskeletiyle ──
  if (directoryMode && loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  if (directoryMode) {
    const activeStaff = allStaff.filter((staff) => !isUserPassive(staff.status));
    const teacherCount = activeStaff.filter((staff) => (
      String(staff.primaryRole || staff.role || '').toLowerCase() === 'teacher'
    )).length;
    const roleLabelOf = (staff) => {
      const custom = customRoles.find((role) => String(role.id) === String(staff.customRoleId || ''));
      const standard = staffRoleFilters.find((role) => (
        String(role.value).toLowerCase() === String(staff.primaryRole || staff.role || '').toLowerCase()
      ));
      return custom?.name || standard?.label || staff.primaryRole || staff.role || 'Rol belirtilmemiş';
    };

    return (
      <>
        <DirectoryPage
          testId="staff-directory-page"
          title="Personeller"
          subtitle={`${activeStaff.length} personeliniz bulunuyor`}
          rangeLabel={(from, to, total) => `${total} personelden ${from}-${to} arası gösteriliyor`}
          emptyTitle="Eşleşen personel bulunamadı"
          emptyDescription="Aramanıza uyan personel yok. Farklı bir rol deneyin."
          emptyIcon={Users}
          blankTitle="Henüz personel kaydınız yok"
          blankDescription="Öğretmen, sekreter ve yönetici hesapları buradan açılır; her personel kendi rolüyle giriş yapar."
          blankAction={{
            label: 'İlk personeli kaydet',
            icon: Plus,
            onClick: openRegistrationForm,
          }}
          actions={(
            <FeatureGate module="registrations" action="staff-register">
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={openRegistrationForm}>
                <Plus className="mr-2 h-4 w-4" /> Yeni Personel Kaydı
              </Button>
            </FeatureGate>
          )}
          stats={[
            { label: 'Toplam Personel', value: allStaff.length, caption: 'Tüm kadro', icon: Users, tint: 'bg-sky-500/12 text-sky-600' },
            { label: 'Aktif Personel', value: activeStaff.length, caption: 'Giriş yapabilir', icon: UserCheck, tint: 'bg-emerald-500/12 text-emerald-600' },
            { label: 'Öğretmen', value: teacherCount, caption: 'Akademik kadro', icon: GraduationCap, tint: 'bg-violet-500/12 text-violet-600' },
            { label: 'Rol Sayısı', value: Math.max(0, staffFilterOptions.length - 1), caption: 'Standart + özel rol', icon: ShieldCheck, tint: 'bg-amber-500/12 text-amber-600' },
          ]}
          search={{ value: staffSearch, onChange: setStaffSearch, placeholder: 'Personel ara...' }}
          filters={[{
            value: roleFilter,
            onChange: handleStaffRoleChange,
            placeholder: 'Tüm Roller',
            options: staffFilterOptions.filter((item) => item.value !== 'all'),
          }]}
          rows={filteredStaff}
          getRowId={(staff) => staff.id || staff.userId || staff.username}
          columns={[
            {
              key: 'fullName',
              label: 'Personel',
              sortable: true,
              width: 'minmax(0,2fr)',
              render: (staff) => (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {staff.photoUrl ? <AvatarImage src={assetUrl(staff.photoUrl)} alt={staff.fullName} className="object-cover" /> : null}
                    <AvatarFallback className="bg-brand-primary text-white">
                      {String(staff.fullName || '?').split(' ').map((part) => part[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{staff.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{staff.username || '—'}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'role',
              label: 'Rol',
              sortable: true,
              sortValue: roleLabelOf,
              width: 'minmax(0,1fr)',
              render: (staff) => <Badge className="bg-brand-accent text-white">{roleLabelOf(staff)}</Badge>,
            },
            {
              key: 'departmentOrBranch',
              label: 'Birim / Branş',
              sortable: true,
              width: 'minmax(0,1fr)',
              render: (staff) => (
                <div className="min-w-0">
                  <p className="truncate text-sm">{staff.departmentOrBranch || '—'}</p>
                  <p className="truncate text-xs text-muted-foreground">{staff.campus || ''}</p>
                </div>
              ),
            },
            {
              key: 'contact',
              label: 'İletişim',
              width: 'minmax(0,1.2fr)',
              render: (staff) => (
                <div className="min-w-0 text-xs">
                  <p className="flex items-center gap-1.5 font-medium"><Phone className="h-3 w-3 text-muted-foreground" />{staff.phone || '—'}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-muted-foreground"><Mail className="h-3 w-3" />{staff.email || '—'}</p>
                </div>
              ),
            },
            {
              key: 'startDate',
              label: 'Başlangıç',
              sortable: true,
              width: 'minmax(0,0.8fr)',
              render: (staff) => <span className="text-xs text-muted-foreground">{staff.startDate || '—'}</span>,
            },
            {
              key: 'status',
              label: 'Durum',
              sortable: true,
              width: 'minmax(0,0.7fr)',
              render: (staff) => (<StatusBadge status={isUserPassive(staff.status) ? 'Pasif' : 'Aktif'} />),
            },
          ]}
          rowActions={(staff) => (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="Düzenle"
                onClick={() => { setEditStaff(staff); setEditForm(buildStaffEditForm(staff)); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {/* Pasifleştirme listeden yapılabilmeli: hesap silinmez, girişi kapanır. */}
              <FeatureGate module="staff-hr" action="status">
                <UserStatusButton
                  iconOnly
                  isPassive={isUserPassive(staff.status)}
                  onToggle={async () => {
                    try {
                      await updateUserStatus(staff.username, isUserPassive(staff.status) ? 'Active' : 'Passive');
                      toast({ title: isUserPassive(staff.status) ? 'Kullanıcı aktifleştirildi.' : 'Kullanıcı pasife alındı (giriş yapamaz).' });
                      await loadRecent();
                    } catch (err) {
                      toast({ title: err.message || 'Durum değiştirilemedi.', variant: 'destructive' });
                    }
                  }}
                />
              </FeatureGate>
            </>
          )}
          cardRender={(staff) => (
            <div
              data-testid="staff-directory-card"
              className="flex w-full flex-col gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  {staff.photoUrl ? <AvatarImage src={assetUrl(staff.photoUrl)} alt={staff.fullName} className="object-cover" /> : null}
                  <AvatarFallback className="bg-brand-primary text-white">
                    {String(staff.fullName || '?').split(' ').map((part) => part[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{staff.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{roleLabelOf(staff)}</p>
                </div>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {staff.departmentOrBranch || staff.campus || 'Birim belirtilmemiş'}
              </p>
            </div>
          )}
        />
        {dialogs}
      </>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      data-testid={directoryMode ? 'staff-directory-page' : 'staff-registration-page'}
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl text-white">
          <Briefcase className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{directoryMode ? 'Aktif Personel' : 'Personel Kaydı'}</h1>
          <p className="text-sm text-muted-foreground">
            {directoryMode
              ? 'Kurum kadrosunu role göre filtreleyin, arayın ve yetkili olduğunuz kayıtları yönetin.'
              : 'Öğretmen, idari personel veya yemekhaneci kaydı. Kullanıcı adı ve geçici şifre otomatik üretilir.'}
          </p>
        </div>
        </div>
        {directoryMode ? <Button onClick={openRegistrationForm}>Yeni Personel Kaydı</Button> : null}
      </motion.div>

      <div className={directoryMode ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 gap-6 xl:grid-cols-3'}>
        {!directoryMode ? <motion.div variants={itemVariants} className="xl:col-span-2">
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
                      {roleOptions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                      {/* Sürücü kursunda yalnız 4 sabit rol; özel roller gizlenir. */}
                      {!isDrivingSchool && customRoles.map((r) => (
                        <SelectItem key={r.id} value={`custom:${r.id}`}>{r.name} (özel rol)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Branş yalnız öğretmene sorulur; diğer roller (idari personel dâhil)
                    birimi rolünden otomatik alır, ekstra seçim istenmez. */}
                {form.role === 'Teacher' ? (
                  <BranchSelectWithCreate
                    value={form.departmentOrBranch}
                    onValueChange={(value) => handleChange('departmentOrBranch', value)}
                    options={branchList}
                    onCreate={createTeacherBranch}
                    allowCreate={!isDrivingSchool}
                  />
                ) : null}
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
                {/* Sınıf öğretmenliği okula özgü; sürücü kursunda gösterilmez. */}
                {form.role === 'Teacher' && !isDrivingSchool && (
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
        </motion.div> : null}

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">{directoryMode ? 'Aktif Personel Listesi' : 'Role Göre Personel'}</CardTitle>
              {directoryMode ? <p className="text-sm text-muted-foreground">Kadroya rol filtresi ve personel araması uygulayın.</p> : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={directoryMode ? 'grid gap-3 md:grid-cols-[minmax(220px,0.7fr)_minmax(260px,1.3fr)]' : ''}>
                <Select value={roleFilter} onValueChange={handleStaffRoleChange}>
                  <SelectTrigger aria-label="Personel rolü"><SelectValue placeholder="Rol seçin" /></SelectTrigger>
                  <SelectContent>
                    {(directoryMode ? staffFilterOptions : staffFilterOptions.filter((item) => item.value !== 'all')).map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {directoryMode ? (
                  <Input
                    value={staffSearch}
                    onChange={(event) => setStaffSearch(event.target.value)}
                    placeholder="Ad, kullanıcı adı, birim veya kampüs ara"
                    aria-label="Personel ara"
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{selectedStaffRole?.label}</p>
                  <p className="mt-1 text-2xl font-bold">{filteredStaff.filter((staff) => !isUserPassive(staff.status)).length}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {directoryMode ? 'Yalnız aktif personel kayıtları gösterilir.' : `${selectedStaffRole?.label || 'Personel'} kadrosu`}
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-8"><LoadingDots /></div>
              ) : filteredStaff.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="font-medium">Eşleşen personel bulunamadı.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Rol filtresini veya arama metnini değiştirin.</p>
                </div>
              ) : (
                <div
                  className={directoryMode ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'max-h-[360px] space-y-2 overflow-y-auto'}
                  data-testid={directoryMode ? 'staff-directory-grid' : 'staff-registration-role-list'}
                >
                        {filteredStaff.map((s, i) => {
                          const isPassive = isUserPassive(s.status);
                          const customRole = customRoles.find((role) => String(role.id) === String(s.customRoleId || ''));
                          const standardRole = staffRoleFilters.find((role) => String(role.value).toLowerCase() === String(s.primaryRole || s.role || '').toLowerCase());
                          const roleLabel = customRole?.name || standardRole?.label || s.primaryRole || s.role || 'Rol belirtilmemiş';
                          return (
                            <div key={s.id || i} data-testid={directoryMode ? 'staff-directory-card' : 'staff-registration-role-card'} className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-foreground/10 bg-muted/30 p-3 ${isPassive ? 'opacity-60' : ''}`}>
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-600 dark:bg-purple-900/30">
                                {(s.fullName || '?')[0]}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{s.fullName}{isPassive ? ' · Pasif' : ''}</p>
                                <p className="truncate text-xs text-muted-foreground">{roleLabel} · {s.departmentOrBranch || s.campus || 'Birim belirtilmemiş'}</p>
                              </div>
                              <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 border-t border-foreground/10 pt-3">
                                <button
                                  type="button"
                                  className="h-8 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title="Personel bilgilerini ve yetkilerini düzenle"
                                  onClick={() => {
                                    setEditStaff(s);
                                    setEditForm(buildStaffEditForm(s));
                                  }}
                                >
                                  Düzenle
                                </button>
                                <FeatureGate module="staff-hr" action="status">
                                  <UserStatusButton
                                    isPassive={isPassive}
                                    className="h-8 px-3 text-xs"
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
                            </div>
                          );
                        })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {dialogs}
    </motion.div>
  );
}
