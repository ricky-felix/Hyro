/**
 * Animation utilities for Hyro.
 * All variants use transform + opacity for GPU-composited performance.
 * Import `useReducedMotion` from framer-motion in components for reactive
 * reduced-motion support instead of the one-shot prefersReducedMotion helper.
 */

export { useReducedMotion } from "framer-motion";

export const DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  slower: 0.7,
};

export const EASING = {
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  spring: { type: "spring", stiffness: 300, damping: 30 },
  springBounce: { type: "spring", stiffness: 200, damping: 20 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const scaleInBounce = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: { ...EASING.springBounce, duration: DURATION.slow },
};

export const buttonHover = {
  scale: 1.02,
  transition: { duration: DURATION.fast, ease: EASING.easeOut },
};

export const buttonTap = {
  scale: 0.98,
  transition: { duration: DURATION.fast, ease: EASING.easeIn },
};

export const linkHover = {
  x: 3,
  transition: { duration: DURATION.fast, ease: EASING.easeOut },
};

export const cardHover = {
  y: -4,
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.1)",
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const cardTap = {
  scale: 0.98,
  transition: { duration: DURATION.fast, ease: EASING.easeIn },
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASING.easeOut },
  },
};

// Directional stagger children. Use these (not the standalone scrollReveal*
// spreads) for elements inside a `staggerContainer`. A child with its own
// `whileInView` spawns a second IntersectionObserver that fires at its own
// threshold, so a section with several of them reveals in multiple staggered
// flashes (reads as a double blink). These variants instead inherit the
// container's single in-view trigger via framer-motion variant propagation, so
// the whole section animates from one observer.
export const staggerItemLeft = {
  initial: { opacity: 0, x: -40 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.slow, ease: EASING.easeOut },
  },
};

export const staggerItemRight = {
  initial: { opacity: 0, x: 40 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.slow, ease: EASING.easeOut },
  },
};

export const staggerItemScale = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.slow, ease: EASING.easeOut },
  },
};

// Scroll-reveal variants. Prefer the `<Reveal>` component (components/Reveal.jsx)
// over wiring these into a `whileInView` prop. On mobile the `whileInView` prop
// re-checks intersection on every IntersectionObserver callback, including the
// one fired when the address bar collapses on first scroll and resizes the
// visual viewport — that momentarily drops the entering element back under the
// `amount` threshold and over it again (enter→leave→enter), replaying the
// animation as a blink that the `once` latch doesn't reliably suppress. `Reveal`
// drives the same animation from a `useInView` hook whose `once: true` result is
// latched in React state and cannot revert on resize, so the reveal runs once.
// (These spreads are kept for any one-off `whileInView` use; the `viewport`
// here carries no negative margin, which was a separate, earlier blink source.)
export const scrollReveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: DURATION.slow, ease: EASING.easeOut },
};

export const scrollRevealLeft = {
  initial: { opacity: 0, x: -40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: DURATION.slow, ease: EASING.easeOut },
};

export const scrollRevealRight = {
  initial: { opacity: 0, x: 40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: DURATION.slow, ease: EASING.easeOut },
};

export const scrollRevealScale = {
  initial: { opacity: 0, scale: 0.9 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: DURATION.slow, ease: EASING.easeOut },
};

export const pulse = {
  initial: { opacity: 0.6 },
  animate: {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
};

export const spin = {
  animate: {
    rotate: 360,
    transition: { duration: 1, repeat: Infinity, ease: "linear" },
  },
};

export const slideDown = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast },
};

export const modalContent = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
  transition: { duration: DURATION.normal, ease: EASING.easeOut },
};

export const createStaggerAnimation = (itemCount, baseDelay = 0.1) => ({
  container: {
    animate: {
      transition: {
        staggerChildren: baseDelay,
        delayChildren: baseDelay,
      },
    },
  },
  item: (index) => ({
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: DURATION.normal,
        ease: EASING.easeOut,
        delay: index * baseDelay,
      },
    },
  }),
});
