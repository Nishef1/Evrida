import { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

// Short, calm durations. Every animated surface must also work with motion off.
export const motion = { quick: 160, base: 240 } as const;

/** Layout-animation props for list rows; empty when the user reduces motion. */
export function listMotion(reduced: boolean) {
  if (reduced) return {};
  return {
    entering: FadeIn.duration(motion.base),
    exiting: FadeOut.duration(motion.base),
    layout: LinearTransition.duration(motion.base),
  };
}
