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
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isScrolled ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border" : "bg-transparent",
        )}
      >
        <nav className="container mx-auto px-4 lg:px-8">
          <div
            className={cn(
              "flex items-center justify-between transition-all duration-300",
              isScrolled ? "h-16" : "h-20",
            )}
          >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 400 }}>
                <Image
                  src="/images/logo.png"
                  alt="CourseIntellect Logo"
                  width={isScrolled ? 40 : 48}
                  height={isScrolled ? 40 : 48}
                  className="transition-all duration-300"
                />
              </motion.div>
              <span
                className={cn(
                  "font-bold transition-all duration-300",
                  isScrolled ? "text-lg" : "text-xl",
                  "text-primary",
                )}
              >
                <span className="text-primary">{navContent.logoText.split("Intellect")[0]}</span>
                <span className="text-accent">Intellect</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navContent.links.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium transition-colors rounded-lg",
                    isActive(link.href)
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary hover:bg-secondary",
                  )}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* CTA Button & Language Switcher */}
            <div className="hidden lg:flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button id="navbar-language-trigger" variant="ghost" size="sm" className="gap-2">
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
                <span className="text-sm text-muted-foreground px-3">
                  {user?.name}
                </span>
              ) : (
                <Link href="/giris">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                    {t.login[language]}
                  </Button>
                </Link>
              )}
              <Link href={navContent.ctaButton.href}>
                <Button
                  size="sm"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground relative overflow-hidden group"
                >
                  <span className="relative z-10">{navContent.ctaButton.text}</span>
                  <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
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
