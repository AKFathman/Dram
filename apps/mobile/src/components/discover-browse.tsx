import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';

import { DiscoverCard, DiscoverHorizontal } from '@/components/discover-horizontal';
import { ExpertTile } from '@/components/expert-card';
import { PickCard } from '@/components/expert-pick';
import { Appear, Skeleton } from '@/components/motion';
import { SectionHeader } from '@/components/section-header';
import { Chip, Loading, Row, Text } from '@/components/ui';
import { useExpertPicks, useExperts, useFriendsLoved, useTop, useTrending } from '@/hooks';
import { CATEGORY_GROUPS, type Whiskey, type WhiskeyCategory } from '@/lib/api';
import { spacing } from '@/theme';

const REGIONS: { label: string; region?: string; country?: string }[] = [
  { label: 'Kentucky', region: 'Kentucky' },
  { label: 'Tennessee', region: 'Tennessee' },
  { label: 'Islay', region: 'Islay' },
  { label: 'Speyside', region: 'Speyside' },
  { label: 'Highlands', region: 'Highlands' },
  { label: 'Campbeltown', region: 'Campbeltown' },
  { label: 'Ireland', country: 'IE' },
  { label: 'Japan', country: 'JP' },
  { label: 'Canada', country: 'CA' },
];

/** The "nothing typed yet" state of Discover: browse by category, then rails. */
export function DiscoverBrowse({
  selected,
  onSelectCategories,
}: {
  selected: WhiskeyCategory[];
  onSelectCategories: (categories: WhiskeyCategory[]) => void;
}) {
  const router = useRouter();
  const [regionIndex, setRegionIndex] = useState(0);
  const region = REGIONS[regionIndex]!;
  const picks = useExpertPicks();
  const experts = useExperts();
  const trending = useTrending();
  const top = useTop({ region: region.region, country: region.country });
  const friends = useFriendsLoved();

  const loved = (friends.data ?? [])
    .map((r) => ({ whiskey: r.whiskey as Whiskey | null, count: r.friend_count ?? 0 }))
    .filter((r): r is { whiskey: Whiskey; count: number } => !!r.whiskey);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.md }}
        contentContainerStyle={{ gap: spacing.sm }}>
        {CATEGORY_GROUPS.map((g) => {
          const isOn = g.categories.every((c) => selected.includes(c)) && selected.length === g.categories.length;
          return (
            <Chip
              key={g.label}
              label={g.label}
              selected={isOn}
              onPress={() => onSelectCategories(isOn ? [] : g.categories)}
            />
          );
        })}
      </ScrollView>

      {picks.isPending || picks.data?.length ? (
        <Appear index={1}>
          <SectionHeader
            title="Expert picks"
            action={{ label: 'See all', onPress: () => router.push('/expert-picks') }}
          />
          {picks.isPending ? (
            <RailSkeleton width={148} height={200} />
          ) : (
            <FlatList
              horizontal
              data={picks.data}
              keyExtractor={(p) => p.whiskey_id!}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.xs }}
              renderItem={({ item }) => <PickCard pick={item} />}
            />
          )}
        </Appear>
      ) : null}

      <Appear index={2}>
        <SectionHeader title="Taste experts" action={{ label: 'See all', onPress: () => router.push('/experts') }} />
        {experts.isPending ? (
          <RailSkeleton width={132} height={130} />
        ) : experts.data?.length ? (
          <FlatList
            horizontal
            data={experts.data}
            keyExtractor={(e) => e.id!}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
            renderItem={({ item }) => <ExpertTile expert={item} />}
          />
        ) : (
          <Text variant="small" muted style={{ paddingVertical: spacing.sm }}>
            Verified experts will appear here.
          </Text>
        )}
      </Appear>

      <SectionHeader title="Trending" />
      <DiscoverHorizontal data={trending.data} loading={trending.isPending} empty="No ratings in the last two weeks." />

      <SectionHeader title="Top rated" />
      <FlatList
        horizontal
        data={REGIONS}
        keyExtractor={(r) => r.label}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
        renderItem={({ item, index }) => (
          <Chip label={item.label} selected={index === regionIndex} onPress={() => setRegionIndex(index)} />
        )}
      />
      <DiscoverHorizontal data={top.data} loading={top.isPending} empty={`Nothing rated in ${region.label} yet.`} />

      <SectionHeader title="Friends loved" />
      {friends.isPending ? (
        <Loading style={{ padding: spacing.lg }} />
      ) : loved.length === 0 ? (
        <Text variant="small" muted style={{ paddingVertical: spacing.sm }}>
          Follow a few people to see what they love.
        </Text>
      ) : (
        <FlatList
          horizontal
          data={loved}
          keyExtractor={(r) => r.whiskey.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.xs }}
          renderItem={({ item }) => (
            <DiscoverCard
              whiskey={item.whiskey}
              subtitle={`${item.count} ${item.count === 1 ? 'friend' : 'friends'} loved it`}
            />
          )}
        />
      )}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function RailSkeleton({ width, height }: { width: number; height: number }) {
  return (
    <Row gap={spacing.md} style={{ overflow: 'hidden', paddingVertical: spacing.xs }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width={width} height={height} rounded={20} />
      ))}
    </Row>
  );
}
