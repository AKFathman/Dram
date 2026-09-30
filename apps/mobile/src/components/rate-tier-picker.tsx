/**
 * Step 1 of the rating flow: four big taps. No numbers — a gut call.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Appear, PRESS_SPRING, PressableScale } from '@/components/motion';
import { Text } from '@/components/ui';
import { TIER_META, TIER_ORDER, type Tier } from '@/lib/ranking';
import { elevation, radius, spacing, useTheme } from '@/theme';

export function RateTierPicker({ value, onSelect }: { value: Tier | null; onSelect: (tier: Tier) => void }) {
  return (
    <View style={{ gap: spacing.md }}>
      {TIER_ORDER.map((tier, i) => (
        <Appear key={tier} index={i}>
          <TierCard tier={tier} selected={value === tier} onPress={() => onSelect(tier)} />
        </Appear>
      ))}
    </View>
  );
}

function TierCard({ tier, selected, onPress }: { tier: Tier; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const meta = TIER_META[tier];
  const color = t.tier[tier];

  // 0 = resting card, 1 = filled with the tier's colour.
  const fill = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    fill.set(withTiming(selected ? 1 : 0, { duration: 220 }));
    if (selected) pop.set(withSequence(withSpring(1.3, PRESS_SPRING), withSpring(1, PRESS_SPRING)));
  }, [selected, fill, pop]);

  const card = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.get(), [0, 1], [t.card, color]),
  }));
  const emoji = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      accessibilityState={{ selected }}
      scaleTo={0.975}
      // The base colour gives the shadow a surface to come from; the fill animates over it.
      style={[styles.card, { backgroundColor: t.card }, elevation(t)]}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }, card]} />
      <Animated.View style={emoji}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text variant="h2" color={selected ? t.onTier : t.text}>
          {meta.label}
        </Text>
        <Text variant="small" color={selected ? t.onTier : t.muted}>
          {meta.band[0]}–{meta.band[1]} range
        </Text>
      </View>
      {selected ? (
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Ionicons name="checkmark-circle" size={24} color={t.onTier} />
        </Animated.View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 80,
  },
  emoji: { fontSize: 30, lineHeight: 36 },
});
