import { motion, useSpring, useTransform, useMotionValue, animate } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

// Animated Number Counter
export function AnimatedCounter({ value, duration = 2, className = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const controls = animate(previousValue.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayValue(Math.round(v)),
    });
    
    previousValue.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return (
    <motion.span
      className={className}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 0.3 }}
      key={value}
    >
      {displayValue.toLocaleString('tr-TR')}
    </motion.span>
  );
}

// Circular Progress Ring
export function CircularProgress({ 
  value, 
  size = 120, 
  strokeWidth = 8, 
  color = '#D9790B',
  bgColor = '#e5e7eb',
  showValue = true,
  label = '',
  className = ''
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            {value}%
          </motion.span>
          {label && (
            <span className="text-xs text-muted-foreground mt-1">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Score Reveal Animation
export function ScoreReveal({ score, maxScore = 100, className = '' }) {
  const [revealed, setRevealed] = useState(false);
  const percentage = (score / maxScore) * 100;

  useEffect(() => {
    setTimeout(() => setRevealed(true), 500);
  }, []);

  const getColor = () => {
    if (percentage >= 80) return '#22c55e';
    if (percentage >= 60) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className={`text-center ${className}`}>
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative inline-block"
      >
        <CircularProgress
          value={revealed ? percentage : 0}
          size={160}
          strokeWidth={12}
          color={getColor()}
          showValue={false}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <span className="text-4xl font-bold" style={{ color: getColor() }}>
              {revealed ? score : '?'}
            </span>
            <span className="text-lg text-muted-foreground">/{maxScore}</span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// Streak Counter
export function StreakCounter({ streak, className = '' }) {
  return (
    <motion.div
      className={`flex items-center gap-2 ${className}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    >
      <motion.div
        className="text-3xl"
        animate={{ 
          rotate: [0, -10, 10, -10, 10, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
      >
        🔥
      </motion.div>
      <div>
        <AnimatedCounter value={streak} className="text-2xl font-bold text-orange-500" />
        <p className="text-sm text-muted-foreground">Gün Serisi</p>
      </div>
    </motion.div>
  );
}

// XP Bar
export function XPBar({ current, max, level, className = '' }) {
  const percentage = (current / max) * 100;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <motion.div
          className="flex items-center gap-2"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <motion.span
            className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Seviye {level}
          </motion.span>
        </motion.div>
        <span className="text-sm text-muted-foreground">
          {current}/{max} XP
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
