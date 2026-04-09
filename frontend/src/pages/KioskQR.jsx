import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Lock, Unlock, RotateCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import logo from '../assets/brand/logo.png';

export default function KioskQR() {
  const [isLocked, setIsLocked] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [countdown, setCountdown] = useState(60);

  const generateQR = () => {
    // Generate a random session ID
    const sessionId = Math.random().toString(36).substring(2, 15);
    setQrCode(`courseintellect://attendance/${sessionId}`);
    setCountdown(60);
  };

  useEffect(() => {
    generateQR();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      generateQR();
    }
  }, [countdown]);

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-primary ${isLocked ? 'cursor-none' : ''}`}
      data-testid="kiosk-qr-page"
    >
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-8 left-8 flex items-center gap-3"
      >
        <img src={logo} alt="CourseIntellect" className="h-12 w-12" />
        <span className="text-2xl font-heading font-bold text-white">CourseIntellect</span>
      </motion.div>

      {/* Controls */}
      {!isLocked && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-8 right-8 flex gap-2"
        >
          <Button 
            variant="outline" 
            size="icon"
            onClick={generateQR}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={toggleLock}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <Lock className="h-5 w-5" />
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.history.back()}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Çıkış
          </Button>
        </motion.div>
      )}

      {/* QR Code */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative"
      >
        {/* Pulse Ring */}
        <div className="absolute inset-0 -m-8">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.1, 0.3]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="w-full h-full rounded-3xl bg-brand-accent"
          />
        </div>

        {/* QR Container */}
        <div className="relative bg-white p-8 rounded-3xl shadow-2xl">
          {/* Fake QR Code Display */}
          <div className="w-64 h-64 bg-white flex items-center justify-center">
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: 64 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-6 h-6 ${Math.random() > 0.5 ? 'bg-brand-primary' : 'bg-white'} rounded-sm`}
                />
              ))}
            </div>
          </div>
          
          {/* Timer */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">Yeni kod:</p>
            <p className="text-2xl font-bold text-brand-primary">{countdown}s</p>
          </div>
        </div>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-12 text-center text-white"
      >
        <h2 className="text-3xl font-heading font-bold mb-4">Yoklama için QR Kodu Taratın</h2>
        <p className="text-lg text-white/80">Telefonunuzdaki CourseIntellect uygulamasını açın</p>
        <p className="text-lg text-white/80">ve QR kodu tarayarak yoklamanızı onaylayın.</p>
      </motion.div>

      {/* Lock Overlay */}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-8 right-8"
          onClick={toggleLock}
        >
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white/30 hover:text-white hover:bg-white/10"
          >
            <Unlock className="h-6 w-6" />
          </Button>
        </motion.div>
      )}

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-8 text-white/50 text-sm"
      >
        © 2025 CourseIntellect - Kiosk Modu
      </motion.p>
    </div>
  );
}
