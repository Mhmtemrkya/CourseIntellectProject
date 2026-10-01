// Kurum kaydı formunun alan maskeleri ve doğrulayıcıları. Her alan etiketinin
// amacına göre biçimlenir; backend (InstitutionFieldRules / SchoolRegistrationRules)
// aynı kuralları sunucuda da uygular — burası yalnız ilk savunma hattıdır.

// Türkiye'nin 81 ili (backend TurkishProvinces ile birebir).
export const TURKISH_PROVINCES: readonly string[] = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya",
  "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
  "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne",
  "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane",
  "Hakkâri", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu",
  "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya",
  "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu",
  "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
  "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray",
  "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır",
  "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce",
]

const digitsOnly = (value: string): string => value.replace(/\D/g, "")

export function maskDigits(value: string, maxLength?: number): string {
  const d = digitsOnly(value)
  return maxLength ? d.slice(0, maxLength) : d
}

/** TC kimlik: yalnız rakam, en fazla 11 hane. */
export const maskTc = (value: string) => maskDigits(value, 11)

/** MEB kurum kodu: yalnız rakam, en fazla 8 hane. */
export const maskMebCode = (value: string) => maskDigits(value, 8)

/** Vergi no: yalnız rakam, en fazla 11 hane (10=VKN, 11=şahıs TCKN). */
export const maskTaxNumber = (value: string) => maskDigits(value, 11)

/** Posta kodu: yalnız rakam, 5 hane. */
export const maskPostalCode = (value: string) => maskDigits(value, 5)

/** TR telefon: +90 5xx xxx xx xx biçimi (10 hane). */
export function maskTrPhone(value: string): string {
  let d = digitsOnly(value)
  if (d.startsWith("90")) d = d.slice(2)
  if (d.startsWith("0")) d = d.slice(1)
  d = d.slice(0, 10)
  if (!d) return ""
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean)
  return `+90 ${parts.join(" ")}`
}

/** Son 10 haneyi döndürür (gönderim ve doğrulama için). */
export const phoneDigits = (value: string) => {
  let d = digitsOnly(value)
  if (d.startsWith("90")) d = d.slice(2)
  if (d.startsWith("0")) d = d.slice(1)
  return d.slice(0, 10)
}

export function isValidTrMobile(value: string): boolean {
  const d = phoneDigits(value)
  return d.length === 10 && d.startsWith("5")
}

/** Sabit ya da cep, 10 hane yeterli (kurum sabit telefonu için). */
export function isValidTrPhone(value: string): boolean {
  return phoneDigits(value).length === 10
}

export function isValidEmail(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v.length >= 6 && v.length <= 180 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v)
}

export function isValidWebsite(value: string): boolean {
  const v = value.trim()
  return v.length > 0 && v.length <= 200 && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i.test(v)
}

/** Resmi TCKN checksum doğrulaması (10. ve 11. hane). */
export function isValidTc(value: string): boolean {
  const d = digitsOnly(value)
  if (d.length !== 11 || d[0] === "0") return false
  const n = d.split("").map(Number)
  const odd = n[0] + n[2] + n[4] + n[6] + n[8]
  const even = n[1] + n[3] + n[5] + n[7]
  let tenth = (odd * 7 - even) % 10
  if (tenth < 0) tenth += 10
  if (tenth !== n[9]) return false
  return (odd + even + n[9]) % 10 === n[10]
}

/** Vergi no: 10 hane (VKN) ya da 11 hane geçerli TCKN. */
export function isValidTaxNumber(value: string): boolean {
  const d = digitsOnly(value)
  if (d.length === 10) return true
  if (d.length === 11) return isValidTc(d)
  return false
}

export function isKnownProvince(value: string): boolean {
  const fold = (s: string) => s.trim().toLocaleLowerCase("tr-TR")
  return TURKISH_PROVINCES.some((p) => fold(p) === fold(value))
}
