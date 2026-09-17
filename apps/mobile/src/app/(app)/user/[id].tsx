import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Alert, FlatList, View } from 'react-native';

import { Segmented } from '@/components/discover-segmented';
import { FeedCard } from '@/components/feed-card';
import { EmptyState, ErrorState, IconButton, Loading, Screen, Spacer, Text } from '@/components/ui';
import { UserProfileHeader } from '@/components/user-profile-header';
import { WhiskeyRow } from '@/components/whiskey-row';
import { useFeed, useFollowState, useProfile, useRankings, useTasteMatch } from '@/hooks';
import { blockUser, reportContent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';

type Segment = 'ranking' | 'regions' | 'activity';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const profileQuery = useProfile(id);
  const follow = useFollowState(id);
  const match = useTasteMatch(id);
  const rankings = useRankings(id);
  const feed = useFeed(id);
  const [segment, setSegment] = useState<Segment>('ranking');

  if (user && id === user.id) return <Redirect href="/profile" />;

  const profile = profileQuery.data;

  const doBlock = () =>
    Alert.alert('Block this person?', 'They will not see your activity and you will not see theirs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(id);
            router.back();
          } catch (e) {
            Alert.alert('Could not block', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);

  const doReport = async () => {
    try {
      await reportContent({ target_type: 'profile', target_id: id, reason: 'abuse' });
      Alert.alert('Thanks', 'A moderator will take a look.');
    } catch (e) {
      Alert.alert('Could not send report', e instanceof Error ? e.message : String(e));
    }
  };

  const openMenu = () =>
    Alert.alert(profile?.display_name ?? 'Profile', undefined, [
      { text: 'Block', style: 'destructive', onPress: doBlock },
      { text: 'Report', onPress: doReport },
      { text: 'Cancel', style: 'cancel' },
    ]);

  if (profileQuery.isPending) return <Loading />;
  if (profileQuery.isError || !profile) {
    return <ErrorState error={profileQuery.error} retry={() => profileQuery.refetch()} />;
  }

  const isPrivate = profile.visibility === 'followers' && !follow.isFollowing;
  const feedItems = feed.data?.pages.flat() ?? [];

  const header = (
    <View>
      <UserProfileHeader
        profile={profile}
        isFollowing={follow.isFollowing}
        isPending={follow.isPending}
        busy={follow.toggle.isPending}
        onToggleFollow={() => follow.toggle.mutate()}
        match={match.data}
      />
      <Spacer h={spacing.lg} />
      <Segmented
        value={segment}
        onChange={setSegment}
        options={[
          { key: 'ranking', label: 'Ranking' },
          { key: 'regions', label: 'By region' },
          { key: 'activity', label: 'Activity' },
        ]}
      />
      <Spacer h={spacing.sm} />
    </View>
  );

  const privateState = (
    <EmptyState
      icon="lock-closed-outline"
      title="This account is private"
      body="Follow to see their ranking, regions and activity."
    />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: profile.username ? `@${profile.username}` : '',
          headerRight: () => (
            <IconButton name="ellipsis-horizontal" accessibilityLabel="More options" onPress={openMenu} />
          ),
        }}
      />
      <Screen edges={[]}>
        {segment === 'activity' ? (
          <FlatList
            data={isPrivate ? [] : feedItems}
            keyExtractor={(item, index) => String(item.id ?? index)}
            ListHeaderComponent={header}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => feed.refetch()}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
            }}
            renderItem={({ item }) => <FeedCard item={item} />}
            ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : null}
            ListEmptyComponent={
              isPrivate ? (
                privateState
              ) : feed.isPending ? (
                <Loading />
              ) : (
                <EmptyState icon="pulse-outline" title="Nothing yet" />
              )
            }
          />
        ) : segment === 'regions' ? (
          <RegionList header={header} rankings={rankings} isPrivate={isPrivate} privateState={privateState} />
        ) : (
          <FlatList
            data={isPrivate ? [] : rankings.list}
            keyExtractor={(r) => r.whiskey_id}
            ListHeaderComponent={header}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            refreshing={rankings.isRefetching}
            onRefresh={() => rankings.refetch()}
            renderItem={({ item, index }) => (
              <WhiskeyRow
                whiskey={item.whiskey}
                rank={index + 1}
                mine={{ tier: item.tier, score: item.score, overallRank: item.overallRank }}
              />
            )}
            ListEmptyComponent={
              isPrivate ? (
                privateState
              ) : rankings.isPending ? (
                <Loading />
              ) : (
                <EmptyState icon="wine-outline" title="No ranked whiskeys yet" />
              )
            }
          />
        )}
      </Screen>
    </>
  );
}

function RegionList({
  header,
  rankings,
  isPrivate,
  privateState,
}: {
  header: ReactElement;
  rankings: ReturnType<typeof useRankings>;
  isPrivate: boolean;
  privateState: ReactElement;
}) {
  const best = new Map<string, { top: (typeof rankings.list)[number]; count: number }>();
  for (const r of rankings.list) {
    const key = r.whiskey.region ?? r.whiskey.country;
    const cur = best.get(key);
    if (!cur) best.set(key, { top: r, count: 1 });
    else best.set(key, { top: r.score > cur.top.score ? r : cur.top, count: cur.count + 1 });
  }
  const regions = [...best.entries()].sort((a, b) => b[1].top.score - a[1].top.score);

  return (
    <FlatList
      data={isPrivate ? [] : regions}
      keyExtractor={([region]) => region}
      ListHeaderComponent={header}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      renderItem={({ item: [region, entry] }) => (
        <View style={{ paddingTop: spacing.md }}>
          <Text variant="caption" muted>
            {region.toUpperCase()} · {entry.count} ranked
          </Text>
          <WhiskeyRow
            whiskey={entry.top.whiskey}
            mine={{ tier: entry.top.tier, score: entry.top.score, overallRank: entry.top.overallRank }}
          />
        </View>
      )}
      ListEmptyComponent={
        isPrivate ? (
          privateState
        ) : rankings.isPending ? (
          <Loading />
        ) : (
          <EmptyState icon="map-outline" title="No regions yet" />
        )
      }
    />
  );
}
