import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { CARD_W } from '@/components/discover-horizontal';
import { PressableScale } from '@/components/motion';
import { Avatar, BottleImage, Row, ScoreBadge, Text } from '@/components/ui';
import { pickExperts, whiskeySubtitle, type ExpertPick } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

/** "Loved by Fiona Grant and 2 other experts", with their faces. */
function Credit({ pick }: { pick: ExpertPick }) {
  const t = useTheme();
  const experts = pickExperts(pick);
  const first = experts[0];
  if (!first) return null;
  const others = (pick.expert_count ?? experts.length) - 1;
  return (
    <Row gap={spacing.sm}>
      <Row gap={0}>
        {experts.slice(0, 3).map((e, i) => (
          <Avatar
            key={e.id}
            uri={e.avatar_url}
            name={e.display_name || e.username}
            size={22}
            style={{ marginLeft: i ? -7 : 0, borderWidth: 2, borderColor: t.card }}
          />
        ))}
      </Row>
      <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
        Loved by {first.display_name || first.username}
        {others > 0 ? ` and ${others} other expert${others === 1 ? '' : 's'}` : ''}
      </Text>
    </Row>
  );
}

function open(router: ReturnType<typeof useRouter>, pick: ExpertPick) {
  router.push({ pathname: '/whiskey/[id]', params: { id: pick.whiskey_id! } });
}

/** A full-width pick for lists. */
export function PickRow({ pick, rank }: { pick: ExpertPick; rank?: number }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <PressableScale
      onPress={() => open(router, pick)}
      accessibilityRole="button"
      accessibilityLabel={`${pick.name}, expert score ${pick.expert_avg_score}`}
      scaleTo={0.985}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}>
      {rank != null ? (
        <Text variant="h3" muted style={{ width: 22, textAlign: 'center' }}>
          {rank}
        </Text>
      ) : null}
      <BottleImage uri={pick.image_url} size={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="h3" numberOfLines={1}>
          {pick.name}
        </Text>
        <Text variant="small" muted numberOfLines={1}>
          {whiskeySubtitle({
            region: pick.region,
            country: pick.country!,
            category: pick.category!,
            age_years: pick.age_years,
            abv: pick.abv,
          })}
        </Text>
        <Credit pick={pick} />
      </View>
      <ScoreBadge score={pick.expert_avg_score} />
    </PressableScale>
  );
}

/** A card for horizontal rails. */
export function PickCard({ pick }: { pick: ExpertPick }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <PressableScale
      onPress={() => open(router, pick)}
      accessibilityRole="button"
      accessibilityLabel={`${pick.name}, expert score ${pick.expert_avg_score}`}
      scaleTo={0.97}
      style={{ width: CARD_W, gap: spacing.xs }}>
      <View>
        <BottleImage uri={pick.image_url} size={CARD_W} style={{ borderRadius: radius.lg }} />
        <ScoreBadge
          score={pick.expert_avg_score}
          size="sm"
          style={{ position: 'absolute', right: 8, bottom: 8, borderWidth: 2, borderColor: t.bg }}
        />
      </View>
      <Text variant="small" numberOfLines={2} style={{ fontWeight: '700' }}>
        {pick.name}
      </Text>
      <Credit pick={pick} />
    </PressableScale>
  );
}
