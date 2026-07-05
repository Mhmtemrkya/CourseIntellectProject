"use client"

import { ScrollVideoStage } from "@/components/sections/scroll-video-stage"
import { CinematicStats } from "@/components/sections/cinematic-stats"
import { ModulesShowcase } from "@/components/sections/modules-showcase"
import { SecurityTrust } from "@/components/sections/security-trust"
import { HorizontalFeaturesTour } from "@/components/sections/horizontal-features-tour"
import { CinematicPlatforms } from "@/components/sections/cinematic-platforms"
import { HowItWorksSection } from "@/components/sections/how-it-works-section"
import { TestimonialsSection } from "@/components/sections/testimonials-section"
import { FAQSection } from "@/components/sections/faq-section"
import { CTASection } from "@/components/sections/cta-section"

export default function HomePage() {
  return (
    <>
      <ScrollVideoStage />
      <CinematicStats />
      <HorizontalFeaturesTour />
      <ModulesShowcase />
      <CinematicPlatforms />
      <HowItWorksSection />
      <SecurityTrust />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </>
  )
}
