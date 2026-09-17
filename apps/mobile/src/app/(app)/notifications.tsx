import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, EmptyState, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useMarkNotificationsRead, useNotifications } from '@/hooks';
import { acceptFollow, type Notification } from '@/lib/api';
import { timeAgo } from '@/lib/time';
import { radius, spacing, useTheme } from '@/theme';

type NotificationPayload = { preview: string | null; merged_name: string | null };

function describe(n: Notification): string {
  const payload = n.payload as NotificationPayload | null;
  switch (n.kind) {
    case 'new_follower':
      return 'started following you';
    case 'follow_request':
      return 'wants to follow you';
    case 'follow_accepted':
      return 'accepted your follow request';
    case 'like':
      return 'liked your tasting note';
    case 'comment':
      return payload?.preview ? `commented: “${payload.preview}”` : 'commented on your tasting note';
    case 'event_starting':
      return 'your event starts soon';
    case 'event_lineup_updated':
      return 'updated the lineup for your event';
    case 'whiskey_approved':
      return 'the whiskey you added was approved';
    case 'whiskey_merged':
      return payload?.merged_name
        ? `“${payload.merged_name}” was merged into another entry`
        : 'the whiskey you added was merged into another entry';
    default:
      return 'did something';
  }
}

export default function NotificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  const qc = useQueryClient();
  // Opening the screen marks everything read, so rows stamped after this screen
  // mounted are the ones that were still unread when the user arrived.
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = useMutation({
    mutationFn: (followerId: string) => acceptFollow(followerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => Alert.alert('Could not accept', e instanceof Error ? e.message : String(e)),
  });

  const open = (n: Notification) => {
    if (n.event_id) router.push({ pathname: '/event/[id]', params: { id: n.event_id } });
    else if (n.whiskey_id) router.push({ pathname: '/whiskey/[id]', params: { id: n.whiskey_id } });
    else if (n.actor_id) router.push({ pathname: '/user/[id]', params: { id: n.actor_id } });
  };

  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} retry={() => query.refetch()} />;

  return (
    <Screen edges={[]} padded={false}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshing={query.isRefetching}
        onRefresh={() => query.refetch()}
        ListEmptyComponent={
          <EmptyState icon="notifications-outline" title="Nothing yet" body="Follows, likes and event updates land here." />
        }
        renderItem={({ item }) => {
          const actorName = item.actor?.display_name || item.actor?.username || 'Someone';
          const unread = !item.read_at || new Date(item.read_at).getTime() >= openedAt;
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${actorName} ${describe(item)}`}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: t.border,
                  backgroundColor: unread ? t.accentSoft : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Avatar uri={item.actor?.avatar_url} name={actorName} size={40} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="small">
                  {item.actor ? <Text variant="small" style={styles.strong}>{actorName} </Text> : null}
                  {describe(item)}
                </Text>
                <Text variant="caption" muted>
                  {timeAgo(item.created_at)}
                </Text>
                {item.kind === 'follow_request' && item.actor_id ? (
                  <Button
                    title="Accept"
                    variant="secondary"
                    loading={accept.isPending && accept.variables === item.actor_id}
                    style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: radius.pill }}
                    onPress={() => accept.mutate(item.actor_id!)}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  strong: { fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
