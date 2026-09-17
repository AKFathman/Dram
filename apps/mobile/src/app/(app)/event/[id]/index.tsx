import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SectionList, View } from 'react-native';

import { EventHeader, EventJoinCode, EventProgress } from '@/components/event-header';
import { EventLeaderboardRow } from '@/components/event-leaderboard-row';
import { Button, Chip, EmptyState, ErrorState, Loading, Row, ScoreBadge, Screen, Spacer, Text } from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import { whiskeySubtitle, type EventPour, type LeaderboardRow, type Whiskey } from '@/lib/api';
import { formatScore, type Tier } from '@/lib/ranking';
import { timeAgo } from '@/lib/time';
import { useEvent, useLeaderboard, useLeaveEvent, useMyEventTastings, useMyRankings } from '@/hooks';
import { spacing } from '@/theme';

type TabKey = 'lineup' | 'leaderboard' | 'favorites';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'lineup', label: 'Lineup' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'favorites', label: 'My favorites' },
];

interface Mine {
  tier: Tier;
  score: number;
  overallRank?: number;
}
type ListRow =
  | { kind: 'pour'; pour: EventPour }
  | { kind: 'lb'; row: LeaderboardRow; rank: number }
  | { kind: 'fav'; whiskey: Whiskey; mine: Mine | null; rank: number };
interface Section {
  title: string | null;
  data: ListRow[];
}

