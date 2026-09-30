/**
 * Motion primitives. Every animation in the app should come from here, so
 * it all shares one feel: quick, springy, never in the way.
 *
 * Reanimated honours the system "reduce motion" setting by default; the
 * count-up checks it explicitly because it animates a number, not a style.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { radius, useTheme } from '@/theme';

/** A press that settles quickly without wobbling. */
export const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that dips slightly while held. Use for anything tappable that
 * looks like an object — buttons, cards, rows, chips.
 */
export function PressableScale({
  scaleTo = 0.97,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, PRESS_SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, PRESS_SPRING));
        onPressOut?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

/** Only the first screenful staggers; items scrolled into view later just fade. */
const STAGGER_CAP = 8;
const STAGGER_MS = 45;

/**
 * Rises into place when it mounts. Give list items their index so the first
 * few cascade in rather than appearing all at once.
 */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const entering =
    index < STAGGER_CAP
      ? FadeInDown.delay(index * STAGGER_MS)
          .duration(360)
          .easing(Easing.out(Easing.cubic))
      : FadeIn.duration(220);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Counts from the previous value up to `target`. Returns the number to show
 * this frame; jumps straight there when reduce-motion is on.
 */
export function useCountUp(target: number | null | undefined, duration = 650): number | null {
  const reduced = useReducedMotion();
  // Start from zero when there's something to count, so the first frame
  // doesn't flash the final number before the animation resets it.
  const [shown, setShown] = useState<number | null>(() => (target == null || reduced ? (target ?? null) : 0));
  // Where the number is right now, so a new target mid-count carries on
  // from there instead of jumping.
  const current = useRef<number>(0);

  useEffect(() => {
    let frame = 0;
    if (target == null || reduced) {
      frame = requestAnimationFrame(() => {
        current.current = target ?? 0;
        setShown(target ?? null);
      });
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const origin = current.current;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = origin + (target - origin) * eased;
      setShown(current.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return shown;
}

/** A soft pulsing block that stands in for content while it loads. */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = radius.sm,
  style,
}: {
  width?: ViewStyle['width'];
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withRepeat(withSequence(withTiming(0.45, { duration: 700 }), withTiming(1, { duration: 700 })), -1));
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: t.surface }, animated, style]} />
  );
}
