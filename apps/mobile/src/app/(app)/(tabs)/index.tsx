import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { DiscoverHorizontal } from '@/components/discover-horizontal';
import { Segmented } from '@/components/discover-segmented';
import { FeedCard, FeedSkeleton } from '@/components/feed-card';
import { Appear } from '@/components/motion';
import { SectionHeader } from '@/components/section-header';
import { Button, EmptyState, ErrorState, IconButton, Loading, Row, Screen, Spacer, Text } from '@/components/ui';
import { useExpertFeed, useFeed, useNotifications, useTrending } from '@/hooks';
import { radius, spacing, useTheme } from '@/theme';

type Scope = 'following' | 'experts';

export default function HomeFeedScreen() {
  const t = useTheme();
  const router = useRouter();
  const [scope, setScope] = useState<Scope>('following');
  const following = useFeed();
  const experts = useExpertFeed();
  const feed = scope === 'following' ? following : experts;
  const notifications = useNotifications();
  const trending = useTrending();

  const items = feed.data?.pages.flat() ?? [];
  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingVertical: spacing.sm }}>
        <Text variant="title">Dram</Text>
        <View>
          <IconButton
            name="notifications-outline"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            onPress={() => router.push('/notifications')}
          />
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: t.accent, borderColor: t.bg }]} pointerEvents="none">
              <Text variant="caption" color={t.accentText} style={{ fontSize: 10 }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </View>
      </Row>

      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        options={[
          { key: 'following', label: 'Following' },
          { key: 'experts', label: 'Experts' },
        ]}
      />
      <Spacer h={spacing.md} />

      {feed.isPending ? (
        <FeedSkeleton />
      ) : feed.isError ? (
        <ErrorState error={feed.error} retry={() => feed.refetch()} />
      ) : (
        <FlatList
          // A new key per scope remounts the list, so switching replays the cascade.
          key={scope}
          data={items}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <FeedCard item={item} />
            </Appear>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => feed.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : null}
          ListEmptyComponent={
            scope === 'experts' ? (
              <EmptyState
                icon="ribbon-outline"
                title="No expert notes yet"
                body="When verified taste experts rate or review a whiskey, it shows up here — whether or not you follow them."
                action={
                  <Button title="Browse taste experts" variant="secondary" onPress={() => router.push('/experts')} />
                }
              />
            ) : (
              <View>
                <EmptyState
                  icon="wine-outline"
                  title="Your feed is quiet"
                  body="Follow a few people and their ratings, notes and events show up here."
                  action={<Button title="Find whiskeys & people" onPress={() => router.push('/search')} />}
                />
                <SectionHeader title="Trending now" />
                <DiscoverHorizontal
                  data={trending.data}
                  loading={trending.isPending}
                  empty="Nothing trending yet — be the first to rate something."
                />
              </View>
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
