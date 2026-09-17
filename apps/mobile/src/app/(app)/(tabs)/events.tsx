import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, SectionList, View } from 'react-native';

import { EventCard } from '@/components/event-card';
import { Button, EmptyState, ErrorState, Loading, Row, Screen, Spacer, Text } from '@/components/ui';
import type { Event } from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import { isLiveOrUpcoming } from '@/lib/event-time';
import { useJoinPublicEvent, useMyEvents, usePublicEvents } from '@/hooks';
import { spacing } from '@/theme';

type Role = Enums<'event_role'>;
interface Row {
  event: Event;
  role: Role | null;
  joinable: boolean;
}
interface Section {
  title: string;
  empty: string;
  data: Row[];
}

export default function EventsTab() {
  const router = useRouter();
  const mine = useMyEvents();
  const publics = usePublicEvents();
  const join = useJoinPublicEvent();

  const myEvents = mine.data ?? [];
  const myIds = new Set(myEvents.map((e) => e.id));

  const toRow = (e: (typeof myEvents)[number]): Row => ({
    event: e,
    role: e.my_membership?.[0]?.role ?? null,
    joinable: false,
  });

  const upcoming = myEvents
    .filter(isLiveOrUpcoming)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map(toRow);
  const past = myEvents
    .filter((e) => !isLiveOrUpcoming(e))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .map(toRow);
  const open: Row[] = (publics.data ?? [])
    .filter((e) => !myIds.has(e.id))
    .map((e) => ({ event: e, role: null, joinable: true }));

  const sections: Section[] = [
    { title: 'Live & upcoming', empty: 'Nothing on the calendar yet.', data: upcoming },
    { title: 'Past', empty: 'Your finished tastings will show up here.', data: past },
    { title: 'Public events', empty: 'No public events near you right now.', data: open },
  ];

  const joinPublic = async (event: Event) => {
    try {
      await join.mutateAsync(event.id);
      router.push({ pathname: '/event/[id]', params: { id: event.id } });
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : String(e));
    }
  };

  const refreshing = mine.isRefetching || publics.isRefetching;
  const refresh = () => {
    mine.refetch();
    publics.refetch();
  };

  const header = (
    <View>
      <Spacer h={spacing.sm} />
      <Text variant="title">Events</Text>
      <Spacer h={spacing.md} />
      <Row gap={spacing.sm}>
        <Button
          title="Join with code"
          variant="secondary"
          icon="key-outline"
          style={{ flex: 1 }}
          onPress={() => router.push('/event/join')}
        />
        <Button title="Create" icon="add" style={{ flex: 1 }} onPress={() => router.push('/event/new')} />
      </Row>
      <Spacer h={spacing.lg} />
    </View>
  );

  if (mine.isPending && !mine.data) {
    return (
      <Screen>
        {header}
        <Loading />
      </Screen>
    );
  }
  if (mine.error && !mine.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={mine.error} retry={refresh} />
      </Screen>
    );
  }

  const nothingAtAll = myEvents.length === 0 && open.length === 0;

  return (
    <Screen padded={false}>
      <SectionList<Row, Section>
        sections={sections}
        keyExtractor={(item) => `${item.joinable ? 'public' : 'mine'}:${item.event.id}`}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          nothingAtAll ? (
            <EmptyState
              icon="people-outline"
              title="No events yet"
              body="Join a tasting with a 6-character code, or create your own lineup."
              action={<Button title="Join with code" variant="secondary" onPress={() => router.push('/event/join')} />}
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <Text variant="caption" muted>
              {section.title.toUpperCase()}
            </Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 && !nothingAtAll ? (
            <Text variant="small" muted style={{ paddingBottom: spacing.sm }}>
              {section.empty}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ paddingBottom: spacing.md }}>
            <EventCard
              event={item.event}
              role={item.role}
              onPress={() =>
                item.joinable ? joinPublic(item.event) : router.push({ pathname: '/event/[id]', params: { id: item.event.id } })
              }
              right={
                item.joinable ? (
                  <Button
                    title="Join"
                    variant="secondary"
                    loading={join.isPending && join.variables === item.event.id}
                    onPress={() => joinPublic(item.event)}
                    style={{ paddingVertical: 8, paddingHorizontal: spacing.lg }}
                  />
                ) : undefined
              }
            />
          </View>
        )}
      />
    </Screen>
  );
}
