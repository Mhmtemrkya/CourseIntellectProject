"use client"

import { motion } from "framer-motion"
import { Monitor, Smartphone, Download, Check } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useSectionContent } from "@/context/content-context"

export function PlatformsSection() {
  const { platforms } = useSectionContent("homepage")

  return (
    <section className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{platforms.sectionTitle}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{platforms.sectionSubtitle}</p>
        </motion.div>

        {/* Platform Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Desktop Platform */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-2xl border border-border p-8 relative overflow-hidden group"
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Monitor className="w-8 h-8 text-primary" />
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-foreground mb-2">{platforms.desktop.name}</h3>
              <p className="text-muted-foreground mb-6">{platforms.desktop.description}</p>

              {/* Requirements */}
              <div className="space-y-2 mb-6">
                {platforms.desktop.requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-accent" />
                    {req}
                  </div>
                ))}
              </div>

              {/* Version & CTA */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">v{platforms.desktop.version}</span>
                <Link href={platforms.desktop.downloadUrl}>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Download className="w-4 h-4 mr-2" />
                    İndir
                  </Button>
                </Link>
              </div>
            </div>

            {/* Decorative Element */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute -bottom-20 -right-20 w-40 h-40 border border-primary/10 rounded-full"
            />
          </motion.div>

          {/* Mobile Platform */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-card rounded-2xl border border-border p-8 relative overflow-hidden group"
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Smartphone className="w-8 h-8 text-accent" />
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-foreground mb-2">{platforms.mobile.name}</h3>
              <p className="text-muted-foreground mb-6">{platforms.mobile.description}</p>

              {/* Requirements */}
              <div className="space-y-2 mb-6">
                {platforms.mobile.requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-accent" />
                    {req}
                  </div>
                ))}
              </div>

              {/* Version & CTA */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">v{platforms.mobile.version}</span>
                <Link href={platforms.mobile.downloadUrl}>
                  <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Download className="w-4 h-4 mr-2" />
                    İndir
                  </Button>
                </Link>
              </div>
            </div>

            {/* Decorative Element */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute -bottom-20 -left-20 w-40 h-40 border border-accent/10 rounded-full"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
