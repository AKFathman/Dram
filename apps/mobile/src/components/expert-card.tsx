import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { Avatar, Button, Card, Chip, ExpertBadge, Row, Text } from '@/components/ui';
import { useToggleFollow } from '@/hooks';
import { CATEGORY_LABELS, type ExpertRow, type WhiskeyCategory } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { compactCount } from '@/lib/format';
import { spacing, useTheme } from '@/theme';

type Status = 'accepted' | 'pending' | null;

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as WhiskeyCategory[];

/** Pick whiskey styles someone knows, up to `max`. */
export function SpecialtyPicker({
  value,
  onChange,
  max = 6,
}: {
  value: WhiskeyCategory[];
  onChange: (next: WhiskeyCategory[]) => void;
  max?: number;
}) {
  const toggle = (c: WhiskeyCategory) =>
    onChange(value.includes(c) ? value.filter((x) => x !== c) : value.length >= max ? value : [...value, c]);
  return (
    <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
      {ALL_CATEGORIES.map((c) => (
        <Chip key={c} label={CATEGORY_LABELS[c]} selected={value.includes(c)} onPress={() => toggle(c)} />
      ))}
    </Row>
  );
}

export function specialtyLine(specialties: readonly WhiskeyCategory[] | null | undefined, max = 3) {
  const list = (specialties ?? []).map((c) => CATEGORY_LABELS[c]);
  return list.length > max ? `${list.slice(0, max).join(' · ')} +${list.length - max}` : list.join(' · ');
}

/**
 * Follow button that answers the tap straight away and rolls back if the
 * request fails, so a list of experts feels instant.
 */
export function FollowButton({ userId, status: initial }: { userId: string; status: Status }) {
  const { user } = useAuth();
  const toggle = useToggleFollow();
  const [status, setStatus] = useState<Status>(initial);
  if (user?.id === userId) return null;

  const onPress = () => {
    const before = status;
    const following = before !== null;
    setStatus(following ? null : 'accepted');
    Haptics.selectionAsync().catch(() => {});
    toggle.mutate(
      { userId, following },
      {
        onError: (e) => {
          setStatus(before);
          Alert.alert('Could not update', e instanceof Error ? e.message : String(e));
        },
      },
    );
  };

  return status === null ? (
    <Button size="sm" title="Follow" onPress={onPress} accessibilityLabel="Follow" />
  ) : (
    <Button
      size="sm"
      variant="secondary"
      title={status === 'pending' ? 'Requested' : 'Following'}
      onPress={onPress}
      accessibilityLabel={status === 'pending' ? 'Cancel follow request' : 'Unfollow'}
    />
  );
}

/** One expert in the directory: who they are, what they know, and a follow button. */
export function ExpertCard({ expert }: { expert: ExpertRow }) {
  const router = useRouter();
  const name = expert.display_name || expert.username || 'Expert';
  const open = () => router.push({ pathname: '/user/[id]', params: { id: expert.id! } });
  return (
    <Card style={{ marginBottom: spacing.md, gap: spacing.md }}>
      <Row gap={spacing.md} style={{ alignItems: 'flex-start' }}>
        <PressableScale onPress={open} scaleTo={0.94} accessibilityRole="button" accessibilityLabel={name}>
          <Avatar uri={expert.avatar_url} name={name} size={52} />
        </PressableScale>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h3" numberOfLines={1} onPress={open}>
            {name}
          </Text>
          <ExpertBadge title={expert.expert_title} />
        </View>
        <FollowButton userId={expert.id!} status={(expert.follow_status as Status) ?? null} />
      </Row>
      {expert.bio ? (
        <Text variant="small" muted numberOfLines={2}>
          {expert.bio}
        </Text>
      ) : null}
      <Row gap={spacing.lg} style={{ flexWrap: 'wrap' }}>
        <Stat value={compactCount(expert.followers_count)} label="followers" />
        <Stat value={compactCount(expert.rankings_count)} label="rankings" />
      </Row>
      {expert.expert_specialties?.length ? (
        <Text variant="small" muted numberOfLines={2}>
          {specialtyLine(expert.expert_specialties, 6)}
        </Text>
      ) : null}
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const t = useTheme();
  return (
    <Text variant="small" muted>
      <Text variant="small" color={t.text} style={{ fontWeight: '700' }}>
        {value}
      </Text>{' '}
      {label}
    </Text>
  );
}

/** A compact expert for horizontal rails. */
export function ExpertTile({ expert }: { expert: ExpertRow }) {
  const t = useTheme();
  const router = useRouter();
  const name = expert.display_name || expert.username || 'Expert';
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: expert.id! } })}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${expert.expert_title ?? 'taste expert'}`}
      scaleTo={0.95}
      style={{ width: 132, alignItems: 'center', gap: 6 }}>
      <View>
        <Avatar uri={expert.avatar_url} name={name} size={72} />
        <ExpertBadge
          compact
          style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: t.card, borderRadius: 12, padding: 3 }}
        />
      </View>
      <Text variant="small" numberOfLines={1} style={{ fontWeight: '700', textAlign: 'center' }}>
        {name}
      </Text>
      <Text variant="caption" muted numberOfLines={2} style={{ textAlign: 'center' }}>
        {expert.expert_title}
      </Text>
    </PressableScale>
  );
}
