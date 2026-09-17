import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';

import { DiscoverBrowse } from '@/components/discover-browse';
import { Segmented } from '@/components/discover-segmented';
import { UserRow } from '@/components/user-row';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  Row,
  Screen,
  SearchBar,
  Spacer,
  Text,
} from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import { useMyRankings, useProfileSearch, useSearch } from '@/hooks';
import { categoryLabel, type WhiskeyCategory } from '@/lib/api';
import { spacing } from '@/theme';

type Mode = 'whiskeys' | 'people';

export default function DiscoverScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [mode, setMode] = useState<Mode>('whiskeys');
  const [categories, setCategories] = useState<WhiskeyCategory[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(id);
  }, [q]);

  const results = useSearch(debounced, categories.length ? { categories } : {});
  const people = useProfileSearch(debounced);
  const mine = useMyRankings();

  const term = debounced.trim();
  const searching = term.length >= 2;
  const browsing = !searching && categories.length === 0;

  return (
    <Screen>
      <Text variant="title" style={{ paddingVertical: spacing.sm }}>
        Discover
      </Text>
      <SearchBar
        value={q}
        onChangeText={setQ}
        placeholder={mode === 'people' ? 'Search people' : 'Search whiskeys'}
        clearButtonMode="while-editing"
      />
      <Spacer h={spacing.md} />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { key: 'whiskeys', label: 'Whiskeys' },
          { key: 'people', label: 'People' },
        ]}
      />
      <Spacer h={spacing.sm} />

      {mode === 'people' ? (
        <PeopleResults term={term} query={people} />
      ) : browsing ? (
        <DiscoverBrowse selected={categories} onSelectCategories={setCategories} />
      ) : (
        <FlatList
          data={results.data ?? []}
          keyExtractor={(w) => w.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshing={results.isRefetching}
          onRefresh={() => results.refetch()}
          ListHeaderComponent={
            categories.length ? (
              <Row style={{ flexWrap: 'wrap', paddingVertical: spacing.sm }} gap={spacing.sm}>
                <Chip label="All" onPress={() => setCategories([])} />
                {categories.map((c) => (
                  <Chip key={c} label={categoryLabel(c)} selected onPress={() => setCategories([])} />
                ))}
              </Row>
            ) : null
          }
          renderItem={({ item }) => {
            const r = mine.byWhiskey.get(item.id);
            return (
              <WhiskeyRow
                whiskey={item}
                mine={r ? { tier: r.tier, score: r.score, overallRank: r.overallRank } : null}
              />
            );
          }}
          ListEmptyComponent={
            results.isError ? (
              <ErrorState error={results.error} retry={() => results.refetch()} />
            ) : results.isFetching ? (
              <Loading />
            ) : (
              <EmptyState
                icon="search-outline"
                title="No matches"
                body="Try a shorter search, or add the bottle yourself."
              />
            )
          }
          ListFooterComponent={
            searching ? (
              <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
                <Text variant="h3">Can&apos;t find it?</Text>
                <Text variant="small" muted>
                  Add it to the catalog and it&apos;s instantly rateable.
                </Text>
                <Row gap={spacing.sm}>
                  <Button
                    title="Add a whiskey"
                    icon="add"
                    style={{ flex: 1 }}
                    onPress={() => router.push({ pathname: '/add-whiskey', params: { name: term } })}
                  />
                  <Button
                    title="Scan a label"
                    icon="camera-outline"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => router.push('/scan')}
                  />
                </Row>
              </Card>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function PeopleResults({ term, query }: { term: string; query: ReturnType<typeof useProfileSearch> }) {
  if (term.length < 2) {
    return <EmptyState icon="people-outline" title="Find your people" body="Search by name or @username." />;
  }
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      renderItem={({ item }) => <UserRow profile={item} />}
      ListEmptyComponent={<EmptyState icon="person-outline" title="Nobody by that name" />}
    />
  );
}
