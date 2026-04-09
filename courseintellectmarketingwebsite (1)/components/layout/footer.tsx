"use client"

import type React from "react"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Twitter, Linkedin, Instagram, Youtube, Mail, Phone, MapPin, ArrowUpRight } from "lucide-react"
import { useSectionContent } from "@/context/content-context"

const iconMap: Record<string, React.ElementType> = {
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function Footer() {
  const footerContent = useSectionContent("footer")
  const contactContent = useSectionContent("contact")

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Main Footer */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12"
        >
          {/* Brand Column */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <Image
                src="/images/logo.png"
                alt="CourseIntellect Logo"
                width={44}
                height={44}
                className="brightness-0 invert"
              />
              <span className="text-xl font-bold">
                Course<span className="text-accent">Intellect</span>
              </span>
            </Link>
            <p className="text-primary-foreground/70 mb-6 max-w-sm leading-relaxed">{footerContent.description}</p>

            {/* Contact Info */}
            <div className="space-y-3">
              <a
                href={`mailto:${contactContent.info.email}`}
                className="flex items-center gap-3 text-sm text-primary-foreground/70 hover:text-accent transition-colors"
              >
                <Mail className="w-4 h-4" />
                {contactContent.info.email}
              </a>
              <a
                href={`tel:${contactContent.info.phone}`}
                className="flex items-center gap-3 text-sm text-primary-foreground/70 hover:text-accent transition-colors"
              >
                <Phone className="w-4 h-4" />
                {contactContent.info.phone}
              </a>
              <div className="flex items-start gap-3 text-sm text-primary-foreground/70">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{contactContent.info.address}</span>
              </div>
            </div>
          </motion.div>

          {/* Link Columns */}
          {footerContent.sections.map((section) => (
            <motion.div key={section.id} variants={itemVariants}>
              <h3 className="font-semibold text-base mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/70 hover:text-accent transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-6 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          {/* Copyright */}
          <p className="text-sm text-primary-foreground/60">{footerContent.copyright}</p>

          {/* Legal Links */}
          <div className="flex items-center gap-6">
            {footerContent.legalLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className="text-sm text-primary-foreground/60 hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-3">
            {footerContent.socialLinks.map((social) => {
              const Icon = iconMap[social.icon] || Twitter
              return (
                <motion.a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-9 h-9 rounded-full bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/70 hover:bg-accent hover:text-accent-foreground transition-colors"
                  aria-label={social.platform}
                >
                  <Icon className="w-4 h-4" />
                </motion.a>
              )
            })}
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
