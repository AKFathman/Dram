import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';

import { Button, Chip, EmptyState, ErrorState, IconButton, Loading, Row, Screen, Text } from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import { useCollection, useCollectionMutations, useMyRankings, useToggleWishlist, useWishlist } from '@/hooks';
import { categoryLabel, type WhiskeyCategory } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatScore } from '@/lib/ranking';
import { spacing, useTheme } from '@/theme';

const NEXT_STATUS = { sealed: 'open', open: 'finished', finished: 'sealed' } as const;

export default function MyListScreen() {
  const t = useTheme();
  const router = useRouter();
  // The route param only seeds the initial chip; pushing /my-list again with a
  // different filter mounts a fresh screen.
  const params = useLocalSearchParams<{ filter?: string }>();
  const { user } = useAuth();
  const [filter, setFilter] = useState(params.filter ?? 'all');

  const my = useMyRankings();
  const wishlist = useWishlist(user?.id);
  const collection = useCollection(user?.id);
  const toggleWishlist = useToggleWishlist();
  const bottles = useCollectionMutations();

  const list = my.list;
  const categories = [...new Set(list.map((r) => r.whiskey.category))] as WhiskeyCategory[];
  const regions = [...new Set(list.map((r) => r.whiskey.region ?? r.whiskey.country))];

  const filtered = filter.startsWith('category:')
    ? list.filter((r) => r.whiskey.category === filter.slice('category:'.length))
    : filter.startsWith('region:')
      ? list.filter((r) => (r.whiskey.region ?? r.whiskey.country) === filter.slice('region:'.length))
      : list;

  const chips = [
    { key: 'all', label: 'All' },
    ...categories.map((c) => ({ key: `category:${c}`, label: categoryLabel(c) })),
    ...regions.map((r) => ({ key: `region:${r}`, label: r })),
    { key: 'wishlist', label: 'Wishlist' },
    { key: 'bar', label: 'My bar' },
  ];

  const header = (
    <View>
      <Row style={{ flexWrap: 'wrap', paddingVertical: spacing.md }} gap={spacing.sm}>
        {chips.map((c) => (
          <Chip key={c.key} label={c.label} selected={filter === c.key} onPress={() => setFilter(c.key)} />
        ))}
      </Row>
      {filter === 'wishlist' || filter === 'bar' ? null : <Stats rows={filtered} />}
      {filter === 'bar' ? (
        <Button
          title="Add bottle"
          icon="add"
          variant="secondary"
          style={{ marginBottom: spacing.md }}
          onPress={() => router.push('/log')}
        />
      ) : null}
    </View>
  );

  if (my.isError) return <ErrorState error={my.error} retry={() => my.refetch()} />;

  if (filter === 'wishlist') {
    return (
      <Screen edges={[]}>
        <FlatList
          data={wishlist.data ?? []}
          keyExtractor={(row) => row.whiskey_id}
          ListHeaderComponent={header}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshing={wishlist.isRefetching}
          onRefresh={() => wishlist.refetch()}
          renderItem={({ item }) => (
            <WhiskeyRow
              whiskey={item.whiskey}
              right={
                <IconButton
                  name="heart"
                  color={t.danger}
                  accessibilityLabel={`Remove ${item.whiskey.name} from wishlist`}
                  onPress={() => toggleWishlist.mutate({ whiskeyId: item.whiskey_id, on: false })}
                />
              }
            />
          )}
          ListEmptyComponent={
            wishlist.isPending ? (
              <Loading />
            ) : (
              <EmptyState
                icon="heart-outline"
                title="Nothing on the wishlist"
                body="Tap the heart on any whiskey to save it."
              />
            )
          }
        />
      </Screen>
    );
  }

  if (filter === 'bar') {
    return (
      <Screen edges={[]}>
        <FlatList
          data={collection.data ?? []}
          keyExtractor={(b) => b.id}
          ListHeaderComponent={header}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshing={collection.isRefetching}
          onRefresh={() => collection.refetch()}
          renderItem={({ item }) => (
            <WhiskeyRow
              whiskey={item.whiskey}
              subtitle={`${item.status} · ${item.fill_percent}% full`}
              right={
                <Button
                  title={NEXT_STATUS[item.status]}
                  variant="secondary"
                  style={{ paddingVertical: 8, paddingHorizontal: spacing.md }}
                  onPress={() =>
                    bottles.update.mutate(
                      { id: item.id, status: NEXT_STATUS[item.status] },
                      { onError: (e) => Alert.alert('Could not update', e instanceof Error ? e.message : String(e)) },
                    )
                  }
                />
              }
            />
          )}
          ListEmptyComponent={
            collection.isPending ? (
              <Loading />
            ) : (
              <EmptyState icon="flask-outline" title="Your bar is empty" body="Add bottles from a whiskey's page" />
            )
          }
        />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.whiskey_id}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshing={my.isRefetching}
        onRefresh={() => my.refetch()}
        renderItem={({ item, index }) => (
          <WhiskeyRow
            whiskey={item.whiskey}
            rank={index + 1}
            mine={{ tier: item.tier, score: item.score, overallRank: item.overallRank }}
          />
        )}
        ListEmptyComponent={
          my.isPending ? (
            <Loading />
          ) : (
            <EmptyState
              icon="wine-outline"
              title="Nothing here yet"
              body="Rate a whiskey and it lands in your ranking."
              action={<Button title="Rate something" onPress={() => router.push('/log')} />}
            />
          )
        }
      />
    </Screen>
  );
}

function Stats({ rows }: { rows: { whiskey: { region: string | null; country: string }; score: number }[] }) {
  if (!rows.length) return null;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.whiskey.region ?? r.whiskey.country;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const topRegion = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const avg = rows.reduce((n, r) => n + r.score, 0) / rows.length;
  return (
    <Text variant="small" muted style={{ paddingBottom: spacing.md }}>
      {rows.length} {rows.length === 1 ? 'whiskey' : 'whiskeys'}
      {topRegion ? ` · top region ${topRegion}` : ''} · avg {formatScore(avg)}
    </Text>
  );
}
