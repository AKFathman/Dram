import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottleImage, Row, ScoreBadge, Text, TierPill } from '@/components/ui';
import { whiskeySubtitle, type Whiskey } from '@/lib/api';
import { formatScore, type Tier } from '@/lib/ranking';
import { spacing, useTheme } from '@/theme';

/**
 * The one list row for whiskeys, used by search, rankings, wishlist, events…
 *  - `mine` shows the caller's own tier/score/rank instead of the community score
 *  - `right` overrides the trailing slot entirely
 */
export function WhiskeyRow({
  whiskey,
  mine,
  rank,
  subtitle,
  right,
  onPress,
  compact,
}: {
  whiskey: Whiskey;
  mine?: { tier: Tier; score: number; overallRank?: number } | null;
  rank?: number;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  compact?: boolean;
}) {
  const t = useTheme();
  const router = useRouter();
  const go = onPress ?? (() => router.push({ pathname: '/whiskey/[id]', params: { id: whiskey.id } }));
  const pending = whiskey.status === 'pending';

  return (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: t.border, opacity: pressed ? 0.7 : 1, paddingVertical: compact ? spacing.sm : spacing.md },
      ]}>
      {rank != null ? (
        <Text variant="h3" muted style={{ width: 28, textAlign: 'right' }}>
          {rank}
        </Text>
      ) : null}
      <BottleImage uri={whiskey.image_url} size={compact ? 40 : 52} />
      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={6}>
          <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
            {whiskey.name}
          </Text>
          {pending ? (
            <Text variant="caption" style={{ color: t.accent }}>
              UNVERIFIED
            </Text>
          ) : null}
        </Row>
        <Text variant="small" muted numberOfLines={1}>
          {subtitle ?? whiskeySubtitle(whiskey)}
        </Text>
        {mine ? (
          <Row gap={6}>
            <TierPill tier={mine.tier} />
            {mine.overallRank ? (
              <Text variant="caption" muted>
                #{mine.overallRank} overall
              </Text>
            ) : null}
          </Row>
        ) : whiskey.ratings_count > 0 ? (
          <Text variant="caption" muted>
            {whiskey.ratings_count} {whiskey.ratings_count === 1 ? 'rating' : 'ratings'}
          </Text>
        ) : null}
      </View>
      {right !== undefined ? (
        right
      ) : mine ? (
        <ScoreBadge score={mine.score} />
      ) : (
        <ScoreBadge score={whiskey.avg_score} size="sm" />
      )}
    </Pressable>
  );
}

export function scoreLabel(score: number | null | undefined) {
  return formatScore(score);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
