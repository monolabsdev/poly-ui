import { useReducedMotion } from "motion/react";

/**
 * Premium motion tokens inspired by Linear, Raycast, and Arc.
 * Fast, crisp, and subtle.
 */
export const MOTION_TOKENS = {
  duration: {
    fast: 0.12,
    base: 0.18,
    slow: 0.28,
  },
  ease: {
    // Standard "out" curve for entrances and state changes
    out: [0.2, 0.8, 0.2, 1],
    // "in-out" curve for smooth transitions between two states
    inOut: [0.4, 0, 0.2, 1],
    // Subtle spring-like feel without exaggerated bounce
    spring: [0.17, 0.67, 0.83, 0.67],
  },
} as const;

export const ANIMATION_VARIANTS = {
  // subtle message entrance
  messageTurn: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
  },
  // button and interactive element states
  interactive: {
    hover: { scale: 1.01 },
    tap: { scale: 0.985 },
  },
  // panel/sidebar transitions
  panel: {
    open: { opacity: 1, x: 0 },
    closed: { opacity: 0, x: -10 },
  },
  // dropdowns and popups
  popover: {
    initial: { opacity: 0, scale: 0.96, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: 4 },
  }
};

/**
 * Hook to get motion utilities respecting user preferences
 */
export const useTiming = () => {
  const shouldReduce = useReducedMotion();
  
  return {
    duration: (key: keyof typeof MOTION_TOKENS.duration) => 
      shouldReduce ? 0 : MOTION_TOKENS.duration[key],
    ease: MOTION_TOKENS.ease.out,
    spring: MOTION_TOKENS.ease.spring,
    shouldReduce,
  };
};
