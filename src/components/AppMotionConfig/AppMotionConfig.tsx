import type { PropsWithChildren } from "react";
import { MotionConfig } from "motion/react";

export function AppMotionConfig({ children }: PropsWithChildren) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
