import './tools/patch-worker-threads.js';
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const registrationFlag = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED?.trim() || "false";
if (process.env.NODE_ENV === "production" && !["true", "false"].includes(registrationFlag)) {
  throw new Error("NEXT_PUBLIC_REGISTRATION_ENABLED must be exactly true or false");
}
const registrationEnabled = registrationFlag === "true";

if (process.env.NODE_ENV === "production" && registrationEnabled && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) {
  throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is required for production static exports");
}

// İki ayrı derleme hedefi:
//   public (varsayılan) → pazarlama sitesi. Platform yönetim paneli bu derlemeye HİÇ girmez;
//     panel dosyaları "*.admin.tsx" adını taşır ve bu hedefte sayfa uzantısı sayılmaz. Böylece
//     Next'in herkese açık rota ağacı/JS parçaları panelin varlığını ve yolunu ele vermez.
//   admin → yalnız yonetim.schoolasist.com'da, gizli ve tahmin edilemez bir taban yol altında
//     sunulan ayrı derleme. Taban yol depoya yazılmaz; derleme ortamından (ADMIN_BASE_PATH) gelir.
const siteTarget = process.env.SITE_TARGET?.trim() || "public";
if (!["public", "admin"].includes(siteTarget)) {
  throw new Error("SITE_TARGET must be exactly public or admin");
}
const adminBasePath = process.env.ADMIN_BASE_PATH?.trim() || "";
// Üretim derlemesinde gizli yol zorunludur; yerel geliştirmede (npm run dev:admin) boş bırakılabilir.
if (siteTarget === "admin" && process.env.NODE_ENV === "production" && !/^\/[a-z0-9]{32,64}$/.test(adminBasePath)) {
  throw new Error("ADMIN_BASE_PATH must be a slash followed by 32-64 lowercase letters/digits for admin builds");
}
const defaultPageExtensions = ["tsx", "ts", "jsx", "js"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  output: "export",
  pageExtensions: siteTarget === "admin" ? ["admin.tsx", ...defaultPageExtensions] : defaultPageExtensions,
  ...(siteTarget === "admin" && adminBasePath ? { basePath: adminBasePath } : {}),
  trailingSlash: true,
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    workerThreads: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
