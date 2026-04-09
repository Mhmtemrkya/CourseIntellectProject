"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Monitor, Smartphone, Apple, Download, Check, ExternalLink, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSectionContent } from "@/context/content-context"
import { useUserAuth } from "@/context/user-auth-context"

export default function DownloadPage() {
  const downloadContent = useSectionContent("download")
  const { isAuthenticated } = useUserAuth()

  const iconMap: Record<string, LucideIcon> = {
    Monitor,
    Smartphone,
    Apple,
  }

  const platformColors: Record<string, string> = {
    windows: "bg-blue-500/10 text-blue-600",
    macos: "bg-gray-500/10 text-gray-600",
    ios: "bg-gray-500/10 text-gray-600",
    android: "bg-green-500/10 text-green-600",
  }

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{downloadContent.hero.title}</h1>
            <p className="text-lg text-muted-foreground">{downloadContent.hero.subtitle}</p>
          </motion.div>
        </div>
      </section>

      {/* Download Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4 lg:px-8">
          {!isAuthenticated && (
            <div className="mb-6 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
              İndirme için giriş yapmanız gerekiyor. Lütfen önce giriş yapın.
            </div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {downloadContent.platforms.map((platform, index) => {
              const Icon = iconMap[platform.icon] || Monitor
              const colorClass = platformColors[platform.id] || "bg-primary/10 text-primary"

              return (
                <motion.div
                  key={platform.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full border-border hover:border-accent/50 transition-all hover:shadow-lg group">
                    <CardContent className="p-6 flex flex-col h-full">
                      {/* Icon & Name */}
                      <div className="flex items-center gap-4 mb-4">
                        <div
                          className={`w-14 h-14 rounded-xl ${colorClass} flex items-center justify-center group-hover:scale-110 transition-transform`}
                        >
                          <Icon className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{platform.name}</h3>
                          <span className="text-sm text-muted-foreground">v{platform.version}</span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mb-4 flex-1">{platform.description}</p>

                      {/* Requirements */}
                      <div className="space-y-2 mb-6">
                        {platform.requirements.slice(0, 3).map((req, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="w-3 h-3 text-accent" />
                            {req}
                          </div>
                        ))}
                      </div>

                      {/* Download Button */}
                      {isAuthenticated ? (
                        <Link
                          href={platform.downloadUrl || "#"}
                          target={platform.downloadUrl?.startsWith("http") ? "_blank" : undefined}
                          rel={platform.downloadUrl?.startsWith("http") ? "noopener noreferrer" : undefined}
                        >
                          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                            <Download className="w-4 h-4 mr-2" />
                            İndir
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/giris">
                          <Button variant="outline" className="w-full bg-transparent">
                            <Download className="w-4 h-4 mr-2" />
                            Giriş Yap
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Version Notes */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
              {downloadContent.versionNotes.title}
            </h2>

            <div className="space-y-6">
              {downloadContent.versionNotes.notes.map((note, index) => (
                <motion.div
                  key={note.version}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-xl p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                        v{note.version}
                      </span>
                      {index === 0 && (
                        <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-600 text-xs font-medium">
                          Güncel
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{note.date}</span>
                  </div>
                  <ul className="space-y-2">
                    {note.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Kurulumda yardıma mı ihtiyacınız var?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Detaylı kurulum kılavuzlarımıza göz atın veya destek ekibimizle iletişime geçin.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" className="bg-transparent">
              <ExternalLink className="w-4 h-4 mr-2" />
              Kurulum Kılavuzu
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Destek Al</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
