/**
 * Finans ekranlarının ortak dili. Tek doğruluk kaynağı burasıdır: yeni bir
 * finans ekranı da bu sözlüğü kullanır.
 *
 * Sürücü kursu finansı DrivingAsist ürününe taşındı; bu ürün yalnız okul ve
 * dershane kurumlarına hizmet verir.
 */

// Ek ücret kalemlerinin okul karşılıkları (backend kalem kodlarıyla birebir).
const SCHOOL_CHARGE_LABELS = {
  ExtraLesson: 'Ek ders / etüt ücreti',
  ExamFee: 'Sınav / deneme ücreti',
  FileFee: 'Kayıt ve evrak bedeli',
  ExtraService: 'Ek hizmet (servis, yemek, kitap)',
  PackageDifference: 'Program / sınıf farkı',
  Other: 'Diğer ücret',
};

const SCHOOL_VOCABULARY = Object.freeze({
  // Muhatap
  person: 'Öğrenci',
  personPlural: 'Öğrenci',
  personSearchHint: 'Ad, sınıf veya öğrenci no ara',
  // Sözleşme/ücret
  fee: 'Öğrenim Ücreti',
  netFee: 'Net Öğrenim Ücreti',
  feeDebt: 'Öğrenim Borcu',
  additionalChargeDebt: 'Ek Ücret Borcu',
  // Ek ücret kalemleri
  chargeLabels: SCHOOL_CHARGE_LABELS,
});

/**
 * Finans sözlüğü. Parametre, çağıran ekranların imzası değişmesin diye korunur.
 */
// eslint-disable-next-line no-unused-vars
export function getFinanceVocabulary(user) {
  return SCHOOL_VOCABULARY;
}

export function chargeLabel(vocabulary, type) {
  return vocabulary.chargeLabels[type] || vocabulary.chargeLabels.Other;
}