export default function EventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<TabKey>('lineup');

  const event = useEvent(id);
  const myTastings = useMyEventTastings(id);
  const leaderboard = useLeaderboard(id);
  const { byWhiskey } = useMyRankings();
  const leave = useLeaveEvent();

  if (event.isPending && !event.data)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (event.error || !event.data) {
    return (
      <Screen>
        <ErrorState error={event.error ?? new Error('Event not found')} retry={() => event.refetch()} />
      </Screen>
    );
  }

  const data = event.data;
  const pours = data.pours ?? [];
  const role = data.my_membership?.[0]?.role ?? null;
  const canManage = role === 'organizer' || role === 'host';
  const triedHere = new Set((myTastings.data ?? []).map((x) => x.whiskey_id));
  const allPourWhiskeyIds = pours.map((p) => p.whiskey_id);
  const triedCount = pours.filter((p) => triedHere.has(p.whiskey_id)).length;

  const rate = (whiskeyId: string) =>
    router.push({
      pathname: '/rate/[whiskeyId]',
      params: { whiskeyId, eventId: id, preferIds: allPourWhiskeyIds.join(',') },
    });

  const confirmLeave = () =>
    Alert.alert('Leave this event?', 'Your ratings stay on your list; you just stop seeing the lineup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leave.mutateAsync(id);
            router.back();
          } catch (e) {
            Alert.alert('Could not leave', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);

  // ------------------------------------------------------------- sections ---
  let sections: Section[] = [];
  if (tab === 'lineup') {
    const groups = new Map<string, EventPour[]>();
    for (const pour of [...pours].sort((a, b) => a.sort_order - b.sort_order)) {
      const key = pour.flight ?? 'Lineup';
      const bucket = groups.get(key);
      if (bucket) bucket.push(pour);
      else groups.set(key, [pour]);
    }
    sections = [...groups.entries()].map(([title, list]) => ({
      title,
      data: list.map((pour) => ({ kind: 'pour' as const, pour })),
    }));
  } else if (tab === 'leaderboard') {
    sections = [
      {
        title: null,
        data: (leaderboard.data ?? []).map((row, i) => ({ kind: 'lb' as const, row, rank: i + 1 })),
      },
    ];
  } else {
    const seen = new Set<string>();
    const favorites: { whiskey: Whiskey; mine: Mine | null }[] = [];
    for (const tasting of myTastings.data ?? []) {
      if (seen.has(tasting.whiskey_id)) continue;
      seen.add(tasting.whiskey_id);
      const mine = byWhiskey.get(tasting.whiskey_id) ?? null;
      const whiskey = pours.find((p) => p.whiskey_id === tasting.whiskey_id)?.whiskey ?? mine?.whiskey;
      if (whiskey) favorites.push({ whiskey, mine });
    }
    favorites.sort((a, b) => (b.mine?.score ?? -1) - (a.mine?.score ?? -1));
    sections = [
      { title: null, data: favorites.map((f, i) => ({ kind: 'fav' as const, ...f, rank: i + 1 })) },
    ];
  }

  const header = (
    <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
      <EventHeader event={data} role={role} />
      <EventJoinCode event={data} />
      <EventProgress tried={triedCount} total={pours.length} />
      {canManage ? (
        <Button
          title="Manage lineup"
          variant="secondary"
          icon="options-outline"
          onPress={() => router.push({ pathname: '/event/[id]/manage', params: { id } })}
        />
      ) : (
        <Button title="Leave event" variant="ghost" loading={leave.isPending} onPress={confirmLeave} />
      )}
      <Row gap={spacing.sm}>
        {TABS.map((x) => (
          <Chip key={x.key} label={x.label} selected={tab === x.key} onPress={() => setTab(x.key)} />
        ))}
      </Row>
      {tab === 'leaderboard' && leaderboard.dataUpdatedAt ? (
        <Text variant="caption" muted>
          Updated {timeAgo(new Date(leaderboard.dataUpdatedAt).toISOString())}
        </Text>
      ) : null}
    </View>
  );

  const empty =
    tab === 'lineup' ? (
      <EmptyState
        icon="wine-outline"
        title="No pours yet"
        body={canManage ? 'Add the bottles you are opening tonight.' : 'The organizer has not published the lineup yet.'}
        action={
          canManage ? (
            <Button
              title="Manage lineup"
              variant="secondary"
              onPress={() => router.push({ pathname: '/event/[id]/manage', params: { id } })}
            />
          ) : undefined
        }
      />
    ) : tab === 'leaderboard' ? (
      <EmptyState icon="trophy-outline" title="Nothing rated yet" body="Scores appear as people rate the pours." />
    ) : (
      <EmptyState icon="heart-outline" title="Rate a pour to see your favorites" />
    );

  return (
    <Screen padded={false} edges={[]}>
      <SectionList<ListRow, Section>
        sections={sections}
        keyExtractor={(item, i) =>
          item.kind === 'pour' ? item.pour.id : item.kind === 'lb' ? `${item.row.pour_id ?? i}` : `${item.whiskey.id}`
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshing={event.isRefetching || leaderboard.isRefetching}
        onRefresh={() => {
          event.refetch();
          myTastings.refetch();
          leaderboard.refetch();
        }}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<View style={{ paddingTop: spacing.lg }}>{empty}</View>}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
              <Text variant="caption" muted>
                {section.title.toUpperCase()}
              </Text>
            </View>
          ) : (
            <Spacer h={spacing.sm} />
          )
        }
        renderItem={({ item }) => {
          if (item.kind === 'lb') {
            return (
              <EventLeaderboardRow
                row={item.row}
                rank={item.rank}
                onPress={
                  item.row.whiskey_id
                    ? () => router.push({ pathname: '/whiskey/[id]', params: { id: item.row.whiskey_id! } })
                    : undefined
                }
              />
            );
          }
          if (item.kind === 'fav') {
            return <WhiskeyRow whiskey={item.whiskey} mine={item.mine} rank={item.rank} />;
          }

          const { pour } = item;
          const ranking = byWhiskey.get(pour.whiskey_id) ?? null;
          const tried = triedHere.has(pour.whiskey_id);
          const subtitle =
            [pour.label, pour.table_location].filter(Boolean).join(' · ') || whiskeySubtitle(pour.whiskey);
          return (
            <View>
              <WhiskeyRow
                whiskey={pour.whiskey}
                subtitle={subtitle}
                mine={tried ? ranking : null}
                right={
                  tried ? (
                    <ScoreBadge score={ranking?.score ?? null} />
                  ) : (
                    <Button
                      title="Rate"
                      variant="secondary"
                      onPress={() => rate(pour.whiskey_id)}
                      style={{ paddingVertical: 8, paddingHorizontal: spacing.lg }}
                    />
                  )
                }
              />
              {!tried && ranking ? (
                <Text variant="caption" muted style={{ paddingLeft: 52 + spacing.md, paddingVertical: spacing.xs }}>
                  You&apos;ve had this before · {formatScore(ranking.score)}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}
