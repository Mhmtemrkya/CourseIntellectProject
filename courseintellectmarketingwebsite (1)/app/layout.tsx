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
  title: "CourseIntellect - Eğitimde Yeni Nesil Deneyim",
  description:
    "Öğretmen, öğrenci ve veliler için tasarlanmış akıllı eğitim platformu. Ders takibi, anlık bildirimler ve detaylı raporlarla eğitimi kolaylaştırın.",
  keywords: [
    "eğitim",
    "öğretmen",
    "öğrenci",
    "veli",
    "okul yönetimi",
    "ders takibi",
    "eğitim platformu",
  ],
  authors: [{ name: "CourseIntellect" }],
  generator: "Next.js",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "CourseIntellect - Eğitimde Yeni Nesil Deneyim",
    description:
      "Öğretmen, öğrenci ve veliler için tasarlanmış akıllı eğitim platformu.",
    type: "website",
    locale: "tr_TR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00354F",
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
