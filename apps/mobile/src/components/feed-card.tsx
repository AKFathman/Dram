import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, BottleImage, Card, Row, ScoreBadge, Text, TierPill } from '@/components/ui';
import { useToggleLike } from '@/hooks';
import { categoryLabel, type FeedItem, type WhiskeyCategory } from '@/lib/api';
import type { Tier } from '@/lib/ranking';
import { timeAgo } from '@/lib/time';
import { radius, spacing, useTheme } from '@/theme';

// The rpc returns jsonb blobs; these are the shapes public.feed() builds.
export type FeedActor = { id: string; username: string; display_name: string; avatar_url: string | null };
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

  const Name = (
    <Text onPress={goActor} style={styles.strong}>
      {actorName}
    </Text>
  );
  const WhiskeyLink = whiskey ? (
    <Text onPress={goWhiskey} color={t.accent} style={styles.strong}>
      {whiskey.name}
    </Text>
  ) : (
    <Text>a whiskey</Text>
  );
  const EventLink = event?.id ? (
    <Text onPress={goEvent} color={t.accent} style={styles.strong}>
      {event.name ?? 'an event'}
    </Text>
  ) : (
    <Text style={styles.strong}>{event?.name ?? 'an event'}</Text>
  );

  let headline: React.ReactNode = null;
  switch (item.kind) {
    case 'rated':
      headline = (
        <Text>
          {Name} {payload?.is_new === false ? 're-ranked ' : 'rated '}
          {WhiskeyLink}
        </Text>
      );
      break;
    case 'tasting_added':
      headline = (
        <Text>
          {Name} added notes on {WhiskeyLink}
        </Text>
      );
      break;
    case 'whiskey_added':
      headline = (
        <Text>
          {Name} added {WhiskeyLink} to the catalog
        </Text>
      );
      break;
    case 'event_created':
    case 'event_joined':
      headline = (
        <Text>
          {Name} {item.kind === 'event_created' ? 'created ' : 'joined '}
          {EventLink}
        </Text>
      );
      break;
    case 'followed':
      headline = (
        <Text>
          {Name} followed{' '}
          <Text onPress={goTarget} color={t.accent} style={styles.strong}>
            {target?.display_name || target?.username || 'someone'}
          </Text>
        </Text>
      );
      break;
    default:
      headline = <Text>{Name} did something</Text>;
  }

  const liked = item.liked_by_me ?? false;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Pressable onPress={goActor} accessibilityRole="button" accessibilityLabel={actorName}>
          <Avatar uri={actor?.avatar_url} name={actorName} size={36} />
        </Pressable>
        <View style={{ flex: 1 }}>{headline}</View>
        <Text variant="caption" muted>
          {item.created_at ? timeAgo(item.created_at) : ''}
        </Text>
      </Row>

      {whiskey && item.kind !== 'whiskey_added' ? (
        <Pressable
          onPress={goWhiskey}
          accessibilityRole="button"
          accessibilityLabel={whiskey.name}
          style={({ pressed }) => [styles.whiskey, { opacity: pressed ? 0.75 : 1 }]}>
          <BottleImage uri={whiskey.image_url} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3" numberOfLines={1}>
              {whiskey.name}
            </Text>
            <Text variant="small" muted numberOfLines={1}>
              {subtitleOf(whiskey)}
            </Text>
            {item.kind === 'rated' && payload?.tier ? (
              <Row gap={6}>
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
        </Pressable>
      ) : null}

      {item.kind === 'tasting_added' && tasting ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {tasting.note ? <Text numberOfLines={6}>{tasting.note}</Text> : null}
          {tasting.nose ? <Detail label="Nose" value={tasting.nose} /> : null}
          {tasting.palate ? <Detail label="Palate" value={tasting.palate} /> : null}
          {tasting.finish ? <Detail label="Finish" value={tasting.finish} /> : null}
          {tasting.flavors?.length ? (
            <Row style={{ flexWrap: 'wrap' }} gap={6}>
              {tasting.flavors.map((f) => (
                <View key={f} style={[styles.flavor, { backgroundColor: t.accentSoft }]}>
                  <Text variant="caption">{prettySlug(f)}</Text>
                </View>
              ))}
            </Row>
          ) : null}
          <Row gap={spacing.md} style={{ flexWrap: 'wrap' }}>
            {tasting.score_total != null ? (
              <Text variant="small" style={styles.strong}>
                {tasting.score_total}
                <Text variant="small" muted>
                  /100
                </Text>
              </Text>
            ) : null}
            {tasting.serving ? (
              <Text variant="small" muted>
                {prettySlug(tasting.serving)}
              </Text>
            ) : null}
          </Row>
          <Row gap={spacing.lg} style={{ marginTop: spacing.xs }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
              disabled={like.isPending}
              onPress={() => like.mutate({ tastingId: tasting.id, liked })}
              hitSlop={8}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? t.danger : t.muted} />
              <Text variant="small" muted>
                {tasting.likes_count ?? 0}
              </Text>
            </Pressable>
            <Row gap={6}>
              <Ionicons name="chatbubble-outline" size={18} color={t.muted} />
              <Text variant="small" muted>
                {tasting.comments_count ?? 0}
              </Text>
            </Row>
          </Row>
        </View>
      ) : null}
    </Card>
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
  whiskey: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  flavor: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
});
