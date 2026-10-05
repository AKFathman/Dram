/** Whiskeys verified experts rank highest, by style. */
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';

import { PickRow } from '@/components/expert-pick';
import { Appear, Skeleton } from '@/components/motion';
import { Button, Chip, EmptyState, ErrorState, Row, Screen, Spacer, Text } from '@/components/ui';
import { useExpertPicks } from '@/hooks';
import { CATEGORY_GROUPS } from '@/lib/api';
import { spacing } from '@/theme';

export default function ExpertPicksScreen() {
  const router = useRouter();
  const [group, setGroup] = useState<string | null>(null);
  const categories = useMemo(() => CATEGORY_GROUPS.find((g) => g.label === group)?.categories, [group]);
  const picks = useExpertPicks(categories);

  return (
    <Screen edges={[]} padded={false}>
      {picks.isError ? (
        <ErrorState error={picks.error} retry={() => picks.refetch()} />
      ) : (
        <FlatList
          key={group ?? 'all'}
          data={picks.data ?? []}
          keyExtractor={(p) => p.whiskey_id!}
          ListHeaderComponent={
            <View>
              <Text muted>
                Ranked by how many verified experts put each one in Loved or Liked, then by their scores.
              </Text>
              <Spacer h={spacing.md} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                <Chip label="All" selected={group === null} onPress={() => setGroup(null)} />
                {CATEGORY_GROUPS.map((g) => (
                  <Chip key={g.label} label={g.label} selected={group === g.label} onPress={() => setGroup(g.label)} />
                ))}
              </ScrollView>
              <Spacer h={spacing.sm} />
            </View>
          }
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <PickRow pick={item} rank={index + 1} />
            </Appear>
          )}
          ListEmptyComponent={
            picks.isPending ? (
              <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
                {[0, 1, 2, 3].map((i) => (
                  <Row key={i} gap={spacing.md}>
                    <Skeleton width={56} height={56} rounded={14} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Skeleton width="60%" height={16} />
                      <Skeleton width="40%" height={12} />
                    </View>
                  </Row>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="ribbon-outline"
                title="No expert picks here yet"
                body="As experts rank whiskeys in this style, their favourites will show up."
                action={
                  <Button title="Browse taste experts" variant="secondary" onPress={() => router.push('/experts')} />
                }
              />
            )
          }
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
