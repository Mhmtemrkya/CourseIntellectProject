"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSectionContent } from "@/context/content-context"
import { useLanguage } from "@/context/language-context"
import { useUserAuth } from "@/context/user-auth-context"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const navContent = useSectionContent("navbar")
  const { language, setLanguage } = useLanguage()
  const { user, isAuthenticated } = useUserAuth()

  const t = {
    login: { tr: "Giriş Yap", en: "Sign In" },
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMobileMenuOpen])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          isScrolled
            ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border"
            : "bg-transparent",
        )}
      >
        {/* Top orange accent line — only visible at hero */}
        {!isScrolled && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px opacity-70"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(217,121,11,0.6), rgba(251,185,113,0.8), rgba(217,121,11,0.6), transparent)",
            }}
          />
        )}

        <nav className="container mx-auto px-4 lg:px-8">
          <div
            className={cn(
              "flex items-center justify-between transition-all duration-500",
              isScrolled ? "h-16" : "mt-3 h-16 rounded-full border px-4",
            )}
            style={
              !isScrolled
                ? {
                    background:
                      "linear-gradient(135deg, rgba(2,22,34,0.72) 0%, rgba(10,24,37,0.72) 50%, rgba(2,22,34,0.72) 100%)",
                    borderColor: "rgba(217,121,11,0.28)",
                    boxShadow:
                      "0 12px 40px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 22px rgba(217,121,11,0.12)",
                    backdropFilter: "blur(18px) saturate(140%)",
                    WebkitBackdropFilter: "blur(18px) saturate(140%)",
                  }
                : undefined
            }
          >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
                style={
                  !isScrolled
                    ? { filter: "drop-shadow(0 0 14px rgba(217,121,11,0.45))" }
                    : undefined
                }
              >
                <Image
                  src="/images/logo.png"
                  alt="CourseIntellect Logo"
                  width={isScrolled ? 36 : 34}
                  height={isScrolled ? 36 : 34}
                  className="transition-all duration-300"
                />
              </motion.div>
              <span
                className={cn(
                  "font-bold transition-all duration-300",
                  isScrolled ? "text-lg" : "text-[17px]",
                )}
              >
                <span className={isScrolled ? "text-primary" : "text-white"}>
                  {navContent.logoText.split("Intellect")[0]}
                </span>
                <span className="text-accent">Intellect</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navContent.links.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    className={cn(
                      "relative px-4 py-2 text-sm font-medium transition-colors rounded-lg",
                      isScrolled
                        ? active
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary hover:bg-secondary"
                        : active
                          ? "text-[#FBB971]"
                          : "text-white/75 hover:text-white",
                    )}
                  >
                    {link.label}
                    {active && (
                      <motion.div
                        layoutId="navbar-indicator"
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* CTA Button & Language Switcher */}
            <div className="hidden lg:flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="navbar-language-trigger"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2",
                      !isScrolled && "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    {language === "tr" ? "TR" : "EN"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLanguage("tr")}>Türkçe</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage("en")}>English</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isAuthenticated ? (
                <span
                  className={cn(
                    "text-sm px-3",
                    isScrolled ? "text-muted-foreground" : "text-white/75",
                  )}
                >
                  {user?.name}
                </span>
              ) : (
                <Link href="/giris">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      isScrolled
                        ? "text-muted-foreground hover:text-primary"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {t.login[language]}
                  </Button>
                </Link>
              )}
              <Link href={navContent.ctaButton.href}>
                <Button
                  size="sm"
                  className={cn(
                    "relative overflow-hidden group font-semibold",
                    isScrolled
                      ? "bg-accent hover:bg-accent/90 text-accent-foreground"
                      : "bg-[#D9790B] hover:bg-[#F08C1E] text-[#00354F] shadow-[0_8px_22px_-8px_rgba(217,121,11,0.7)]",
                  )}
                >
                  <span className="relative z-10">{navContent.ctaButton.text}</span>
                  <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "lg:hidden p-2 rounded-lg transition-colors",
                isScrolled
                  ? "text-foreground hover:bg-secondary"
                  : "text-white border border-[#D9790B]/30 hover:bg-white/10",
              )}
              aria-label="Menüyü aç/kapat"
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-6 h-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-background border-l border-border shadow-2xl"
            >
              <div className="flex flex-col h-full pt-20 pb-8 px-6">
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={language === "tr" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLanguage("tr")}
                    className="flex-1"
                  >
                    Türkçe
                  </Button>
                  <Button
                    variant={language === "en" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLanguage("en")}
                    className="flex-1"
                  >
                    English
                  </Button>
                </div>

                <nav className="flex-1 space-y-2">
                  {navContent.links.map((link, index) => (
                    <motion.div
                      key={link.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium transition-colors",
                          isActive(link.href)
                            ? "bg-secondary text-primary"
                            : "text-muted-foreground hover:bg-secondary hover:text-primary",
                        )}
                      >
                        {link.label}
                        {isActive(link.href) && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </Link>
                    </motion.div>
                  ))}
                </nav>

                <div className="space-y-3 pt-6 border-t border-border">
                  <Link href="/giris" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full bg-transparent">
                      {t.login[language]}
                    </Button>
                  </Link>
                  <Link href={navContent.ctaButton.href} onClick={() => setIsMobileMenuOpen(false)}>
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                      {navContent.ctaButton.text}
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
