import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { PRESS_SPRING, PressableScale, Skeleton } from '@/components/motion';
import { Avatar, BottleImage, Card, ExpertBadge, Row, ScoreBadge, Text, TierPill } from '@/components/ui';
import { useToggleLike } from '@/hooks';
import { categoryLabel, type FeedItem, type WhiskeyCategory } from '@/lib/api';
import type { Tier } from '@/lib/ranking';
import { timeAgo } from '@/lib/time';
import { radius, spacing, useTheme } from '@/theme';

// The rpc returns jsonb blobs; these are the shapes public.feed() builds.
export type FeedActor = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  expert_title?: string | null;
};
export type FeedWhiskey = {
  id: string;
  name: string;
  brand: string | null;
  distillery_name: string | null;
  category: WhiskeyCategory | null;
  region: string | null;
  country: string | null;
  age_years: number | null;
  abv: number | null;
  image_url: string | null;
  avg_score: number | null;
  ratings_count: number | null;
};
export type FeedTasting = {
  id: string;
  note: string | null;
  nose: string | null;
  palate: string | null;
  finish: string | null;
  serving: string | null;
  setting: string | null;
  score_total: number | null;
  likes_count: number | null;
  comments_count: number | null;
  tasted_at: string | null;
  flavors: string[] | null;
};
export type FeedEventRef = {
  id: string | null;
  name: string | null;
  starts_at: string | null;
  venue_name: string | null;
};
export type FeedPayload = {
  tier: Tier | null;
  score: number | null;
  overall_rank: number | null;
  total: number | null;
  is_new: boolean | null;
};

function subtitleOf(w: FeedWhiskey) {
  const place = w.region ?? w.country;
  const parts = [place, categoryLabel(w.category)].filter(Boolean) as string[];
  if (w.age_years != null) parts.push(`${w.age_years} yr`);
  if (w.abv != null) parts.push(`${w.abv}%`);
  return parts.join(' · ');
}

function prettySlug(slug: string) {
  return slug.replace(/[-_]/g, ' ');
}

/** A heart that pops when it turns on. */
function LikeHeart({ liked }: { liked: boolean }) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const wasLiked = useRef(liked);
  useEffect(() => {
    if (liked && !wasLiked.current)
      scale.set(withSequence(withSpring(1.35, PRESS_SPRING), withSpring(1, PRESS_SPRING)));
    wasLiked.current = liked;
  }, [liked, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={animated}>
      <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? t.danger : t.muted} />
    </Animated.View>
  );
}

