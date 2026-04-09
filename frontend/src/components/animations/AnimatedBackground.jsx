import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// Floating particles for background
export function FloatingParticles({ count = 20, colors = ['#D9790B', '#00354F', '#22c55e'] }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full opacity-20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Animated gradient background
export function AnimatedGradient({ className = '' }) {
  return (
    <motion.div
      className={`absolute inset-0 ${className}`}
      animate={{
        background: [
          'linear-gradient(45deg, rgba(0,53,79,0.05) 0%, rgba(217,121,11,0.05) 100%)',
          'linear-gradient(90deg, rgba(217,121,11,0.05) 0%, rgba(0,53,79,0.05) 100%)',
          'linear-gradient(135deg, rgba(0,53,79,0.05) 0%, rgba(217,121,11,0.05) 100%)',
          'linear-gradient(180deg, rgba(217,121,11,0.05) 0%, rgba(0,53,79,0.05) 100%)',
          'linear-gradient(45deg, rgba(0,53,79,0.05) 0%, rgba(217,121,11,0.05) 100%)',
        ],
      }}
      transition={{
        duration: 15,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Pulse ring effect
export function PulseRing({ color = '#D9790B', size = 100 }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2"
          style={{
            width: size,
            height: size,
            borderColor: color,
          }}
          animate={{
            scale: [1, 2, 2.5],
            opacity: [0.5, 0.2, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// Confetti effect for celebrations
export function Confetti({ active = false, duration = 3000 }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (active) {
      const colors = ['#D9790B', '#00354F', '#22c55e', '#eab308', '#ef4444', '#3b82f6'];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        size: Math.random() * 8 + 4,
      }));
      setParticles(newParticles);
      
      setTimeout(() => setParticles([]), duration);
    }
  }, [active, duration]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
          initial={{ y: 0, rotate: 0, opacity: 1 }}
          animate={{
            y: window.innerHeight + 50,
            rotate: p.rotation + 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 3,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      ))}
    </div>
  );
}

// Glowing orb effect
export function GlowingOrb({ color = '#D9790B', size = 200, className = '' }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        opacity: 0.15,
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.1, 0.2, 0.1],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
