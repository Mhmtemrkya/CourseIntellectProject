import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, RotateCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import logo from '../assets/brand/logo.png';
import { useApp } from '../context/AppContext';
import { openAttendanceQrSession } from '../lib/api/modules';

export default function KioskQR() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [isLocked, setIsLocked] = useState(false);
  const [session, setSession] = useState(null);
  const [countdown, setCountdown] = useState(900);
  const [error, setError] = useState('');

  const generateQR = useCallback(async () => {
    try {
      setError('');
      const opened = await openAttendanceQrSession({
        className: user?.className || 'Tum Kurum',
        lessonTitle: 'QR Yoklama',
        durationMinutes: 15,
      });
      setSession(opened || null);
      const expiresAt = opened?.expiresAtUtc ? new Date(opened.expiresAtUtc).getTime() : Date.now() + 900_000;
      setCountdown(Math.max(1, Math.round((expiresAt - Date.now()) / 1000)));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'QR oturumu açılamadı.');
    }
  }, [user?.className]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    generateQR();
    return undefined;
  }, [countdown, generateQR]);

  const qrPayload = session?.token ? `courseintellect://attendance/${session.token}` : '';

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
            onClick={() => navigate('/attendance')}
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
          <div className="w-64 h-64 bg-white flex items-center justify-center">
            {qrPayload ? (
              <img
                alt="QR Yoklama"
                className="w-64 h-64"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrPayload)}`}
              />
            ) : (
              <div className="text-xs text-muted-foreground text-center">QR oturumu hazırlanıyor...</div>
            )}
          </div>

          {/* Timer */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">Süre:</p>
            <p className="text-2xl font-bold text-brand-primary">{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
            {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
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