export function FeedCard({ item }: { item: FeedItem }) {
  const t = useTheme();
  const router = useRouter();
  const like = useToggleLike();

  const actor = item.actor as FeedActor | null;
  const whiskey = item.whiskey as FeedWhiskey | null;
  const tasting = item.tasting as FeedTasting | null;
  const event = item.event as FeedEventRef | null;
  const target = item.target_user as FeedActor | null;
  const payload = item.payload as FeedPayload | null;

  const actorName = actor?.display_name || actor?.username || 'Someone';
  const goActor = () => {
    if (actor) router.push({ pathname: '/user/[id]', params: { id: actor.id } });
  };
  const goWhiskey = () => {
    if (whiskey) router.push({ pathname: '/whiskey/[id]', params: { id: whiskey.id } });
  };
  const goEvent = () => {
    if (event?.id) router.push({ pathname: '/event/[id]', params: { id: event.id } });
  };
  const goTarget = () => {
    if (target) router.push({ pathname: '/user/[id]', params: { id: target.id } });
  };

  // What they did, in a few words. The whiskey itself is named once, in the
  // panel below, rather than repeated in this sentence.
  let action: React.ReactNode;
  switch (item.kind) {
    case 'rated':
      action = payload?.is_new === false ? 're-ranked' : 'rated';
      break;
    case 'tasting_added':
      action = 'added a tasting note';
      break;
    case 'whiskey_added':
      action = 'added to the catalog';
      break;
    case 'event_created':
    case 'event_joined':
      action = (
        <>
          {item.kind === 'event_created' ? 'created ' : 'joined '}
          <Text variant="small" onPress={event?.id ? goEvent : undefined} color={t.text} style={styles.strong}>
            {event?.name ?? 'an event'}
          </Text>
        </>
      );
      break;
    case 'followed':
      action = (
        <>
          {'followed '}
          <Text variant="small" onPress={goTarget} color={t.text} style={styles.strong}>
            {target?.display_name || target?.username || 'someone'}
          </Text>
        </>
      );
      break;
    default:
      action = 'was here';
  }

  const liked = item.liked_by_me ?? false;
  const isExpert = !!actor?.expert_title;

  return (
    <Card style={{ marginBottom: spacing.md, gap: spacing.md }}>
      <Row style={{ alignItems: 'center' }} gap={spacing.md}>
        <Pressable onPress={goActor} accessibilityRole="button" accessibilityLabel={actorName}>
          <Avatar uri={actor?.avatar_url} name={actorName} size={40} />
        </Pressable>
        <View style={{ flex: 1, gap: 1 }}>
          <Row gap={5}>
            <Text onPress={goActor} numberOfLines={1} style={[styles.strong, { flexShrink: 1 }]}>
              {actorName}
            </Text>
            {isExpert ? <ExpertBadge compact title={actor?.expert_title} /> : null}
            <Text variant="small" muted>
              · {item.created_at ? timeAgo(item.created_at) : ''}
            </Text>
          </Row>
          <Text variant="small" muted numberOfLines={1}>
            {isExpert ? `${actor?.expert_title} · ` : ''}
            {action}
          </Text>
        </View>
      </Row>

      {whiskey ? (
        <PressableScale
          onPress={goWhiskey}
          accessibilityRole="button"
          accessibilityLabel={whiskey.name}
          scaleTo={0.98}
          style={[styles.whiskey, { backgroundColor: t.surface }]}>
          <BottleImage uri={whiskey.image_url} size={48} style={{ backgroundColor: t.card }} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="h3" numberOfLines={1}>
              {whiskey.name}
            </Text>
            <Text variant="small" muted numberOfLines={1}>
              {subtitleOf(whiskey)}
            </Text>
            {item.kind === 'rated' && payload?.tier ? (
              <Row gap={6} style={{ marginTop: 2 }}>
                <TierPill tier={payload.tier} />
                {payload.overall_rank != null && payload.total != null ? (
                  <Text variant="caption" muted>
                    #{payload.overall_rank} of {payload.total}
                  </Text>
                ) : null}
              </Row>
            ) : null}
          </View>
          {item.kind === 'rated' ? <ScoreBadge score={payload?.score ?? null} /> : null}
        </PressableScale>
      ) : null}

      {item.kind === 'tasting_added' && tasting ? (
        <View style={{ gap: spacing.md }}>
          {tasting.note ? <Text numberOfLines={5}>{tasting.note}</Text> : null}
          {tasting.nose ? <Detail label="Nose" value={tasting.nose} /> : null}
          {tasting.palate ? <Detail label="Palate" value={tasting.palate} /> : null}
          {tasting.finish ? <Detail label="Finish" value={tasting.finish} /> : null}
          {tasting.flavors?.length ? (
            <Row style={{ flexWrap: 'wrap' }} gap={6}>
              {tasting.flavors.slice(0, 6).map((f) => (
                <View key={f} style={[styles.flavor, { backgroundColor: t.surface }]}>
                  <Text variant="caption" muted>
                    {prettySlug(f)}
                  </Text>
                </View>
              ))}
            </Row>
          ) : null}
          <Row gap={spacing.lg}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
              accessibilityState={{ selected: liked }}
              disabled={like.isPending}
              onPress={() => like.mutate({ tastingId: tasting.id, liked })}
              hitSlop={8}
              scaleTo={0.85}
              style={styles.action}>
              <LikeHeart liked={liked} />
              <Text variant="small" muted>
                {tasting.likes_count ?? 0}
              </Text>
            </PressableScale>
            <Row gap={6}>
              <Ionicons name="chatbubble-outline" size={18} color={t.muted} />
              <Text variant="small" muted>
                {tasting.comments_count ?? 0}
              </Text>
            </Row>
            <View style={{ flex: 1 }} />
            <Text variant="small" muted>
              {[
                tasting.serving ? prettySlug(tasting.serving) : null,
                tasting.score_total != null ? `${tasting.score_total}/100` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Row>
        </View>
      ) : null}
    </Card>
  );
}

/** Stand-in cards while the feed loads, shaped like the real thing. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} style={{ marginBottom: spacing.md, gap: spacing.md }}>
          <Row gap={spacing.md}>
            <Skeleton width={40} height={40} rounded={20} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="45%" height={14} />
              <Skeleton width="30%" height={12} />
            </View>
          </Row>
          <Skeleton height={72} rounded={radius.md} />
          <Skeleton width="85%" height={14} />
        </Card>
      ))}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text variant="small" numberOfLines={3}>
      <Text variant="small" muted style={styles.strong}>
        {label}:{' '}
      </Text>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  strong: { fontWeight: '700' },
  whiskey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  flavor: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
