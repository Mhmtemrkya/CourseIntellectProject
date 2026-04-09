"use client"
import { motion } from "framer-motion"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface PageLoaderProps {
  variant?:
    | "home"
    | "features"
    | "pricing"
    | "download"
    | "contact"
    | "legal"
    | "login"
    | "admin"
    | "translations"
    | "users"
    | "messages"
    | "content"
  title?: string
  subtitle?: string
  className?: string
}

export function PageLoader({ variant = "home", title, subtitle, className }: PageLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 overflow-hidden",
        className,
      )}
    >
      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, var(--primary) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Ambient glow effects */}
      <motion.div
        className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1 }}
      />

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-10">
        {/* Logo section with elegant animation */}
        <div className="relative">
          {/* Outer decorative ring */}
          <motion.div
            className="absolute -inset-8 rounded-full border border-primary/10"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {/* Animated arc */}
          <motion.svg
            className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)]"
            viewBox="0 0 120 120"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.circle
              cx="60"
              cy="60"
              r="56"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="90 270"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          {/* Secondary arc - counter rotation */}
          <motion.svg
            className="absolute -inset-4 w-[calc(100%+32px)] h-[calc(100%+32px)]"
            viewBox="0 0 110 110"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <motion.circle
              cx="55"
              cy="55"
              r="52"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="60 280"
              initial={{ rotate: 0 }}
              animate={{ rotate: -360 }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          {/* Logo container */}
          <motion.div
            className="relative w-24 h-24 rounded-full bg-background shadow-xl border border-border/50 flex items-center justify-center overflow-hidden"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          >
            {/* Inner glow */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />

            {/* Logo */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Orbiting particles */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 6 + i * 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
              style={{ transformOrigin: "center" }}
            >
              <motion.div
                className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-accent" : i === 1 ? "bg-primary" : "bg-accent/60")}
                style={{
                  transform: `translateX(${50 + i * 12}px)`,
                }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: i * 0.3 }}
              />
            </motion.div>
          ))}
        </div>

        {/* Brand text */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <div className="flex items-center text-2xl font-semibold tracking-tight">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>

          {title && (
            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {title}
            </motion.p>
          )}
        </motion.div>

        {/* Elegant loading indicator */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {/* Progress bar */}
          <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              style={{ width: "50%" }}
            />
          </div>

          {/* Subtle dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export function LoginLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden"
    >
      {/* Elegant background pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full">
            <defs>
              <pattern id="loginGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1" fill="var(--primary)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#loginGrid)" />
          </svg>
        </div>
      </div>

      {/* Floating elements */}
      <motion.div
        className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full border border-primary/5"
        animate={{ scale: [1, 1.1, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      />
      <motion.div
        className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full border border-accent/5"
        animate={{ scale: [1.1, 1, 1.1], rotate: [0, -90, 0] }}
        transition={{ duration: 15, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      />

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-12">
        {/* Large prominent logo */}
        <motion.div
          className="relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 15 }}
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute -inset-12 rounded-full"
            style={{
              background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
              opacity: 0.1,
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />

          {/* Rotating rings */}
          <motion.svg className="absolute -inset-10 w-[calc(100%+80px)] h-[calc(100%+80px)]" viewBox="0 0 180 180">
            <motion.circle
              cx="90"
              cy="90"
              r="85"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="0.5"
              strokeDasharray="20 40"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          <motion.svg className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)]" viewBox="0 0 150 150">
            <motion.circle
              cx="75"
              cy="75"
              r="70"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="80 200"
              animate={{ rotate: -360 }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          {/* Logo container with glass effect */}
          <motion.div
            className="relative w-32 h-32 rounded-full bg-background/80 backdrop-blur-sm shadow-2xl border border-border/30 flex items-center justify-center"
            animate={{
              boxShadow: [
                "0 25px 50px -12px rgba(0,53,79,0.15)",
                "0 25px 50px -12px rgba(217,121,11,0.15)",
                "0 25px 50px -12px rgba(0,53,79,0.15)",
              ],
            }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={90}
                height={90}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Orbiting key icon */}
          <motion.div
            className="absolute top-1/2 left-1/2"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            style={{ transformOrigin: "center" }}
          >
            <motion.div
              className="w-8 h-8 -ml-4 -mt-4 rounded-full bg-accent/90 flex items-center justify-center shadow-lg"
              style={{ transform: "translateX(75px)" }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Brand text */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex items-center text-3xl font-bold tracking-tight">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>

          <motion.p
            className="text-muted-foreground text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Güvenli giriş hazırlanıyor...
          </motion.p>
        </motion.div>

        {/* Elegant loader */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="w-56 h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              style={{ width: "40%" }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export function FeaturesLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden"
    >
      {/* Neural network background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Neural nodes */}
        {[...Array(20)].map((_, i) => {
          const x = Math.random() * 100
          const y = Math.random() * 100
          return (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary/20"
              style={{ left: `${x}%`, top: `${y}%` }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: Math.random() * 2,
              }}
            />
          )
        })}

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          {[...Array(15)].map((_, i) => (
            <motion.line
              key={i}
              x1={`${Math.random() * 100}%`}
              y1={`${Math.random() * 100}%`}
              x2={`${Math.random() * 100}%`}
              y2={`${Math.random() * 100}%`}
              stroke="var(--accent)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 0.5, 0] }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.2,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-10">
        <div className="relative">
          {/* DNA-like double helix around logo */}
          <motion.svg className="absolute -inset-12 w-[calc(100%+96px)] h-[calc(100%+96px)]" viewBox="0 0 200 200">
            {[...Array(12)].map((_, i) => {
              const angle = (i / 12) * Math.PI * 2
              const radius = 80
              return (
                <motion.circle
                  key={i}
                  cx={100 + Math.cos(angle) * radius}
                  cy={100 + Math.sin(angle) * radius}
                  r="4"
                  fill="var(--accent)"
                  animate={{
                    cx: [100 + Math.cos(angle) * radius, 100 + Math.cos(angle + Math.PI) * radius],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              )
            })}
            {[...Array(12)].map((_, i) => {
              const angle = (i / 12) * Math.PI * 2 + Math.PI
              const radius = 80
              return (
                <motion.circle
                  key={`b-${i}`}
                  cx={100 + Math.cos(angle) * radius}
                  cy={100 + Math.sin(angle) * radius}
                  r="4"
                  fill="var(--primary)"
                  animate={{
                    cx: [100 + Math.cos(angle) * radius, 100 + Math.cos(angle + Math.PI) * radius],
                    opacity: [1, 0.3, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              )
            })}
          </motion.svg>

          {/* Logo container */}
          <motion.div
            className="relative w-28 h-28 rounded-full bg-background shadow-2xl border border-border/50 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center text-2xl font-semibold">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>
          <p className="text-sm text-muted-foreground">Özellikler keşfediliyor...</p>
        </motion.div>

        <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent via-primary to-accent rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export function PricingLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-background to-emerald-50/30 dark:to-emerald-950/10 overflow-hidden"
    >
      {/* Floating value indicators */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-emerald-500/20 font-bold text-2xl"
            style={{ left: `${10 + i * 12}%` }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{
              y: [100, -100],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5,
              ease: "easeOut",
            }}
          >
            ₺
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-10">
        <div className="relative">
          {/* Value rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border-2 border-emerald-500/20"
              style={{
                inset: `-${(i + 1) * 16}px`,
              }}
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.3,
              }}
            />
          ))}

          {/* Rotating arc */}
          <motion.svg className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)]" viewBox="0 0 140 140">
            <motion.circle
              cx="70"
              cy="70"
              r="65"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="80 200"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          {/* Logo container */}
          <motion.div
            className="relative w-28 h-28 rounded-full bg-background shadow-2xl border border-emerald-200 dark:border-emerald-800/30 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Orbiting coin */}
          <motion.div
            className="absolute top-1/2 left-1/2"
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          >
            <motion.div
              className="w-8 h-8 -ml-4 -mt-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg"
              style={{ transform: "translateX(70px)" }}
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <span className="text-amber-900 text-xs font-bold">₺</span>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center text-2xl font-semibold">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>
          <p className="text-sm text-muted-foreground">Fiyatlar hesaplanıyor...</p>
        </motion.div>

        <div className="w-48 h-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 via-accent to-emerald-500 rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export function DownloadLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-background to-blue-50/30 dark:to-blue-950/10 overflow-hidden"
    >
      {/* Download streaks */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 bg-gradient-to-b from-blue-500/40 to-transparent"
            style={{
              left: `${5 + i * 10}%`,
              height: "60px",
            }}
            animate={{ y: ["-10%", "110%"], opacity: [0, 1, 0] }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.15,
              ease: "easeIn",
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-10">
        <div className="relative">
          {/* Download progress ring */}
          <motion.svg className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)]" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="65" fill="none" stroke="var(--secondary)" strokeWidth="4" />
            <motion.circle
              cx="70"
              cy="70"
              r="65"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="408"
              initial={{ strokeDashoffset: 408 }}
              animate={{ strokeDashoffset: [408, 0, 408] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
            />
          </motion.svg>

          {/* Logo container */}
          <motion.div
            className="relative w-28 h-28 rounded-full bg-background shadow-2xl border border-blue-200 dark:border-blue-800/30 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
          >
            <motion.div animate={{ y: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}>
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Download icon */}
          <motion.div
            className="absolute -bottom-3 left-1/2 -ml-5 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center text-2xl font-semibold">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>
          <p className="text-sm text-muted-foreground">İndirme hazırlanıyor...</p>
        </motion.div>

        <div className="w-48 h-1 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-accent to-blue-500 rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export function ContactLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-background via-background to-rose-50/20 dark:to-rose-950/10 overflow-hidden"
    >
      {/* Floating envelopes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${15 + i * 18}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            initial={{ scale: 0, rotate: -20, opacity: 0 }}
            animate={{
              scale: [0.8, 1, 0.8],
              rotate: [-10, 10, -10],
              opacity: [0.1, 0.3, 0.1],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5,
            }}
          >
            <svg className="w-8 h-8 text-accent/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-10">
        <div className="relative">
          {/* Pulsing rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-accent/20"
              style={{ inset: `-${(i + 1) * 14}px` }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.1, 0.3, 0.1],
              }}
              transition={{
                duration: 2.5,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.4,
              }}
            />
          ))}

          {/* Arc */}
          <motion.svg className="absolute -inset-6 w-[calc(100%+48px)] h-[calc(100%+48px)]" viewBox="0 0 140 140">
            <motion.circle
              cx="70"
              cy="70"
              r="65"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="70 210"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          {/* Logo container */}
          <motion.div
            className="relative w-28 h-28 rounded-full bg-background shadow-2xl border border-rose-200/50 dark:border-rose-800/20 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Mail icon */}
          <motion.div
            className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-accent flex items-center justify-center shadow-lg"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center text-2xl font-semibold">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>
          <p className="text-sm text-muted-foreground">İletişim sayfası yükleniyor...</p>
        </motion.div>

        <div className="w-48 h-1 bg-rose-100 dark:bg-rose-900/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent via-rose-400 to-accent rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export function LegalLoader({ title = "Sayfa yükleniyor..." }: { title?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-background to-slate-50/50 dark:to-slate-900/20 overflow-hidden"
    >
      {/* Document lines background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5">
        <div className="w-64 space-y-3">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="h-2 bg-primary rounded"
              style={{ width: `${60 + Math.random() * 40}%` }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-10">
        <div className="relative">
          {/* Shield glow */}
          <motion.div
            className="absolute -inset-10 rounded-full bg-primary/5"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
          />

          {/* Arc */}
          <motion.svg className="absolute -inset-5 w-[calc(100%+40px)] h-[calc(100%+40px)]" viewBox="0 0 130 130">
            <motion.circle
              cx="65"
              cy="65"
              r="60"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1.5"
              strokeDasharray="60 200"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          {/* Logo container */}
          <motion.div
            className="relative w-24 h-24 rounded-full bg-background shadow-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
          >
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
            >
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={64}
                height={64}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Shield icon */}
          <motion.div
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center text-2xl font-semibold">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>
          <p className="text-sm text-muted-foreground">{title}</p>
        </motion.div>

        <div className="w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export function AdminLoader({ title = "Panel yükleniyor..." }: { title?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden"
    >
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Dashboard grid animation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="grid grid-cols-4 gap-2 opacity-10">
          {[...Array(16)].map((_, i) => (
            <motion.div
              key={i}
              className="w-10 h-10 rounded bg-primary/30"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-10">
        <div className="relative">
          {/* Rotating arcs */}
          <motion.svg className="absolute -inset-8 w-[calc(100%+64px)] h-[calc(100%+64px)]" viewBox="0 0 160 160">
            <motion.circle
              cx="80"
              cy="80"
              r="75"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              strokeDasharray="30 60"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          <motion.svg className="absolute -inset-5 w-[calc(100%+40px)] h-[calc(100%+40px)]" viewBox="0 0 140 140">
            <motion.circle
              cx="70"
              cy="70"
              r="65"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="60 180"
              strokeLinecap="round"
              animate={{ rotate: -360 }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </motion.svg>

          {/* Logo container */}
          <motion.div
            className="relative w-28 h-28 rounded-2xl bg-background shadow-2xl border border-border flex items-center justify-center"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <Image
                src="/images/logo.png"
                alt="CourseIntellect"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Dashboard icon */}
          <motion.div
            className="absolute -bottom-2 -right-2 w-10 h-10 rounded-lg bg-accent flex items-center justify-center shadow-lg"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center text-2xl font-semibold">
            <span className="text-primary">Course</span>
            <span className="text-accent">Intellect</span>
          </div>
          <p className="text-sm text-muted-foreground">{title}</p>
        </motion.div>

        <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </motion.div>
  )
}
