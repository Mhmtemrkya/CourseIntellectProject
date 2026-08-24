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

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
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
