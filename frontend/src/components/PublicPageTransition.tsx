import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const PublicPageTransition = ({ children }: { children: ReactNode }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.992 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.988 }}
      transition={{
        duration: reduceMotion ? 0.16 : 0.32,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
};

export default PublicPageTransition;
