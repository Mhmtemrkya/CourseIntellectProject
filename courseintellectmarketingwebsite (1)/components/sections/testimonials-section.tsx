"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Quote, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSectionContent } from "@/context/content-context"

export function TestimonialsSection() {
  const { testimonials } = useSectionContent("homepage")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1)
      setCurrentIndex((prev) => (prev + 1) % testimonials.items.length)
    }, 6000)

    return () => clearInterval(timer)
  }, [testimonials.items.length])

  const navigate = (newDirection: number) => {
    setDirection(newDirection)
    setCurrentIndex((prev) => {
      if (newDirection === 1) {
        return (prev + 1) % testimonials.items.length
      }
      return prev === 0 ? testimonials.items.length - 1 : prev - 1
    })
  }

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 200 : -200,
      opacity: 0,
    }),
  }

  return (
    <section className="py-24 bg-primary text-primary-foreground overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{testimonials.sectionTitle}</h2>
          <p className="text-lg text-primary-foreground/70 max-w-2xl mx-auto">{testimonials.sectionSubtitle}</p>
        </motion.div>

        {/* Testimonial Carousel */}
        <div className="max-w-4xl mx-auto relative">
          <div className="relative min-h-[300px] flex items-center">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute inset-0 flex flex-col items-center text-center px-8"
              >
                {/* Quote Icon */}
                <Quote className="w-12 h-12 text-accent mb-6" />

                {/* Quote Text */}
                <blockquote className="text-xl md:text-2xl font-medium mb-8 leading-relaxed">
                  &ldquo;{testimonials.items[currentIndex].quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-accent">
                      {testimonials.items[currentIndex].name.charAt(0)}
                    </span>
                  </div>
                  <div className="font-semibold text-lg">{testimonials.items[currentIndex].name}</div>
                  <div className="text-primary-foreground/70">
                    {testimonials.items[currentIndex].role}
                    {testimonials.items[currentIndex].company && ` - ${testimonials.items[currentIndex].company}`}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {testimonials.items.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > currentIndex ? 1 : -1)
                    setCurrentIndex(index)
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex ? "w-8 bg-accent" : "bg-primary-foreground/30 hover:bg-primary-foreground/50"
                  }`}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(1)}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
