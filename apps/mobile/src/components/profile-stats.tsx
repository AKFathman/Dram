import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Row, Text } from '@/components/ui';
import type { Whiskey } from '@/lib/api';
import { TIER_META, TIER_ORDER, formatScore, type Tier } from '@/lib/ranking';
import { radius, spacing, useTheme } from '@/theme';

export interface RankedWhiskey {
  tier: Tier;
  score: number;
  whiskey: Whiskey;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="h2">{value}</Text>
      <Text variant="caption" muted numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Totals, the tier split, the region the list leans on, and the average score. */
export function ProfileStats({ list }: { list: RankedWhiskey[] }) {
  const t = useTheme();
  const total = list.length;

  const perTier: Record<Tier, number> = { loved: 0, liked: 0, fine: 0, disliked: 0 };
  const perRegion = new Map<string, number>();
  let sum = 0;
  for (const r of list) {
    perTier[r.tier] += 1;
    sum += r.score;
    const region = r.whiskey.region ?? r.whiskey.country;
    if (region) perRegion.set(region, (perRegion.get(region) ?? 0) + 1);
  }
  const topRegion = [...perRegion.entries()].sort((a, b) => b[1] - a[1])[0];
  const average = total ? sum / total : null;

  return (
    <Card style={{ gap: spacing.md }}>
      <Row gap={spacing.md}>
        <Stat label="Tried" value={String(total)} />
        <Stat label="Avg score" value={formatScore(average)} />
        <Stat label="Top region" value={topRegion ? topRegion[0] : '–'} />
      </Row>
      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        {TIER_ORDER.map((tier) => (
          <View key={tier} style={[styles.pill, { backgroundColor: t.tier[tier] }]}>
            <Text variant="caption" color="#fff">
              {TIER_META[tier].short} {perTier[tier]}
            </Text>
          </View>
        ))}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
});
