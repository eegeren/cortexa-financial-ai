import { useEffect, useState } from 'react';
import BrandWordmark from '@/components/BrandWordmark';

interface SplashScreenProps {
  onDone: () => void;
}

const EXIT_DELAY = 1350;
const DONE_DELAY = 1750;

const SplashScreen = ({ onDone }: SplashScreenProps) => {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = window.setTimeout(() => setVisible(true), 40);
    const exitTimer = window.setTimeout(() => setExiting(true), EXIT_DELAY);
    const doneTimer = window.setTimeout(onDone, DONE_DELAY);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-slate-950 transition-opacity duration-500 ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`flex flex-col items-center gap-5 transition-all duration-700 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <BrandWordmark className="text-2xl sm:text-3xl" />

        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-slate-600"
              style={{ animation: `brandPulse 1.2s ease-in-out infinite ${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes brandPulse {
          0%, 80%, 100% { opacity: 0.22; transform: scale(1); }
          40% { opacity: 0.9; transform: scale(1.18); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
