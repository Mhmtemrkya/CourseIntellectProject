import { motion } from 'framer-motion';

// Bouncing Icon
export function BouncingIcon({ icon: Icon, className = '', color = 'currentColor', size = 24 }) {
  return (
    <motion.div
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    >
      <Icon size={size} color={color} />
    </motion.div>
  );
}

// Spinning Icon
export function SpinningIcon({ icon: Icon, className = '', color = 'currentColor', size = 24, speed = 2 }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
      className={className}
    >
      <Icon size={size} color={color} />
    </motion.div>
  );
}

// Pulsing Icon
export function PulsingIcon({ icon: Icon, className = '', color = 'currentColor', size = 24 }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    >
      <Icon size={size} color={color} />
    </motion.div>
  );
}

// Wiggle Icon
export function WiggleIcon({ icon: Icon, className = '', color = 'currentColor', size = 24 }) {
  return (
    <motion.div
      animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
      className={className}
    >
      <Icon size={size} color={color} />
    </motion.div>
  );
}

// Floating Icon with Shadow
export function FloatingIcon({ icon: Icon, className = '', color = 'currentColor', size = 24 }) {
  return (
    <div className="relative">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className={className}
      >
        <Icon size={size} color={color} />
      </motion.div>
      <motion.div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/20 rounded-full blur-sm"
        animate={{ scale: [1, 0.8, 1], opacity: [0.3, 0.15, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// Attention Grabbing Icon
export function AttentionIcon({ icon: Icon, className = '', color = '#D9790B', size = 24 }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <motion.div
        className="absolute rounded-full"
        style={{ 
          width: size + 20, 
          height: size + 20, 
          backgroundColor: color,
          opacity: 0.2 
        }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={className}
      >
        <Icon size={size} color={color} />
      </motion.div>
    </div>
  );
}

// Success Check Animation
export function AnimatedCheck({ size = 24, color = '#22c55e', className = '' }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      initial="hidden"
      animate="visible"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke={color}
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.path
        d="M6 12l4 4 8-8"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      />
    </motion.svg>
  );
}

// Loading Spinner with Dots
export function LoadingDots({ color = '#D9790B', size = 8 }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
          animate={{ y: [0, -10, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}
