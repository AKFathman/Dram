import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Text } from '@/components/ui';
import type { Profile } from '@/lib/api';
import { spacing, useTheme } from '@/theme';

type RowProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> &
  Partial<Pick<Profile, 'bio' | 'rankings_count'>>;

/** One person in a list: avatar, name, @username, optional trailing slot. */
export function UserRow({
  profile,
  right,
  onPress,
  subtitle,
}: {
  profile: RowProfile;
  right?: React.ReactNode;
  onPress?: () => void;
  subtitle?: string;
}) {
  const t = useTheme();
  const router = useRouter();
  const go = onPress ?? (() => router.push({ pathname: '/user/[id]', params: { id: profile.id } }));
  const sub =
    subtitle ??
    (profile.rankings_count != null ? `@${profile.username} · ${profile.rankings_count} ranked` : `@${profile.username}`);
  return (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      accessibilityLabel={profile.display_name || profile.username}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
      <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h3" numberOfLines={1}>
          {profile.display_name || profile.username}
        </Text>
        <Text variant="small" muted numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
