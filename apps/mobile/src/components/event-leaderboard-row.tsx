import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Row, ScoreBadge, Text, TierPill } from '@/components/ui';
import type { LeaderboardRow as LeaderboardRowData } from '@/lib/api';
import { TIER_ORDER } from '@/lib/ranking';
import { radius, spacing, useTheme } from '@/theme';

/** Below this many ratings the average is too noisy to show. */
export const MIN_RATINGS = 3;

/** loved / liked / fine / disliked as one thin stacked bar. */
function TierBar({ counts }: { counts: Record<(typeof TIER_ORDER)[number], number> }) {
  const t = useTheme();
  const total = TIER_ORDER.reduce((sum, tier) => sum + counts[tier], 0);
  if (total === 0) return null;
  return (
    <View style={styles.bar}>
      {TIER_ORDER.map((tier) =>
        counts[tier] > 0 ? <View key={tier} style={{ flex: counts[tier], backgroundColor: t.tier[tier] }} /> : null,
      )}
    </View>
  );
}

export function EventLeaderboardRow({
  row,
  rank,
  onPress,
}: {
  row: LeaderboardRowData;
  rank: number;
  onPress?: () => void;
}) {
  const t = useTheme();
  const ratings = row.ratings_count ?? 0;
  const thin = ratings < MIN_RATINGS;
  const counts = {
    loved: row.loved ?? 0,
    liked: row.liked ?? 0,
    fine: row.fine ?? 0,
    disliked: row.disliked ?? 0,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${rank}. ${row.whiskey_name ?? 'Unknown'}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.border, opacity: thin ? 0.55 : pressed ? 0.7 : 1 }]}>
      <Text variant="h3" muted style={{ width: 26, textAlign: 'right' }}>
        {rank}
      </Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="h3" numberOfLines={1}>
          {row.whiskey_name ?? 'Unknown pour'}
        </Text>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {row.label ? (
            <Text variant="caption" muted>
              {row.label}
            </Text>
          ) : null}
          <Text variant="caption" muted>
            {ratings} {ratings === 1 ? 'rating' : 'ratings'}
          </Text>
          {row.my_tier ? <TierPill tier={row.my_tier} /> : null}
        </Row>
        <TierBar counts={counts} />
      </View>
      {thin ? (
        <View style={{ width: 64, alignItems: 'flex-end' }}>
          <Text variant="caption" muted style={{ textAlign: 'right' }}>
            needs {MIN_RATINGS - ratings} more
          </Text>
        </View>
      ) : (
        <ScoreBadge score={row.avg_score} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: { flexDirection: 'row', height: 4, borderRadius: radius.pill, overflow: 'hidden', marginTop: 2 },
});
