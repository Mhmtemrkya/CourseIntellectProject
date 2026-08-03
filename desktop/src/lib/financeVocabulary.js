/**
 * Finans modülü OKUL ve SÜRÜCÜ KURSU tarafından ortak kullanılır; ekranların
 * dili ve bazı kalemleri kurum türüne göre değişir.
 *
 * Sürücü kursuna özgü alanlar (direksiyon sınav ücreti, ek direksiyon dersi,
 * paket/vites farkı) okulda GÖRÜNMEZ — okul yöneticisi "direksiyon sınav
 * ücreti" gibi kendisini ilgilendirmeyen bir kalemle karşılaşmamalı.
 *
 * Tek doğruluk kaynağı burasıdır: yeni bir finans ekranı da bu sözlüğü kullanır.
 */

export function isDrivingSchoolUser(user) {
  return String(user?.institutionType || '') === 'DrivingSchool'
    || user?.drivingSchoolModuleEnabled === true;
}

// Sürücü kursunun paket dışı ücret kalemleri (DrivingChargeType ile birebir).
const DRIVING_CHARGE_LABELS = {
  ExtraLesson: 'Ek direksiyon dersi',
  ExamFee: 'Sınav ücreti',
  FileFee: 'Dosya masrafı',
  ExtraService: 'Ek hizmet',
  PackageDifference: 'Paket / vites farkı',
  Other: 'Diğer ücret',
};

// Okulda aynı kalem kodları okul karşılıklarıyla gösterilir; "ek direksiyon
// dersi" yerine etüt/kurs, "paket farkı" yerine sınıf/program farkı.
const SCHOOL_CHARGE_LABELS = {
  ExtraLesson: 'Ek ders / etüt ücreti',
  ExamFee: 'Sınav / deneme ücreti',
  FileFee: 'Kayıt ve evrak bedeli',
  ExtraService: 'Ek hizmet (servis, yemek, kitap)',
  PackageDifference: 'Program / sınıf farkı',
  Other: 'Diğer ücret',
};

/**
 * Kurum türüne göre finans sözlüğü.
 * @param {object} user oturum açan kullanıcı (AppContext'ten)
 */
export function getFinanceVocabulary(user) {
  const driving = isDrivingSchoolUser(user);
  return {
    isDrivingSchool: driving,
    // Muhatap
    person: driving ? 'Kursiyer' : 'Öğrenci',
    personPlural: driving ? 'Kursiyer' : 'Öğrenci',
    personSearchHint: driving ? 'Ad veya kursiyer no ara' : 'Ad, sınıf veya öğrenci no ara',
    // Sözleşme/ücret
    fee: driving ? 'Kurs Ücreti' : 'Öğrenim Ücreti',
    netFee: driving ? 'Net Kurs Ücreti' : 'Net Öğrenim Ücreti',
    feeDebt: driving ? 'Kurs Borcu' : 'Öğrenim Borcu',
    additionalChargeDebt: 'Ek Ücret Borcu',
    // Ek ücret kalemleri
    chargeLabels: driving ? DRIVING_CHARGE_LABELS : SCHOOL_CHARGE_LABELS,
    // Yalnız sürücü kursunda anlamlı alanlar
    showDrivingExamFee: driving,
  };
}

export function chargeLabel(vocabulary, type) {
  return vocabulary.chargeLabels[type] || vocabulary.chargeLabels.Other;
}
