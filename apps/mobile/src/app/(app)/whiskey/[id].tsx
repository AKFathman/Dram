import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { DiscoverHorizontal } from '@/components/discover-horizontal';
import {
  BottleImage,
  Button,
  Card,
  Divider,
  ErrorState,
  IconButton,
  Loading,
  Row,
  ScoreBadge,
  Screen,
  Spacer,
  Text,
  TierPill,
} from '@/components/ui';
import { UserRow } from '@/components/user-row';
import { WhiskeyCommunity } from '@/components/whiskey-community';
import { WhiskeyFacts } from '@/components/whiskey-facts';
import { SectionHeader } from '@/components/section-header';
import { useMyRankingFor, useTastings, useToggleWishlist, useWhiskey, useWhiskeyExtras, useWishlist } from '@/hooks';
import { reportContent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/time';
import { radius, spacing, useTheme } from '@/theme';

export default function WhiskeyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const whiskeyQuery = useWhiskey(id);
  const extras = useWhiskeyExtras(id);
  const my = useMyRankingFor(id);
  const tastings = useTastings(user?.id, id);
  const wishlist = useWishlist(user?.id);
  const toggleWishlist = useToggleWishlist();

  const w = whiskeyQuery.data;
  const wished = !!wishlist.data?.some((row) => row.whiskey_id === id);
  const ranking = my.ranking;

  const report = async (reason: 'inaccurate' | 'duplicate') => {
    try {
      await reportContent({ target_type: 'whiskey', target_id: id, reason });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thanks', 'A moderator will take a look.');
    } catch (e) {
      Alert.alert('Could not send report', e instanceof Error ? e.message : String(e));
    }
  };

  const openMenu = () =>
    Alert.alert(w?.name ?? 'Whiskey', undefined, [
      { text: 'Report inaccurate', onPress: () => report('inaccurate') },
      { text: 'Report duplicate', onPress: () => report('duplicate') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  if (whiskeyQuery.isPending) return <Loading />;
  if (whiskeyQuery.isError || !w) {
    return <ErrorState error={whiskeyQuery.error} retry={() => whiskeyQuery.refetch()} />;
  }

  const friends = extras.data?.friends ?? [];
  const flavors = extras.data?.flavors ?? [];
  const similar = extras.data?.similar ?? [];
  const brandLine = [w.brand, w.distillery_name].filter(Boolean).join(' · ');

  return (
    <>
      <Stack.Screen
        options={{
          title: w.name,
          headerRight: () => (
            <IconButton name="ellipsis-horizontal" accessibilityLabel="More options" onPress={openMenu} />
          ),
        }}
      />
      <Screen scroll edges={[]}>
        <View style={{ alignItems: 'center', paddingTop: spacing.lg, gap: spacing.sm }}>
          <BottleImage uri={w.image_url} size={160} />
          <Text variant="title" style={{ textAlign: 'center' }}>
            {w.name}
          </Text>
          {brandLine ? (
            <Text muted style={{ textAlign: 'center' }}>
              {brandLine}
            </Text>
          ) : null}
          {w.status === 'pending' ? (
            <Text variant="caption" color={t.accent}>
              Unverified · added by a member
            </Text>
          ) : null}
        </View>

        <Spacer h={spacing.lg} />
        <WhiskeyFacts whiskey={w} />

        <Spacer h={spacing.md} />
        <WhiskeyCommunity whiskey={w} />

        <Spacer h={spacing.md} />
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="h3">My take</Text>
            <IconButton
              name={wished ? 'heart' : 'heart-outline'}
              color={wished ? t.danger : t.muted}
              accessibilityLabel={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              onPress={() => toggleWishlist.mutate({ whiskeyId: id, on: !wished })}
            />
          </Row>
          {ranking ? (
            <>
              <Row gap={spacing.md}>
                <ScoreBadge score={ranking.score} />
                <View style={{ gap: 4 }}>
                  <TierPill tier={ranking.tier} style={{ alignSelf: 'flex-start' }} />
                  <Text variant="small" muted>
                    #{ranking.overallRank} of {my.list.length}
                  </Text>
                </View>
              </Row>
              <Row gap={spacing.sm}>
                <Button
                  title="Re-rate"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => router.push({ pathname: '/rate/[whiskeyId]', params: { whiskeyId: id } })}
                />
                <Button
                  title="Add notes"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => router.push({ pathname: '/tasting/[id]', params: { id: 'new', whiskeyId: id } })}
                />
              </Row>
            </>
          ) : (
            <Button
              title="Rate it"
              icon="star-outline"
              onPress={() => router.push({ pathname: '/rate/[whiskeyId]', params: { whiskeyId: id } })}
            />
          )}
        </Card>

        {friends.length ? (
          <>
            <SectionHeader title="Friends' takes" />
            <Card style={{ paddingVertical: 0 }}>
              {friends.map((f) => (
                <UserRow
                  key={f.user_id ?? f.username ?? ''}
                  profile={{
                    id: f.user_id ?? '',
                    username: f.username ?? '',
                    display_name: f.display_name ?? f.username ?? '',
                    avatar_url: f.avatar_url,
                  }}
                  subtitle={
                    f.overall_rank != null && f.total != null
                      ? `#${f.overall_rank} of ${f.total}`
                      : `@${f.username ?? ''}`
                  }
                  right={
                    <Row gap={spacing.sm}>
                      {f.tier ? <TierPill tier={f.tier} /> : null}
                      <ScoreBadge score={f.score} size="sm" />
                    </Row>
                  }
                />
              ))}
            </Card>
          </>
        ) : null}

        {flavors.length ? (
          <>
            <SectionHeader title="Flavor profile" />
            <Row style={{ flexWrap: 'wrap' }} gap={spacing.sm}>
              {flavors.map((f) => (
                <View
                  key={f.tag_slug ?? f.label ?? ''}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: t.accentSoft,
                  }}>
                  <Text variant="small">
                    {f.label ?? f.tag_slug} · {f.tasting_count ?? 0}
                  </Text>
                </View>
              ))}
            </Row>
          </>
        ) : null}

        {similar.length ? (
          <>
            <SectionHeader title="Similar whiskeys" />
            <DiscoverHorizontal data={similar} />
          </>
        ) : null}

        {tastings.data?.length ? (
          <>
            <SectionHeader title="My tastings" />
            <Card style={{ paddingVertical: spacing.sm }}>
              {tastings.data.map((ts, i) => (
                <View key={ts.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Tasting from ${formatDate(ts.tasted_at)}`}
                    onPress={() => router.push({ pathname: '/tasting/[id]', params: { id: ts.id } })}
                    style={({ pressed }) => [{ paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 }]}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text variant="small" style={{ fontWeight: '600' }}>
                        {formatDate(ts.tasted_at)}
                        {ts.serving ? ` · ${ts.serving}` : ''}
                      </Text>
                      {ts.score_total != null ? (
                        <Text variant="small" muted>
                          {ts.score_total}/100
                        </Text>
                      ) : null}
                    </Row>
                    {ts.note ? (
                      <Text variant="small" muted numberOfLines={2}>
                        {ts.note}
                      </Text>
                    ) : null}
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {w.description ? (
          <>
            <SectionHeader title="About" />
            <Text muted>{w.description}</Text>
          </>
        ) : null}
        <Spacer h={spacing.xxl} />
      </Screen>
    </>
  );
}
