/**
 * Finans ekranlarının ortak dili. Tek doğruluk kaynağı burasıdır: yeni bir
 * finans ekranı da bu sözlüğü kullanır.
 *
 * Sürücü kursu finansı DrivingAsist ürününe taşındı; bu ürün yalnız okul ve
 * dershane kurumlarına hizmet verir.
 */

import type { UserLike } from '../types/session';

export type ChargeType = 'ExtraLesson' | 'ExamFee' | 'FileFee' | 'ExtraService' | 'PackageDifference' | 'Other';
type ChargeLabels = Readonly<Record<ChargeType, string>>;

export interface FinanceVocabulary {
  person: string;
  personPlural: string;
  personSearchHint: string;
  fee: string;
  netFee: string;
  feeDebt: string;
  additionalChargeDebt: string;
  chargeLabels: ChargeLabels;
}

// Ek ücret kalemlerinin okul karşılıkları (backend kalem kodlarıyla birebir).
const SCHOOL_CHARGE_LABELS: ChargeLabels = {
  ExtraLesson: 'Ek ders / etüt ücreti',
  ExamFee: 'Sınav / deneme ücreti',
  FileFee: 'Kayıt ve evrak bedeli',
  ExtraService: 'Ek hizmet (servis, yemek, kitap)',
  PackageDifference: 'Program / sınıf farkı',
  Other: 'Diğer ücret',
};

const SCHOOL_VOCABULARY: Readonly<FinanceVocabulary> = Object.freeze({
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getFinanceVocabulary(user?: UserLike | null): Readonly<FinanceVocabulary> {
  return SCHOOL_VOCABULARY;
}

function isChargeType(labels: ChargeLabels, type: string): type is ChargeType {
  return Object.prototype.hasOwnProperty.call(labels, type);
}

export function chargeLabel(vocabulary: Readonly<FinanceVocabulary>, type: string | null | undefined): string {
  const key = String(type ?? '');
  return (isChargeType(vocabulary.chargeLabels, key) ? vocabulary.chargeLabels[key] : '') || vocabulary.chargeLabels.Other;
}
