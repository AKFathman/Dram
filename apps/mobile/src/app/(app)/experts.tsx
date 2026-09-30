/**
 * The taste-expert directory: find people whose palate is worth following,
 * by specialty or by name.
 */
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';

import { ExpertCard } from '@/components/expert-card';
import { Appear, PressableScale, Skeleton } from '@/components/motion';
import { Card, Chip, EmptyState, ErrorState, ExpertBadge, Row, Screen, SearchBar, Spacer, Text } from '@/components/ui';
import { useExperts } from '@/hooks';
import { CATEGORY_GROUPS } from '@/lib/api';
import { spacing, useTheme } from '@/theme';

export default function ExpertsScreen() {
  const t = useTheme();
  const router = useRouter();
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const specialties = useMemo(() => CATEGORY_GROUPS.find((g) => g.label === group)?.categories, [group]);
  const experts = useExperts({ specialties, query });

  const header = (
    <View>
      <Text muted style={{ marginBottom: spacing.md }}>
        People Dram has verified: distillers, writers, educators and bartenders. Follow them to see what they rate.
      </Text>
      <SearchBar placeholder="Search by name or title" value={query} onChangeText={setQuery} />
      <Spacer h={spacing.md} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="All" selected={group === null} onPress={() => setGroup(null)} />
        {CATEGORY_GROUPS.map((g) => (
          <Chip key={g.label} label={g.label} selected={group === g.label} onPress={() => setGroup(g.label)} />
        ))}
      </ScrollView>
      <Spacer h={spacing.lg} />
    </View>
  );

  const footer = (
    <PressableScale
      onPress={() => router.push('/expert-apply')}
      accessibilityRole="button"
      scaleTo={0.985}
      style={{ marginTop: spacing.md }}>
      <Card style={{ backgroundColor: t.accentSoft, gap: spacing.sm }}>
        <ExpertBadge title="Work in whiskey?" />
        <Text variant="h3">Apply to be a taste expert</Text>
        <Text variant="small" muted>
          Distillers, writers, educators and bar professionals can apply for a verified badge.
        </Text>
      </Card>
    </PressableScale>
  );

  return (
    <Screen edges={[]} padded={false}>
      {experts.isError ? (
        <ErrorState error={experts.error} retry={() => experts.refetch()} />
      ) : (
        <FlatList
          key={group ?? 'all'}
          data={experts.data ?? []}
          keyExtractor={(e) => e.id!}
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <ExpertCard expert={item} />
            </Appear>
          )}
          ListEmptyComponent={
            experts.isPending ? (
              <View style={{ gap: spacing.md }}>
                {[0, 1, 2].map((i) => (
                  <Card key={i} style={{ gap: spacing.md }}>
                    <Row gap={spacing.md}>
                      <Skeleton width={52} height={52} rounded={26} />
                      <View style={{ flex: 1, gap: 8 }}>
                        <Skeleton width="50%" height={16} />
                        <Skeleton width="65%" height={22} rounded={11} />
                      </View>
                    </Row>
                    <Skeleton width="90%" height={14} />
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="ribbon-outline"
                title={query || group ? 'No experts match' : 'No taste experts yet'}
                body={
                  query || group
                    ? 'Try another specialty or clear the search.'
                    : 'The first verified experts will appear here.'
                }
              />
            )
          }
          ListFooterComponent={footer}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
