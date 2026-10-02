import { roles, type RoleId } from "./site-experience-data"

// One reversible timeline drives both the camera and the interface. No delayed
// timers: dragging the scrollbar, touch scrolling and scrolling back agree.
export const brainChapters = [
  { label: "Merkez", progress: 0 },
  { label: "Okulun süreçleri", progress: .60 },
  { label: "Rol deneyimleri", progress: .92 },
] as const

export const brainIntroEnd = .36
export const brainRoleOrder = ["ogretmen", "yonetici", "veli", "ogrenci", "muhasebe", "personel", "rehberlik", "sube-muduru", "yemekhane", "servis-soforu"] as const satisfies readonly RoleId[]
export const brainRolePresentation: Record<RoleId, { title: string; accent: string }> = {
  ogretmen: { title: "Öğretmenin günü,", accent: "tek bir akışta." },
  yonetici: { title: "Bütün kurum.", accent: "Tek merkezde." },
  veli: { title: "Her adım yakın.", accent: "İçiniz rahat." },
  ogrenci: { title: "Hedefin belli.", accent: "Sıradaki adım." },
  muhasebe: { title: "Her hareket net.", accent: "Kontrol sizde." },
  personel: { title: "Ekibin günü.", accent: "Planlı ilerler." },
  rehberlik: { title: "Her yolculuk.", accent: "Özenle takipte." },
  "sube-muduru": { title: "Şubenizin akışı.", accent: "Elinizin altında." },
  yemekhane: { title: "Her öğün planlı.", accent: "Her ayrıntı net." },
  "servis-soforu": { title: "Her yolculuk.", accent: "Güvenle takipte." },
}
export function brainRoleProgress(id: RoleId) {
  return brainIntroEnd + (brainRoleOrder.indexOf(id) + .45) / brainRoleOrder.length * (1 - brainIntroEnd)
}
export function brainStoryTimeline(progress: number) {
  const p = clamp01(progress)
  const index = Math.min(brainRoleOrder.length - 1, Math.max(0, Math.floor((p - brainIntroEnd) / (1 - brainIntroEnd) * brainRoleOrder.length)))
  const roleId = brainRoleOrder[index]
  return { sceneProgress: clamp01(p / brainIntroEnd), roleId, role: roles.find(role => role.id === roleId)!, index }
}

export const brainProcesses = [
  { id: "lessons", label: "Dersler", href: "/deneyim/ogretmen/", start: .15, position: [-4.4, .32, -3.5] },
  { id: "students", label: "Öğrenciler", href: "/deneyim/ogrenci/", start: .22, position: [-4.8, .08, 1.0] },
  { id: "teachers", label: "Öğretmenler", href: "/deneyim/ogretmen/", start: .29, position: [4.4, .32, -3.5] },
  { id: "parents", label: "Veliler", href: "/deneyim/veli/", start: .36, position: [4.8, .08, 1.0] },
  { id: "finance", label: "Finans", href: "/deneyim/muhasebe/", start: .43, position: [-4.75, .04, 5.2] },
  { id: "management", label: "Yönetim", href: "/deneyim/yonetici/", start: .50, position: [4.75, .04, 5.2] },
] as const

export type BrainProcess = (typeof brainProcesses)[number]
export function brainPosition(process: BrainProcess, compact: boolean): [number, number, number] {
  if (!compact) return [...process.position]
  const row = process.id === "lessons" || process.id === "teachers" ? 0 : process.id === "students" || process.id === "parents" ? 1 : 2
  return [Math.sign(process.position[0]) * [2.3, 2.2, 1.6][row], process.position[1], [-3.8, 1.8, 7][row]]
}
export function clamp01(value: number) { return Math.min(1, Math.max(0, value)) }
export function smoothRange(value: number, start: number, end: number) {
  const t = clamp01((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}
export function brainTimeline(progress: number) {
  const p = clamp01(progress)
  return {
    progress: p,
    focus: smoothRange(p, .64, .93),
    title: 1 - smoothRange(p, .23, .43),
    teacherCopy: smoothRange(p, .75, .87),
    chapter: p < .14 ? 0 : p < .74 ? 1 : 2,
  }
}
