import { fetchDrivingSchoolStatus } from './api/modules';

// Kurum türü (PrivateSchool | DrivingSchool | ...). Oturum boyunca önbelleğe
// alınır; okunamazsa güvenli varsayılan "okul"dur (hiçbir şey gizlenmez).
let cached = null;
let pending = null;

export async function getInstitutionType() {
  if (cached) return cached;
  if (!pending) {
    // ÖNEMLİ: Yalnızca kesin (başarılı) bir sonucu kalıcı önbelleğe al. Eski
    // sürüm hatayı da cache'liyordu; login anında token henüz hazır değilken
    // çağrı bir kez 401 alırsa tüm oturum boyunca 'PrivateSchool'a saplanıyor,
    // institution filtresi devre dışı kalıp OKUL menüleri sürücü kursuna
    // sızıyordu. Artık geçici hatada birkaç kez yeniden denenir; kesin sonuç
    // alınamazsa güvenli varsayılan döner ama CACHE'LENMEZ (sonraki çağrı yine dener).
    pending = (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const payload = await fetchDrivingSchoolStatus();
          const type = payload?.institutionType;
          if (type) {
            cached = type;
            return type;
          }
        } catch {
          // geçici hata — yeniden dene
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return 'PrivateSchool';
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function resetInstitutionTypeCache() {
  cached = null;
  pending = null;
}

// Sürücü kursunda GÖRÜNECEK modül anahtarları (ALLOWLIST). Buraya yazılmayan her
// modül — okula özgü olan academics, students, teachers, classes, attendance,
// exams, parents, cafeteria, duties, kpi, operations, records, courses, library
// vb. — sürücü kursunda gizlenir.
//
// Neden allowlist? Denylist (gizlenecekleri saymak) kırılgan: yeni bir okul
// modülü eklendiğinde listeye yazmayı unutursak sürücü kursunda sızıyordu.
// Allowlist ile varsayılan "gizli"dir; bir modülün görünmesi bilinçli bir karar.
const DRIVING_SCHOOL_ALLOWED = new Set([
  // Sürücü kursunun kendi modülleri
  'driving-school', 'driving-registration', 'driving-operations', 'driving-scheduling',
  'driving-calendar', 'driving-lessons', 'driving-education', 'driving-graduation',
  'driving-fleet-compliance', 'driving-assignments', 'driving-reports',
  // Her kurum türünün ortak kullandığı altyapı
  'content',            // Konu Anlatımı (trafik/ilk yardım materyalleri)
  // Sürücü kursunda "Sorular" menüsü ehliyet SORU BANKASINA yönlenir (aşağıda
  // PremiumSidebar'da /questions → /t/question-bank olarak yeniden yazılır).
  // Bu yüzden yalnızca 'questions' anahtarı açık; 'question-bank' gizli tutulur
  // ki menüde iki "soru" girişi (Sorular + Soru Bankası) çift görünmesin.
  'questions',          // sürücü kursunda soru bankasına yönlenir
  'chat',               // mesajlaşma
  'notifications',      // bildirimler + duyurular
  'documents',          // belge merkezi
  // Finans ailesi (sürücü kursunda tam finans var)
  'finance', 'billing', 'collections', 'installments', 'late-payments',
  'discounts-scholarships', 'collection-calendar', 'reconciliation', 'bulk-actions',
  'overdue-rules', 'cash-report', 'ledger', 'finance-export', 'finance-audit-log',
  'finance-detail-hub', 'student-accounts', 'salary', 'payments', 'receipts', 'approvals',
  // Yönetim altyapısı
  'audit-log', 'role-management', 'rbac', 'password-reset', 'staff-hr', 'registrations',
  'customization', 'ai', 'ai-management', 'support',
]);

// Kurum türünden bağımsız her zaman görünür (profil, ayarlar, ve anahtarı
// olmayan/genel öğeler).
const ALWAYS_VISIBLE = new Set(['profile', 'system', '']);

// Modül anahtarı izinli OLSA DA sürücü kursunda gizlenecek tekil yollar.
// Gerekçe: "registrations" anahtarı hem personel/muhasebe kaydını (gerekli) hem
// okul öğrenci kaydını (gereksiz — sürücü kursunda "Yeni Kursiyer" var) taşıyor.
// Anahtar bunları ayıramadığı için yolu tek tek eliyoruz.
const DRIVING_SCHOOL_HIDDEN_PATHS = new Set([
  '/admin/student-registration',
]);

// Bir menü öğesi bu kurumda görünmeli mi? Yalnızca DrivingSchool'da filtreler;
// diğer kurum türlerinde her şey görünür.
export function isModuleAllowedForInstitution(moduleKey, institutionType, path) {
  if (institutionType !== 'DrivingSchool') return true;
  if (path && DRIVING_SCHOOL_HIDDEN_PATHS.has(path)) return false;
  const key = moduleKey || '';
  if (ALWAYS_VISIBLE.has(key)) return true;
  return DRIVING_SCHOOL_ALLOWED.has(key);
}
