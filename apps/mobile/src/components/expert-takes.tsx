import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Appear, PressableScale } from '@/components/motion';
import { SectionHeader } from '@/components/section-header';
import { Avatar, Card, ExpertBadge, Row, ScoreBadge, Text } from '@/components/ui';
import { useWhiskeyExpertTakes } from '@/hooks';
import { spacing, useTheme } from '@/theme';

/** What verified experts think of one whiskey. Renders nothing if none have ranked it. */
export function ExpertTakes({ whiskeyId }: { whiskeyId: string }) {
  const t = useTheme();
  const router = useRouter();
  const takes = useWhiskeyExpertTakes(whiskeyId);
  if (!takes.data?.length) return null;

  return (
    <Appear>
      <SectionHeader title="What experts think" />
      <View style={{ gap: spacing.md }}>
        {takes.data.slice(0, 5).map((take) => {
          const name = take.display_name || take.username || 'Expert';
          return (
            <PressableScale
              key={take.user_id!}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: take.user_id! } })}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${take.expert_title ?? 'taste expert'}, scored it ${take.score}`}
              scaleTo={0.985}>
              <Card style={{ gap: spacing.md }}>
                <Row gap={spacing.md}>
                  <Avatar uri={take.avatar_url} name={name} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row gap={5}>
                      <Text numberOfLines={1} style={{ fontWeight: '700', flexShrink: 1 }}>
                        {name}
                      </Text>
                      <ExpertBadge compact title={take.expert_title} />
                    </Row>
                    <Text variant="small" muted numberOfLines={1}>
                      {take.expert_title}
                      {take.overall_rank != null && take.total != null
                        ? ` · #${take.overall_rank} of ${take.total}`
                        : ''}
                    </Text>
                  </View>
                  <ScoreBadge score={take.score} />
                </Row>
                {take.note ? (
                  <View style={{ borderLeftWidth: 3, borderLeftColor: t.expert, paddingLeft: spacing.md }}>
                    <Text numberOfLines={4} style={{ fontStyle: 'italic' }}>
                      {take.note}
                    </Text>
                  </View>
                ) : null}
              </Card>
            </PressableScale>
          );
        })}
      </View>
    </Appear>
  );
}
