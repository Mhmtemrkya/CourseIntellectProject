import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import PhotoCapture from '../ui/photo-capture';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { updateStudent } from '../../lib/api/modules';
import { isValidEmail, isValidTcKimlik, isValidTrPhone, maskEmail, maskTcKimlik, maskTrPhone } from '../../lib/inputMasks';
import { errorMessage } from '../../lib/errors';
import type { StudentSummaryDto, UpdateStudentRequest } from '../../types/api/generated';

/** Öğrenciler sayfası ve İdari Kayıtlar'ın ortak öğrenci düzenleme penceresi. */
export function buildStudentUpdatePayload(student: Partial<StudentSummaryDto>): UpdateStudentRequest & { photoUrl: string } {
  return {
    fullName: student.fullName || '',
    tcNo: student.tcNo || '',
    className: student.className || '',
    currentSchool: student.currentSchool || '',
    schoolNumber: student.schoolNumber || '',
    birthDate: student.birthDate || '',
    programType: student.programType || '',
    parentName: student.parentName || '',
    parentPhone: student.parentPhone || '',
    parentEmail: student.parentEmail || '',
    address: student.address || '',
    note: student.note || '',
    photoUrl: student.photoUrl || '',
  };
}

export function EditStudentDialog({
  student, open, onOpenChange, classes, onUpdated,
}: {
  student: StudentSummaryDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: string[];
  onUpdated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => buildStudentUpdatePayload(student || {}));

  useEffect(() => {
    if (!student || !open) return;
    setForm({
      ...buildStudentUpdatePayload(student),
      birthDate: String(student.birthDate || '').slice(0, 10),
    });
  }, [open, student]);

  const handleSave = async () => {
    if (!student) return;
    if (!form.fullName.trim() || !form.parentName.trim()) {
      toast({ title: 'Eksik bilgi', description: 'Ad soyad ve veli adı zorunludur.', variant: 'destructive' });
      return;
    }
    if (!isValidTcKimlik(form.tcNo)) {
      toast({ title: 'Geçersiz TC kimlik no', description: 'Geçerli bir TC kimlik numarası girin (11 haneli).', variant: 'destructive' });
      return;
    }
    if (form.parentPhone && !isValidTrPhone(form.parentPhone)) {
      toast({ title: 'Geçersiz telefon', description: 'Veli telefonu +90 5XX XXX XX XX biçiminde olmalıdır.', variant: 'destructive' });
      return;
    }
    if (form.parentEmail && !isValidEmail(form.parentEmail)) {
      toast({ title: 'Geçersiz e-posta', description: 'Geçerli bir veli e-posta adresi girin.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await updateStudent(student.id, {
        ...form,
        fullName: form.fullName.trim(),
        tcNo: form.tcNo.trim(),
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        parentEmail: form.parentEmail.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
      });
      toast({ title: 'Öğrenci bilgileri güncellendi.' });
      onOpenChange(false);
      await onUpdated();
    } catch (err) {
      toast({ title: 'Öğrenci güncellenemedi', description: errorMessage(err, 'Tekrar deneyin.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const classOptions = [...new Set([form.className, ...classes].filter(Boolean))];

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Öğrenci Düzenle — {student?.fullName}</DialogTitle>
          <DialogDescription>Öğrenci, eğitim ve veli bilgilerini güncelleyin.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Öğrenci Fotoğrafı</Label>
            <PhotoCapture value={form.photoUrl} onChange={(photoUrl) => setForm((value) => ({ ...value, photoUrl }))} folder="student-photos" size={112} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Ad Soyad *</Label>
            <Input value={form.fullName} onChange={(e) => setForm((value) => ({ ...value, fullName: e.target.value }))} autoComplete="name" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>TC No *</Label>
            <Input value={form.tcNo} onChange={(e) => setForm((value) => ({ ...value, tcNo: maskTcKimlik(e.target.value) }))} inputMode="numeric" maxLength={11} />
          </div>
          <div className="space-y-2">
            <Label>Sınıf</Label>
            <Select value={form.className || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, className: value === '__none__' ? '' : value }))}>
              <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sınıf atanmamış</SelectItem>
                {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mevcut Okul</Label>
            <Input value={form.currentSchool} onChange={(e) => setForm((value) => ({ ...value, currentSchool: e.target.value }))} maxLength={150} />
          </div>
          <div className="space-y-2">
            <Label>Okul No</Label>
            <Input value={form.schoolNumber} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Doğum Tarihi</Label>
            <Input type="date" value={form.birthDate} onChange={(e) => setForm((value) => ({ ...value, birthDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Eğitim Seviyesi</Label>
            <Select value={form.programType || 'Lise'} onValueChange={(value) => setForm((current) => ({ ...current, programType: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ilkokul">İlkokul</SelectItem>
                <SelectItem value="Ortaokul">Ortaokul</SelectItem>
                <SelectItem value="Lise">Lise</SelectItem>
                <SelectItem value="Universite">Üniversite</SelectItem>
                <SelectItem value="Mezun">Mezun</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Veli Adı *</Label>
            <Input value={form.parentName} onChange={(e) => setForm((value) => ({ ...value, parentName: e.target.value }))} autoComplete="name" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Veli Telefon</Label>
            <Input value={form.parentPhone} onChange={(e) => setForm((value) => ({ ...value, parentPhone: maskTrPhone(e.target.value) }))} placeholder="+90 5XX XXX XX XX" inputMode="tel" maxLength={17} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Veli E-posta</Label>
            <Input type="email" value={form.parentEmail} onChange={(e) => setForm((value) => ({ ...value, parentEmail: maskEmail(e.target.value) }))} maxLength={254} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Adres</Label>
            <Input value={form.address} onChange={(e) => setForm((value) => ({ ...value, address: e.target.value }))} maxLength={300} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Not</Label>
            <Input value={form.note} onChange={(e) => setForm((value) => ({ ...value, note: e.target.value }))} maxLength={500} />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Vazgeç</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
