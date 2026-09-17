import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import { EventLineupEditor } from '@/components/event-lineup-editor';
import { Avatar, Button, Card, Chip, Divider, EmptyState, ErrorState, Input, Loading, Row, Screen, Spacer, Text } from '@/components/ui';
import type { LeaderboardRow } from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import { useEvent, useEventMembers, useLeaderboard, useUpdateEvent } from '@/hooks';
import { spacing, useTheme } from '@/theme';

type Visibility = Enums<'event_visibility'>;
type Status = Enums<'event_status'>;

const VISIBILITY: { value: Visibility; label: string }[] = [
  { value: 'code', label: 'Invite by code' },
  { value: 'public', label: 'Public' },
];
const STATUS: { value: Status; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'live', label: 'Live' },
  { value: 'ended', label: 'Ended' },
];

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function leaderboardCsv(rows: LeaderboardRow[]): string {
  const header = 'rank,whiskey,label,flight,avg_score,ratings,loved,liked,fine,disliked';
  const body = rows.map((r, i) =>
    [i + 1, r.whiskey_name, r.label, r.flight, r.avg_score, r.ratings_count, r.loved, r.liked, r.fine, r.disliked]
      .map(csvCell)
      .join(','),
  );
  return [header, ...body].join('\n');
}

function SectionTitle({ children }: { children: string }) {
  return (
    <>
      <Spacer h={spacing.xl} />
      <Text variant="caption" muted>
        {children.toUpperCase()}
      </Text>
      <Spacer h={spacing.sm} />
    </>
  );
}

export default function ManageEvent() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const members = useEventMembers(id);
  const leaderboard = useLeaderboard(id);
  const save = useUpdateEvent();

  const data = event.data;
  const role = data?.my_membership?.[0]?.role ?? null;
  const canManage = role === 'organizer' || role === 'host';

  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    venue_name: string;
    visibility: Visibility;
    status: Status;
  } | null>(null);
  const form = draft ?? {
    name: data?.name ?? '',
    description: data?.description ?? '',
    venue_name: data?.venue_name ?? '',
    visibility: (data?.visibility ?? 'code') as Visibility,
    status: (data?.status ?? 'draft') as Status,
  };
  const patch = (next: Partial<typeof form>) => setDraft({ ...form, ...next });

  if (event.isPending && !data)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (event.error || !data) {
    return (
      <Screen>
        <ErrorState error={event.error ?? new Error('Event not found')} retry={() => event.refetch()} />
      </Screen>
    );
  }
  if (!canManage) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Organizers only"
          body="Ask whoever set this tasting up to make you a host."
          action={<Button title="Back to the event" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const submit = () =>
    save.mutate(
      {
        id,
        name: form.name.trim() || data.name,
        description: form.description.trim() || null,
        venue_name: form.venue_name.trim() || null,
        visibility: form.visibility,
        status: form.status,
      },
      {
        onSuccess: async () => {
          setDraft(null);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : String(e)),
      },
    );

  const exportCsv = () => {
    const rows = leaderboard.data ?? [];
    if (!rows.length) return Alert.alert('Nothing to export yet', 'The leaderboard fills up as people rate pours.');
    Share.share({ message: leaderboardCsv(rows), title: `${data.name} — leaderboard` }).catch(() => {});
  };

  return (
    <Screen scroll>
      <SectionTitle>Basics</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            NAME
          </Text>
          <Input value={form.name} onChangeText={(v) => patch({ name: v })} placeholder="Event name" />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            DESCRIPTION
          </Text>
          <Input
            value={form.description}
            onChangeText={(v) => patch({ description: v })}
            placeholder="What are we drinking?"
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            VENUE
          </Text>
          <Input value={form.venue_name} onChangeText={(v) => patch({ venue_name: v })} placeholder="Where is it?" />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            WHO CAN JOIN
          </Text>
          <Row gap={spacing.sm}>
            {VISIBILITY.map((v) => (
              <Chip key={v.value} label={v.label} selected={form.visibility === v.value} onPress={() => patch({ visibility: v.value })} />
            ))}
          </Row>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            STATUS
          </Text>
          <Row gap={spacing.sm}>
            {STATUS.map((s) => (
              <Chip key={s.value} label={s.label} selected={form.status === s.value} onPress={() => patch({ status: s.value })} />
            ))}
          </Row>
        </View>
        <Button title="Save" loading={save.isPending} disabled={!draft} onPress={submit} />
      </Card>

      <SectionTitle>Lineup</SectionTitle>
      <EventLineupEditor eventId={id} pours={data.pours ?? []} />

      <SectionTitle>Attendees</SectionTitle>
      <Card>
        {members.isPending ? <Loading /> : null}
        {members.data?.length === 0 ? (
          <Text variant="small" muted>
            Nobody has joined yet. Share the code {data.join_code}.
          </Text>
        ) : null}
        {(members.data ?? []).map((m, i) => (
          <View key={m.user_id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.profile?.display_name ?? m.profile?.username ?? 'Attendee'}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: m.user_id } })}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: spacing.xs })}>
              <Row gap={spacing.md}>
                <Avatar uri={m.profile?.avatar_url} name={m.profile?.display_name ?? m.profile?.username} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3" numberOfLines={1}>
                    {m.profile?.display_name ?? m.profile?.username ?? 'Someone'}
                  </Text>
                  {m.profile?.username ? (
                    <Text variant="caption" muted>
                      @{m.profile.username}
                    </Text>
                  ) : null}
                </View>
                <Text variant="caption" color={m.role === 'attendee' ? t.muted : t.accent}>
                  {m.role === 'organizer' ? 'Organizer' : m.role === 'host' ? 'Host' : 'Attendee'}
                </Text>
              </Row>
            </Pressable>
          </View>
        ))}
      </Card>

      <SectionTitle>Export</SectionTitle>
      <Button title="Export leaderboard (CSV)" variant="secondary" icon="download-outline" onPress={exportCsv} />
      <Spacer h={spacing.xl} />
    </Screen>
  );
}
