/**
 * "Log a whiskey" — the front door of the core loop. Search the catalog, pick a
 * bottle, land in the rating flow. Scanning and adding are always one tap away.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, View } from 'react-native';

import { StickyFooter } from '@/components/log-form';
import { Button, Card, EmptyState, ErrorState, Loading, Row, Screen, SearchBar, Spacer, Text } from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import { useMyRankings, useSearch } from '@/hooks';
import type { Whiskey } from '@/lib/api';
import { spacing, useTheme } from '@/theme';

export default function LogScreen() {
  const t = useTheme();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const [q, setQ] = useState('');

  const search = useSearch(q);
  const rankings = useMyRankings();
  const query = q.trim();
  const searching = query.length >= 2;

  const recent = [...rankings.list].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 10);

  const results: Whiskey[] = searching ? (search.data ?? []) : recent.map((r) => r.whiskey);

  const goRate = (whiskeyId: string) =>
    router.replace({ pathname: '/rate/[whiskeyId]', params: { whiskeyId, ...(eventId ? { eventId } : {}) } });

  const goAdd = () =>
    router.replace({
      pathname: '/add-whiskey',
      params: { ...(query ? { name: query } : {}), ...(eventId ? { eventId } : {}) },
    });

  const goScan = () => router.replace({ pathname: '/scan', params: { ...(eventId ? { eventId } : {}) } });

  const header = (
    <View>
      {eventId ? (
        <Card style={{ backgroundColor: t.accentSoft, borderColor: t.accentSoft, marginBottom: spacing.md }}>
          <Row gap={spacing.sm}>
            <Ionicons name="people-outline" size={18} color={t.accent} />
            <Text variant="small" style={{ flex: 1 }}>
              Rating for an event — pours from the lineup appear on the event page.
            </Text>
          </Row>
        </Card>
      ) : null}
      {!searching && recent.length ? (
        <Text variant="caption" muted style={{ marginBottom: spacing.xs }}>
          RECENTLY RATED
        </Text>
      ) : null}
    </View>
  );

  const empty = () => {
    if (searching) {
      if (search.isError) return <ErrorState error={search.error} retry={() => search.refetch()} />;
      if (search.isFetching) return <Loading />;
      return (
        <EmptyState
          icon="search"
          title="No matches"
          body={`Nothing in the catalog for “${query}”. Add it and it's yours in a few taps.`}
          action={<Button title="Add a whiskey" variant="secondary" onPress={goAdd} />}
        />
      );
    }
    if (rankings.isLoading) return <Loading />;
    return (
      <EmptyState
        icon="wine-outline"
        title="Start typing"
        body="Search by bottle, brand or distillery — Lagavulin 16, Weller, Redbreast…"
      />
    );
  };

  return (
    <Screen edges={['bottom']} padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <SearchBar
          autoFocus
          placeholder="Search whiskeys"
          value={q}
          onChangeText={setQ}
          clearButtonMode="while-editing"
          accessibilityLabel="Search whiskeys"
        />
      </View>
      <Spacer h={spacing.md} />
      <FlatList
        data={results}
        keyExtractor={(w) => w.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty()}
        renderItem={({ item }) => (
          <WhiskeyRow
            whiskey={item}
            mine={rankings.byWhiskey.get(item.id) ?? null}
            onPress={() => goRate(item.id)}
            right={<Ionicons name="chevron-forward" size={18} color={t.muted} />}
          />
        )}
      />
      <StickyFooter>
        <Button title="Scan a label" icon="camera-outline" variant="secondary" onPress={goScan} />
        <Button title="Add a whiskey" icon="add-circle-outline" variant="ghost" onPress={goAdd} />
      </StickyFooter>
    </Screen>
  );
}
