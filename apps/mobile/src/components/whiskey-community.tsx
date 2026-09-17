import { View } from 'react-native';

import { Card, Row, ScoreBadge, Text } from '@/components/ui';
import type { Whiskey } from '@/lib/api';
import { TIER_META, TIER_ORDER } from '@/lib/ranking';
import { radius, spacing, useTheme } from '@/theme';

/** Community average + how the four tiers split, as one stacked bar. */
export function WhiskeyCommunity({ whiskey: w }: { whiskey: Whiskey }) {
  const t = useTheme();
  const counts = {
    loved: w.loved_count ?? 0,
    liked: w.liked_count ?? 0,
    fine: w.fine_count ?? 0,
    disliked: w.disliked_count ?? 0,
  };
  const total = TIER_ORDER.reduce((n, tier) => n + counts[tier], 0);

  return (
    <Card style={{ gap: spacing.md }}>
      <Row gap={spacing.md}>
        <ScoreBadge score={w.avg_score} size="lg" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3">Community score</Text>
          <Text variant="small" muted>
            {w.ratings_count > 0
              ? `${w.ratings_count} ${w.ratings_count === 1 ? 'rating' : 'ratings'}`
              : 'No ratings yet — be the first.'}
          </Text>
        </View>
      </Row>

      {total > 0 ? (
        <>
          <Row gap={2} style={{ height: 12, alignItems: 'stretch', borderRadius: radius.pill, overflow: 'hidden' }}>
            {TIER_ORDER.filter((tier) => counts[tier] > 0).map((tier) => (
              <View key={tier} style={{ flex: counts[tier], backgroundColor: t.tier[tier], height: '100%' }} />
            ))}
          </Row>
          <Row style={{ flexWrap: 'wrap' }} gap={spacing.md}>
            {TIER_ORDER.map((tier) => (
              <Row key={tier} gap={6}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.tier[tier] }} />
                <Text variant="caption" muted>
                  {TIER_META[tier].short} {counts[tier]}
                </Text>
              </Row>
            ))}
          </Row>
        </>
      ) : null}
    </Card>
  );
}
