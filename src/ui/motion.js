import { useReducedMotion } from 'framer-motion';

export const motionTiming = {
  fast: {
    duration: 0.18,
    ease: [0.2, 0, 0.2, 1],
  },
  page: {
    duration: 0.2,
    ease: [0.2, 0, 0.2, 1],
  },
  standard: {
    duration: 0.22,
    ease: [0.2, 0, 0.2, 1],
  },
};

export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const modalVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const toastVariants = {
  initial: { opacity: 0, x: 24, y: 8 },
  animate: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, x: 24, y: 8 },
};

export const successVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
};

export const useMotionSafeVariants = (variants) => {
  const shouldReduceMotion = useReducedMotion();

  if (!shouldReduceMotion) {
    return variants;
  }

  return Object.fromEntries(
    Object.entries(variants).map(([key, value]) => [
      key,
      {
        ...value,
        x: 0,
        y: 0,
        scale: 1,
      },
    ])
  );
};
