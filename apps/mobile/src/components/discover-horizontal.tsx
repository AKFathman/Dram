import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { PressableScale, Skeleton } from '@/components/motion';
import { BottleImage, Row, ScoreBadge, Text } from '@/components/ui';
import { whiskeySubtitle, type Whiskey } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

/** Shared with expert picks so every rail on Discover reads the same. */
export const CARD_W = 148;

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
    <PressableScale
      onPress={go}
      accessibilityRole="button"
      accessibilityLabel={whiskey.name}
      scaleTo={0.97}
      style={styles.card}>
      <View>
        <BottleImage uri={whiskey.image_url} size={CARD_W} style={{ borderRadius: radius.lg }} />
        <ScoreBadge score={whiskey.avg_score} size="sm" style={[styles.badge, { borderColor: t.bg }]} />
      </View>
      <Text variant="small" numberOfLines={2} style={{ fontWeight: '700' }}>
        {whiskey.name}
      </Text>
      <Text variant="caption" muted numberOfLines={1}>
        {subtitle ?? whiskeySubtitle(whiskey)}
      </Text>
    </PressableScale>
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
  if (loading && !data) {
    return (
      <Row gap={spacing.md} style={{ overflow: 'hidden', paddingVertical: spacing.xs }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={CARD_W} height={CARD_W + 44} rounded={20} />
        ))}
      </Row>
    );
  }
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
  card: { width: CARD_W, gap: spacing.xs },
  badge: { position: 'absolute', right: 8, bottom: 8, borderWidth: 2 },
});
