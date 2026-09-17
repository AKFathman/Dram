/**
 * Step 1 of the rating flow: four big taps. No numbers — a gut call.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { TIER_META, TIER_ORDER, type Tier } from '@/lib/ranking';
import { radius, spacing, useTheme } from '@/theme';

export function RateTierPicker({ value, onSelect }: { value: Tier | null; onSelect: (tier: Tier) => void }) {
  return (
    <View style={{ gap: spacing.md }}>
      {TIER_ORDER.map((tier) => (
        <TierCard key={tier} tier={tier} selected={value === tier} onPress={() => onSelect(tier)} />
      ))}
    </View>
  );
}

function TierCard({ tier, selected, onPress }: { tier: Tier; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const meta = TIER_META[tier];
  const color = t.tier[tier];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? color : t.card,
          borderColor: selected ? color : t.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <Text style={styles.emoji}>{meta.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text variant="h2" color={selected ? '#fff' : t.text}>
          {meta.label}
        </Text>
        <Text variant="small" color={selected ? '#fff' : t.muted}>
          {meta.band[0]}–{meta.band[1]} range
        </Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color="#fff" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 76,
  },
  emoji: { fontSize: 30, lineHeight: 36 },
});
