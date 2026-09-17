import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { BottleImage, Loading, ScoreBadge, Text } from '@/components/ui';
import { whiskeySubtitle, type Whiskey } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

const CARD_W = 132;

export function DiscoverCard({
  whiskey,
  subtitle,
  onPress,
}: {
  whiskey: Whiskey;
  subtitle?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const go = onPress ?? (() => router.push({ pathname: '/whiskey/[id]', params: { id: whiskey.id } }));
  return (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      accessibilityLabel={whiskey.name}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.75 : 1 },
      ]}>
      <View>
        <BottleImage uri={whiskey.image_url} size={CARD_W - spacing.lg * 2} />
        <ScoreBadge score={whiskey.avg_score} size="sm" style={styles.badge} />
      </View>
      <Text variant="small" numberOfLines={2} style={{ fontWeight: '600' }}>
        {whiskey.name}
      </Text>
      <Text variant="caption" muted numberOfLines={1}>
        {subtitle ?? whiskeySubtitle(whiskey)}
      </Text>
    </Pressable>
  );
}

/** Horizontal rail of small whiskey cards — used by Discover and whiskey detail. */
export function DiscoverHorizontal({
  data,
  loading,
  subtitleFor,
  empty,
}: {
  data: Whiskey[] | undefined;
  loading?: boolean;
  subtitleFor?: (w: Whiskey) => string;
  empty?: string;
}) {
  if (loading && !data) return <Loading style={{ padding: spacing.lg }} />;
  if (!data?.length) {
    return empty ? (
      <Text variant="small" muted style={{ paddingVertical: spacing.sm }}>
        {empty}
      </Text>
    ) : null;
  }
  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={(w) => w.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.xs }}
      renderItem={({ item }) => <DiscoverCard whiskey={item} subtitle={subtitleFor?.(item)} />}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { position: 'absolute', right: -6, bottom: -6 },
});
