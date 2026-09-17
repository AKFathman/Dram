import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { DiscoverHorizontal } from '@/components/discover-horizontal';
import { FeedCard } from '@/components/feed-card';
import { SectionHeader } from '@/components/section-header';
import { Button, EmptyState, ErrorState, IconButton, Loading, Row, Screen, Text } from '@/components/ui';
import { useFeed, useNotifications, useTrending } from '@/hooks';
import { radius, spacing, useTheme } from '@/theme';

export default function HomeFeedScreen() {
  const t = useTheme();
  const router = useRouter();
  const feed = useFeed();
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
              <Text variant="caption" color="#fff" style={{ fontSize: 10 }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </View>
      </Row>

      {feed.isPending ? (
        <Loading />
      ) : feed.isError ? (
        <ErrorState error={feed.error} retry={() => feed.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={({ item }) => <FeedCard item={item} />}
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
