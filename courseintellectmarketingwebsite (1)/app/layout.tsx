import type React from "react";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ContentProvider } from "@/context/content-context";
import { LanguageProvider } from "@/context/language-context";
import { PageTransitionProvider } from "@/components/layout/page-transition";
import { SmoothScrollProvider } from "@/components/layout/smooth-scroll-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.courseintellect.com"),
  title: {
    default: "SchoolAsist — Eğitimi Kolaylaştıran Akıllı Çözümler",
    template: "%s | SchoolAsist",
  },
  description:
    "Okulunuzun ve kurumunuzun tüm süreçleri tek platformda: yoklama, sınav, finans, rehberlik, kütüphane, veli iletişimi. Masaüstü + mobil, KVKK uyumlu.",
  keywords: [
    "okul yönetim sistemi",
    "kurs yönetim programı",
    "dershane otomasyonu",
    "öğrenci takip sistemi",
    "veli bilgilendirme",
    "rehberlik modülü",
    "eğitim platformu",
    "SchoolAsist",
  ],
  authors: [{ name: "SchoolAsist" }],
  generator: "Next.js",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    alternateLocale: "en_US",
    siteName: "SchoolAsist",
    title: "SchoolAsist — Eğitimi Kolaylaştıran Akıllı Çözümler",
    description:
      "Yoklama, sınav, finans, rehberlik ve kütüphane tek platformda. Masaüstü + mobil, KVKK uyumlu.",
    images: [{ url: "/images/logo.png", width: 512, height: 512, alt: "SchoolAsist" }],
  },
  twitter: {
    card: "summary",
    title: "SchoolAsist — Eğitimi Kolaylaştıran Akıllı Çözümler",
    description: "Kurumunuzun tüm süreçleri tek platformda.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15294B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="font-sans antialiased">
        <LanguageProvider>
          <ContentProvider>
            <Suspense fallback={null}>
              <SmoothScrollProvider>
                <PageTransitionProvider>{children}</PageTransitionProvider>
              </SmoothScrollProvider>
            </Suspense>
          </ContentProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
