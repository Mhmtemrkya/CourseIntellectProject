import * as THREE from "three"
import { roles } from "./site-experience-data"

const ink = "#10264a", blue = "#2156d8", orange = "#f57c23", muted = "#74839c"
export function panelDimensions(kind: string): [number, number] {
  if (kind.startsWith("page-")) return [800, 1120]
  if (kind.endsWith(":portrait")) return [760, 1200]
  if (kind === "book-header") return [1600, 250]
  if (kind === "assignment") return [1400, 360]
  if (kind === "demo") return [1000, 380]
  if (kind === "chip") return [1400, 1000]
  if (kind === "profile") return [500, 640]
  if (kind === "kpi-ring") return [640,640]
  if (kind.startsWith("notification:")) return [1400,340]
  if (kind.startsWith("stat:")) return [1000,360]
  return [1600, 1000]
}

// Each panel is rasterized once. Content density and aspect ratio are designed
// for its physical screen; animations never redraw the canvas.
export function createBrainPanelTexture(kind: string, maxResolution = 1600) {
  const [w, h] = panelDimensions(kind), scale = Math.min(1, maxResolution / Math.max(w, h))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale)
  const c = canvas.getContext("2d")!
  c.scale(scale, scale)
  if (kind === "kpi-ring") { c.beginPath(); c.arc(w/2,h/2,w/2,0,Math.PI*2); c.clip() }
  else if (!kind.startsWith("page-") && kind !== "chip") { c.beginPath(); c.roundRect(0, 0, w, h, 36); c.clip() }
  const text = (value: string, x: number, y: number, size = 32, color = ink, weight = 500) => { c.fillStyle = color; c.font = `${weight} ${size}px "Inter Variable", Arial, sans-serif`; c.fillText(value, x, y) }
  const box = (x: number, y: number, width: number, height: number, fill: string | CanvasGradient, radius = 24, stroke?: string) => {
    c.beginPath(); c.roundRect(x, y, width, height, radius); c.fillStyle = fill; c.fill()
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke() }
  }
  const circle = (x: number, y: number, r: number, fill: string) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill() }
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width = 2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke() }
  const gradient = (y: number, height: number, a: string, b: string) => { const g = c.createLinearGradient(0, y, w, y + height); g.addColorStop(0, a); g.addColorStop(1, b); return g }
  const pill = (label: string, x: number, y: number, width: number, fill = "#edf2fd", color = blue) => { box(x, y, width, 50, fill, 25); text(label, x + 22, y + 34, 23, color, 650) }
  const fit = (value: string, x: number, y: number, maxWidth: number, size = 38, color = ink, weight = 650) => {
    while (size > 22) { c.font = `${weight} ${size}px "Inter Variable", Arial, sans-serif`; if (c.measureText(value).width <= maxWidth) break; size-- }
    text(value, x, y, size, color, weight)
  }
  const header = (title: string, subtitle: string) => {
    box(0, 0, w, h, gradient(0, h, "#ffffff", "#f0f5fb"), 0)
    box(0, 0, w, 104, "#102747", 0)
    box(48, 28, 44, 44, gradient(28, 44, "#ffaa48", orange), 12); text("S", 60, 61, 28, "white", 800)
    text("SchoolAsist", 113, 61, 27, "#f2f6ff", 700)
    circle(w - 70, 49, 7, "#71d7c0"); text("Demo", w - 165, 61, 22, "#c6d4ea")
    fit(title, 64, 183, w - 360, 56); text(subtitle, 65, 226, 25, muted)
    pill("Bugün  ⌄", w - 245, 141, 177, "#eef3fb", "#526984")
  }
  const footer = () => { line(64, h - 77, w - 64, h - 77, "#e1e8f3"); text("Temsili demo verileri", 65, h - 35, 21, muted); text("Güncel  •", w - 180, h - 35, 21, "#219477") }

  if (kind.startsWith("notification:")) {
    const i=Number(kind.split(":")[1]), notices=[["Yeni ders bildirimi","Matematik materyali eklendi.","14:27"],["Ödev teslim edildi","Demo 1 · Gelişim güncellendi.","11:03"],["Günlük devam özeti","Demo 2 · Dersin akışı tamamlandı.","09:42"]]
    box(0,0,w,h,gradient(0,h,"#ffffff",i===0?"#fff4e6":"#f2f6fd"),0)
    box(40,63,192,196,i===0?"#ffe7c8":"#e9f0fc",42); text(i===0?"D1":"D2",80,186,71,i===0?"#b4651d":blue,750)
    text(notices[i][0],276,138,58,ink,700); text(notices[i][1],276,215,35,muted,500); text(notices[i][2],1190,114,35,muted,500)
    if(!i) pill("Yeni",1190,169,130,"#f98e35","white")
  } else if(kind.startsWith("stat:")) {
    box(0,0,w,h,gradient(0,h,"#133564","#2254a0"),0)
    const finance=kind==="stat:finance"; circle(80,95,10,finance?"#7cddbf":"#ffae55")
    text(finance?"NET AKIŞ":"BİR SONRAKİ ADIM",115,108,31,"#bad1f0",650)
    text(finance?"+35.600 TL":"Derse hazır",72,250,84,"white",750); text("↗",833,251,90,"#95c0f3",600)
  } else if(kind==="kpi-ring") {
    box(0,0,w,h,gradient(0,h,"#ffffff","#edf3fc"),0); text("%92",134,323,138,ink,750); text("GENEL DEVAM",157,412,30,muted,650)
  } else if(kind==="management-detail") {
    header("Haftalık akış","Bütün kurum, ortak bir bakışta.")
    box(64,283,1472,540,"#ffffff",28,"#e2e9f4"); text("7 günlük devam görünümü",112,361,35,ink,650)
    for(let i=0;i<7;i++){const x=145+i*194; box(x,606-(i%3+3)*46,96,(i%3+3)*46,i===5?"#f7a153":"#3268d8",14); text(["Pzt","Sal","Çar","Per","Cum","Cts","Paz"][i],x+10,667,28,muted)}
    text("Süreç katılımı",112,731,29,muted); box(112,768,1220,15,"#edf2fa",8); box(112,768,1061,15,gradient(768,15,"#8fb1f7",blue),8);text("%87",1361,784,32,ink,650);footer()
  } else if (kind === "profile") {
    box(0,0,w,h,"#f7faff",0); circle(250,236,138,"#edf2fc"); text("D1",148,278,112,blue,750); text("Demo 1",112,459,67,ink,700); circle(175,537,12,"#25aa88"); text("Aktif",206,553,43,muted,550)
  } else if (kind === "chip") {
    box(0, 0, w, h, gradient(0, h, "#092041", "#183d68"), 0)
    c.lineCap = "round"
    for (let i = 0; i < 12; i++) {
      const x = 65 + i * 113, height = 145 + i % 3 * 58
      line(x, 35, x, height, "#426285", 4); line(x, height, x + 40, height + 40, "#426285", 4); line(x + 40, height + 40, x + 40, 396, "#426285", 4)
      line(x, h - 35, x, h - height, "#426285", 4); line(x, h - height, x - 40, h - height - 40, "#426285", 4)
      circle(x, 40, 7, i % 2 ? "#8caace" : "#f49a45"); circle(x, h - 40, 7, i % 2 ? "#f49a45" : "#8caace")
    }
    box(350, 360, 700, 280, "#0a1a34", 35, "#607890"); text("SCHOOLASIST", 420, 500, 64, "#ebf2fd", 750); text("CONNECTED CAMPUS", 493, 560, 26, "#83a6ce", 650)
  } else if (kind === "book-header") {
    box(0, 0, w, h, "#ffffff", 0); box(48, 44, 158, 158, "#edf2ff", 38); text("∑", 85, 158, 88, blue, 650)
    text("Matematik", 250, 158, 90, ink, 750); text("7-A", 1155, 150, 61, muted, 550); circle(1475, 125, 14, "#27b591")
  } else if (kind === "assignment") {
    box(0, 0, w, h, "#ffffff", 0); circle(160, 180, 72, "#e8f7f1"); text("✓", 110, 215, 90, "#1a9d79", 700)
    text("Ödev hazır", 282, 218, 100, ink, 700); text("↗", 1190, 219, 110, orange, 500)
  } else if (kind === "demo") {
    box(0, 0, w, h, "#ffffff", 0); circle(153, 190, 100, "#eaf0fd"); text("D1", 83, 225, 88, blue, 700)
    text("Demo 1", 320, 173, 99, ink, 700); text("Öğrenci profili", 320, 261, 50, muted, 500)
  } else if (kind.startsWith("page-")) {
    box(0, 0, w, h, gradient(0, h, "#ffffff", "#f2f5fb"), 0)
    text(kind === "page-left" ? "DERS PLANI" : "ÖĞRENME ALANI", 57, 76, 21, blue, 750)
    text(kind === "page-left" ? "Bugünün dersi" : "Denklemler", 57, 152, 46, ink, 750)
    text(kind === "page-left" ? "Matematik · 7-A · 09:00" : "Demo 1 · Konu çalışma alanı", 57, 202, 25, muted)
    line(57, 247, 743, 247, "#dce5f2")
    if (kind === "page-left") {
      ["Konuyu keşfet", "Birlikte çöz", "Uygula", "Değerlendir"].forEach((label, i) => {
        const y = 337 + i * 131
        if (i < 3) line(90, y, 90, y + 130, "#dce5f2", 3)
        circle(90, y, 27, i === 0 ? blue : "#e7eef9"); text(i === 0 ? "✓" : String(i + 1), 78, y + 9, 23, i === 0 ? "white" : muted, 650)
        text(label, 147, y - 5, 33, ink, 650); text(i === 0 ? "Derse hazır" : "Sıradaki adım", 147, y + 37, 21, muted)
      })
      box(57, 858, 686, 189, gradient(858, 189, "#153361", "#2157a3"), 25)
      circle(98, 915, 8, "#ffb05a"); text("Her adım bir arada", 125, 926, 30, "white", 650); text("Hazırlıktan değerlendirmeye.", 91, 987, 25, "#c7d7ef")
    } else {
      box(57, 290, 686, 529, "#f1f5fd", 25, "#e2e9f6")
      for (let i = 0; i < 7; i++) { line(87 + i * 101, 313, 87 + i * 101, 786, "#e0e8f7"); line(77, 330 + i * 73, 721, 330 + i * 73, "#e0e8f7") }
      const pts = [[133, 713], [452, 401], [666, 713]]
      c.beginPath(); c.moveTo(...pts[0] as [number, number]); pts.slice(1).forEach(p => c.lineTo(...p as [number, number])); c.closePath(); c.fillStyle = "#245bdb10"; c.fill(); c.strokeStyle = blue; c.lineWidth = 5; c.stroke()
      pts.forEach(([x, y], i) => { circle(x, y, 7, blue); text(["A", "B", "C"][i], x - 9, y + (i === 1 ? -22 : 36), 23, blue, 650) })
      c.setLineDash([8, 9]); line(452, 401, 452, 713, "#93acdc", 3); c.setLineDash([])
      box(57, 862, 686, 178, "#fff1e3", 25); text("Sıradaki çalışma", 88, 916, 24, "#a45b20", 650); text("Denklem çözme alıştırmaları", 88, 969, 32, ink, 650); text("5 etkinlik · Yaklaşık 20 dk", 88, 1010, 23, muted)
    }
  } else if (kind === "lessons") {
    header("Bugünün dersleri", "Hazır bir plan. Birbirine bağlı adımlar.")
    const lessons = [["09:00", "Matematik", "Denklemler ve eşitsizlikler", "Sıradaki ders"], ["10:00", "Türkçe", "Paragrafta anlam", "Planlandı"], ["11:00", "Fen Bilimleri", "Canlılar ve yaşam", "Planlandı"]]
    lessons.forEach(([time, title, description, status], i) => {
      const y = 298 + i * 188
      box(64, y, 1472, 156, i === 0 ? "#fff4e8" : "#ffffff", 22, i === 0 ? "#ffd6ab" : "#e0e8f2")
      box(86, y + 22, 137, 112, i === 0 ? "#f78a32" : "#edf2fb", 17); text(time, 101, y + 83, 31, i === 0 ? "white" : blue, 700)
      text(title, 265, y + 61, 38, ink, 700); text(description, 265, y + 110, 26, muted)
      pill(status, 1188, y + 52, 307, i === 0 ? "#ffdfbd" : "#edf3fb", i === 0 ? "#a05218" : muted)
    }); footer()
  } else if (kind === "students") {
    header("Sınıfın görünümü", "Her öğrenci için ayrı yolculuk. Ortak bir bakış.")
    box(64, 279, 536, 546, gradient(279, 546, "#153d7a", "#1c5ec4"), 28)
    text("GENEL GELİŞİM", 102, 340, 23, "#b9d1f7", 650); text("%78", 100, 486, 113, "white", 750)
    text("Birlikte ilerliyoruz", 104, 546, 31, "#e4edff", 600)
    box(104, 592, 450, 12, "#ffffff20", 6); box(104, 592, 351, 12, gradient(592, 12, "#77cde7", "#9ae0cd"), 6)
    text("7-A sınıfı", 104, 694, 32, "white", 650); text("24 / 28 öğrenci derste", 104, 749, 25, "#bed6f7")
    for (let i = 0; i < 9; i++) {
      const x = 650 + i % 3 * 294, y = 280 + Math.floor(i / 3) * 185
      box(x, y, 272, 165, "#ffffff", 22, "#e2e9f4"); circle(x + 58, y + 61, 30, i % 3 ? "#edf2fd" : "#e9f8f3"); text(`D${i + 1}`, x + 37, y + 70, 25, i % 3 ? blue : "#19947b", 700)
      circle(x + 227, y + 38, 7, i === 7 ? orange : "#2fb393"); text(`Demo ${i + 1}`, x + 22, y + 131, 27, ink, 650)
    }; footer()
  } else if (kind === "finance") {
    header("Finansal görünüm", "Her hareket net. Kararlar daha güçlü.");
    [["Tahsilat", "48.200 TL", blue], ["Gider", "12.600 TL", orange], ["Net akış", "+35.600 TL", "#1b9479"]].forEach(([label, value, color], i) => {
      const x = 64 + i * 502
      box(x, 279, 468, 173, "#ffffff", 22, "#e2e9f4"); circle(x + 33, 319, 6, color); text(label, x + 52, 328, 26, muted); fit(value, x + 29, 413, 420, 75, ink, 700)
    })
    box(64, 485, 1472, 362, "#ffffff", 24, "#e2e9f4")
    const ys = [710, 644, 680, 556, 601, 533, 557, 504]
    for (let i = 0; i < 4; i++) line(101, 532 + i * 73, 1500, 532 + i * 73, "#edf1f8")
    for (let i = 0; i < 12; i++) box(126 + i * 114, 768 - (i % 4 + 1) * 39, 30, (i % 4 + 1) * 39, "#e9effa", 7)
    const points = ys.map((y, i) => [107 + i * 196, y] as [number, number])
    c.beginPath(); c.moveTo(107, 776); points.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(1479, 776); c.closePath(); c.fillStyle = gradient(500, 276, "#5b86ed45", "#5b86ed03"); c.fill()
    for (let series = 0; series < 2; series++) {
      c.beginPath(); points.forEach(([x, y], i) => { const py = series ? y * .57 + 342 : y; if (!i) c.moveTo(x, py); else { const prev = points[i - 1], prevY = series ? prev[1] * .57 + 342 : prev[1]; c.bezierCurveTo(prev[0] + 94, prevY, x - 94, py, x, py) } }); c.strokeStyle = series ? orange : blue; c.lineWidth = 7; c.stroke()
    }
    ["Pzt", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"].forEach((value, i) => text(value, 143 + i * 204, 815, 21, muted)); footer()
  } else if (kind === "parents") {
    header("İletişim akışı", "Doğru bilgi. Doğru kişiye. Doğru zamanda.")
    const rows = [["Dersin yeni adımı hazır", "Matematik · Yeni çalışma materyali", "14:27", orange], ["Ödev teslim edildi", "Demo 1 · Öğrenme yolculuğu güncellendi", "11:03", blue], ["Günlük devam özeti", "Demo 2 · Günün akışı tamamlandı", "09:42", "#249e85"]]
    rows.forEach(([title, detail, time, color], i) => { const y = 288 + i * 180; box(64, y, 1472, 152, "#ffffff", 22, "#e1e8f3"); circle(122, y + 64, 31, color + "15"); circle(122, y + 64, 8, color); text(title, 187, y + 61, 34, ink, 650); text(detail, 187, y + 108, 25, muted); text(time, 1380, y + 62, 24, muted); if (!i) pill("Yeni", 1349, y + 89, 129, "#fff0de", "#b9681b") }); footer()
  } else if (kind === "management" || kind === "percent") {
    header("Kurumun nabzı", "Günün tamamı, tek bir bakışta.")
    box(64, 281, 573, 548, "#ffffff", 28, "#e2e9f4")
    c.beginPath(); c.arc(350, 508, 143, 0, Math.PI * 2); c.strokeStyle = "#eaf0fc"; c.lineWidth = 27; c.stroke()
    c.beginPath(); c.arc(350, 508, 143, -Math.PI / 2, Math.PI * 1.34); c.strokeStyle = blue; c.lineCap = "round"; c.stroke(); c.lineCap = "butt"
    text("%92", 241, 535, 81, ink, 750); text("Genel devam", 250, 718, 31, ink, 650); pill("↑ %4 gelişim", 230, 747, 246, "#e8f7f1", "#218c70")
    box(672, 281, 864, 548, "#ffffff", 28, "#e2e9f4"); text("Haftalık görünüm", 711, 347, 32, ink, 650)
    for (let i = 0; i < 7; i++) { box(717 + i * 112, 590 - (i % 3 + 3) * 37, 56, (i % 3 + 3) * 37, i === 5 ? "#f7a153" : "#3268d8", 10); text(["P", "S", "Ç", "P", "C", "C", "P"][i], 732 + i * 112, 634, 21, muted) }
    text("Süreç katılımı", 714, 714, 27, muted); box(714, 751, 740, 12, "#edf2fa", 6); box(714, 751, 648, 12, gradient(751, 12, "#90b2f8", blue), 6); footer()
  } else if (kind.startsWith("role:")) {
    const role = roles.find(item => item.id === kind.slice(5).split(":")[0])!
    if (kind.endsWith(":portrait")) {
      box(0, 0, w, h, gradient(0, h, "#ffffff", "#edf3fb"), 0); box(0, 0, w, 118, "#153361", 0)
      text("SchoolAsist", 52, 76, 35, "white", 700); circle(w - 65, 61, 9, "#72d5bb")
      fit(role.screen, 48, 204, w - 100, 44); text("Demo 1 · Çalışma alanı", 49, 258, 27, muted)
      role.features.forEach((feature, i) => { const y = 323 + i * 249; box(45, y, w - 90, 212, "#ffffff", 25, "#e0e7f3"); circle(91, y + 48, 17, i ? "#e8effe" : "#fff0df"); text(i ? "•" : "✓", 81, y + 58, 26, i ? blue : orange, 700); fit(feature, 74, y + 119, w - 144, 31); text("Kurum ve rol yetkileri kapsamında", 75, y + 171, 19, muted) }); text("Temsili demo verileri", 50, 1170, 22, muted)
    } else {
      header(role.screen, `${role.name} · Demo 1 çalışma alanı`)
      box(64, 287, 442, 541, gradient(287, 541, "#173b71", "#235aad"), 28); text("SİZE ÖZEL", 104, 347, 23, "#bfd0ee", 650); text("Birlikte", 104, 455, 55, "white", 750); text("daha güçlü.", 104, 521, 51, "white", 750); line(104, 582, 451, 582, "#6682b4", 2); text("Her adım", 105, 669, 30, "#e6eeff", 550); text("doğru yerde.", 105, 718, 30, "#e6eeff", 550)
      role.features.forEach((feature, i) => { const y = 287 + i * 186; box(550, y, 986, 164, "#ffffff", 23, "#e0e8f3"); box(579, y + 44, 75, 75, i === 0 ? "#fff0df" : "#edf2ff", 21); text(i === 0 ? "✓" : "↗", 600, y + 93, 31, i === 0 ? orange : blue, 700); fit(feature, 690, y + 71, 775, 36); text("Tek akışta, güvenli çalışma alanı", 691, y + 117, 23, muted) }); footer()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
  return texture
}
