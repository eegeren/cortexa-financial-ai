import { motion, useReducedMotion } from 'framer-motion';

const LETTERS = 'CORTEXA'.split('');
const BASE_COLOR = '#17324d';
const MID_COLOR = '#26496d';
const HIGHLIGHT_COLOR = '#8fb8df';

interface CortexaWordmarkProps {
  className?: string;
  compact?: boolean;
}

const CortexaWordmark = ({ className = '', compact = false }: CortexaWordmarkProps) => {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={`relative inline-flex overflow-hidden rounded-full border border-[#27486a]/35 bg-[rgba(9,16,28,0.72)] px-4 py-2 text-center shadow-[0_16px_36px_rgba(2,8,23,0.24)] backdrop-saturate-150 ${compact ? 'sm:px-3.5 sm:py-1.5' : 'sm:px-5 sm:py-2.5'} ${className}`}
      aria-label="CORTEXA"
    >
      {!reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-[18%] left-[-18%] w-[28%] rounded-full bg-[linear-gradient(90deg,rgba(143,184,223,0),rgba(143,184,223,0.24),rgba(143,184,223,0))] blur-md"
          animate={{ x: ['0%', '460%'] }}
          transition={{ duration: 3.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.55 }}
        />
      )}

      <span
        className={`relative inline-flex items-center font-semibold uppercase tracking-[0.36em] ${compact ? 'text-[0.72rem] sm:text-[0.78rem]' : 'text-[0.8rem] sm:text-[0.92rem]'}`}
      >
        {LETTERS.map((letter, index) => (
          <motion.span
            key={`${letter}-${index}`}
            className="inline-block last:mr-[-0.36em]"
            style={{ color: BASE_COLOR }}
            animate={
              reduceMotion
                ? undefined
                : {
                    y: [0, -1.5, 0],
                    color: [BASE_COLOR, MID_COLOR, HIGHLIGHT_COLOR, MID_COLOR, BASE_COLOR],
                    textShadow: [
                      '0 0 0 rgba(143,184,223,0)',
                      '0 0 0 rgba(143,184,223,0)',
                      '0 0 16px rgba(143,184,223,0.22)',
                      '0 0 8px rgba(143,184,223,0.14)',
                      '0 0 0 rgba(143,184,223,0)',
                    ],
                  }
            }
            transition={{
              duration: 2.8,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatDelay: 0.32,
              delay: index * 0.14,
            }}
          >
            {letter}
          </motion.span>
        ))}
      </span>
    </div>
  );
};

export default CortexaWordmark;
