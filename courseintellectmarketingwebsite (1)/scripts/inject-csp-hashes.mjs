// Statik çıktıdaki her HTML sayfasına, YALNIZ o sayfanın satır içi script'lerinin
// SHA-256 özetlerine izin veren bir CSP <meta> etiketi ekler.
//
// Neden: Next'in statik çıktısı satır içi script ürettiği için sunucu başlığındaki CSP
// `script-src 'unsafe-inline'` içermek zorunda; bu, olası bir XSS'te sokulan satır içi
// script'in de çalışması demek. Tarayıcı birden çok CSP'yi BİRLİKTE uygular: başlıktaki
// politika `unsafe-inline` içerse bile bu meta politikası özetsiz satır içi script'i engeller.
// Özetler her derlemede değiştiği için meta sayfanın içinde üretilir (nginx dosyasıyla
// eşgüdüm gerekmez). Kullanım: next build && node scripts/inject-csp-hashes.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../out/', import.meta.url))
const SCRIPT_HOSTS = "'self' https://va.vercel-scripts.com https://challenges.cloudflare.com"
const MARKER = 'data-csp-hashes'

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return htmlFiles(path)
    return name.endsWith('.html') ? [path] : []
  })
}

let pages = 0
for (const file of htmlFiles(OUT)) {
  let html = readFileSync(file, 'utf8')
  if (html.includes(MARKER)) {
    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*data-csp-hashes[^>]*\/?>/, '')
  }
  if (/\son[a-z]+\s*=/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))) {
    throw new Error(`${file}: satır içi olay işleyicisi var; CSP özetiyle izin verilemez`)
  }
  const hashes = new Set()
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    hashes.add(`'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`)
  }
  const policy = `script-src ${SCRIPT_HOSTS} ${[...hashes].join(' ')}; object-src 'none'; base-uri 'self'`
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" ${MARKER}=""/>`
  // Karakter kümesi bildiriminden hemen sonra (ilk 1024 baytta kalsın), tüm script'lerden önce.
  const charset = html.match(/<meta charSet="utf-8"\/>/i)
  if (!charset) throw new Error(`${file}: <meta charSet> bulunamadı`)
  html = html.replace(charset[0], `${charset[0]}${meta}`)
  if (html.indexOf(meta) > html.search(/<script/i)) throw new Error(`${file}: CSP meta script'lerden sonra kaldı`)
  writeFileSync(file, html)
  pages += 1
}
console.log(`CSP özetleri ${pages} sayfaya eklendi.`)
