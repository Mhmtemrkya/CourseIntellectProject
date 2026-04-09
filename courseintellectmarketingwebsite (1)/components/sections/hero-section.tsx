"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Play, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSectionContent } from "@/context/content-context"

export function HeroSection() {
  const { hero } = useSectionContent("homepage")

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-background" />

        {/* Decorative Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating Blobs */}
        <motion.div
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            {hero.badge && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6"
              >
                <Sparkles className="w-4 h-4" />
                {hero.badge}
              </motion.div>
            )}

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6"
            >
              {hero.title.split(" ").map((word, index) => (
                <span key={index}>
                  {index === hero.title.split(" ").length - 1 ? (
                    <span className="text-accent">{word}</span>
                  ) : (
                    <span>{word} </span>
                  )}
                </span>
              ))}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              {hero.subtitle}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <Link href={hero.primaryCTA.href}>
                <Button
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground group w-full sm:w-auto"
                >
                  {hero.primaryCTA.text}
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href={hero.secondaryCTA.href}>
                <Button size="lg" variant="outline" className="group w-full sm:w-auto bg-transparent">
                  <Play className="mr-2 w-4 h-4 group-hover:scale-110 transition-transform" />
                  {hero.secondaryCTA.text}
                </Button>
              </Link>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-12 flex items-center justify-center lg:justify-start gap-8"
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">500+</strong> okul güveniyor
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Hero Image / Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="relative"
          >
            {/* Main Dashboard Card */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="relative bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
            >
              <div className="p-1">
                {/* Window Controls */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-4 text-xs text-muted-foreground">CourseIntellect Dashboard</span>
                </div>

                {/* Dashboard Preview */}
                <div className="p-4 space-y-4">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Öğrenci", value: "1,234", color: "bg-accent" },
                      { label: "Ders", value: "48", color: "bg-primary" },
                      { label: "Ödev", value: "12", color: "bg-chart-3" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-secondary rounded-lg p-3">
                        <div className={`w-8 h-1 ${stat.color} rounded mb-2`} />
                        <div className="text-lg font-bold text-foreground">{stat.value}</div>
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Chart Placeholder */}
                  <div className="bg-secondary rounded-lg p-4 h-32">
                    <div className="flex items-end justify-between h-full gap-2">
                      {[40, 65, 45, 80, 55, 70, 90].map((height, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
                          className="flex-1 bg-accent/80 rounded-t"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Floating Card - Notification */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
              transition={{
                opacity: { delay: 1 },
                scale: { delay: 1 },
                y: { duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1.5 },
              }}
              className="absolute -left-8 top-1/4 bg-card rounded-xl shadow-xl border border-border p-4 max-w-[200px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-accent text-lg">🎉</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Yeni Başarı!</p>
                  <p className="text-xs text-muted-foreground">Matematik sınavında en yüksek puan</p>
                </div>
              </div>
            </motion.div>

            {/* Floating Card - Message */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, y: [0, 5, 0] }}
              transition={{
                opacity: { delay: 1.2 },
                scale: { delay: 1.2 },
                y: { duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 2 },
              }}
              className="absolute -right-4 bottom-1/4 bg-card rounded-xl shadow-xl border border-border p-4 max-w-[180px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs text-primary-foreground">A</span>
                </div>
                <span className="text-xs font-medium text-foreground">Ahmet Öğretmen</span>
              </div>
              <p className="text-xs text-muted-foreground">Ödeviniz değerlendirildi. Tebrikler!</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
