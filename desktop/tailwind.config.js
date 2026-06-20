/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        background: 'hsl(var(--background) / <alpha-value>)',
                        foreground: 'hsl(var(--foreground) / <alpha-value>)',
                        card: {
                                DEFAULT: 'hsl(var(--card) / <alpha-value>)',
                                foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
                                foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
                                foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
                                foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
                                foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
                                foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
                                foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
                        },
                        border: 'hsl(var(--border) / <alpha-value>)',
                        input: 'hsl(var(--input) / <alpha-value>)',
                        ring: 'hsl(var(--ring) / <alpha-value>)',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        },
                        // CourseIntellect Brand Colors — dinamik tenant tema desteği
                        brand: {
                                primary: 'hsl(var(--brand-primary) / <alpha-value>)',
                                accent: 'hsl(var(--brand-accent) / <alpha-value>)',
                        }
                },
                fontFamily: {
                        heading: ['Poppins', 'Inter', 'sans-serif'],
                        sans: ['Inter', 'sans-serif'],
                },
                boxShadow: {
                        'card': '0 2px 8px rgba(0, 53, 79, 0.08)',
                        'card-hover': '0 8px 24px rgba(0, 53, 79, 0.12)',
                },
                keyframes: {
                        'accordion-down': {
                                from: { height: '0' },
                                to: { height: 'var(--radix-accordion-content-height)' }
                        },
                        'accordion-up': {
                                from: { height: 'var(--radix-accordion-content-height)' },
                                to: { height: '0' }
                        },
                        'fade-in': {
                                from: { opacity: '0' },
                                to: { opacity: '1' }
                        },
                        'slide-in-right': {
                                from: { transform: 'translateX(100%)' },
                                to: { transform: 'translateX(0)' }
                        },
                        'slide-in-left': {
                                from: { transform: 'translateX(-100%)' },
                                to: { transform: 'translateX(0)' }
                        },
                        'scale-in': {
                                from: { transform: 'scale(0.95)', opacity: '0' },
                                to: { transform: 'scale(1)', opacity: '1' }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'fade-in': 'fade-in 0.2s ease-out',
                        'slide-in-right': 'slide-in-right 0.3s ease-out',
                        'slide-in-left': 'slide-in-left 0.3s ease-out',
                        'scale-in': 'scale-in 0.2s ease-out'
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
