import { fetchDrivingSchoolStatus } from './api/modules';

// Kurum türü (PrivateSchool | DrivingSchool | ...). Oturum boyunca önbelleğe
// alınır; okunamazsa güvenli varsayılan "okul"dur (hiçbir şey gizlenmez).
let cached = null;
let pending = null;

export async function getInstitutionType() {
  if (cached) return cached;
  if (!pending) {
    pending = fetchDrivingSchoolStatus()
      .then((payload) => payload?.institutionType || 'PrivateSchool')
      .catch(() => 'PrivateSchool');
  }
  cached = await pending;
  return cached;
}

export function resetInstitutionTypeCache() {
  cached = null;
  pending = null;
}

// Sürücü kursunda anlamı olmayan, okula özgü menüler. Kurs yöneticisi bunları
// görmemeli — sürücü kursunda servis/yemekhane/nöbet/veli/kurs yönetimi yok ve
// sınav akışı kendi modülünde (Teorik Eğitim & Sınav) yürüyor.
//
// SİLMİYORUZ, yalnızca gizliyoruz: okul kurumları bu özellikleri kullanmaya
// devam ediyor.
const SCHOOL_ONLY_PATHS = [
  '/admin/service-tracking',
  '/driver',
  '/p/service',
  '/s/service',
  '/cafeteria',
  '/admin/duty-create',
  '/admin/duties',
  '/parents',
  '/p/children',
  '/admin/courses',
  // İçerik tarafında yalnızca "Sorular" kalır; okul sınav akışı gizlenir.
  '/exams',
  '/t/exams',
  '/s/exams',
  '/t/mock-exams',
  '/s/mock-exams',
  '/t/grade-entry',
  '/s/exam-results',
  '/t/student-exams',
  '/t/exam-workbench',
  '/p/exams',
];

export function isPathHiddenForInstitution(path, institutionType) {
  if (!path || institutionType !== 'DrivingSchool') return false;
  return SCHOOL_ONLY_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
