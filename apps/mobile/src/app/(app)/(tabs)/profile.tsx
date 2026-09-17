import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { ProfileStats } from '@/components/profile-stats';
import { Avatar, Button, Card, Divider, EmptyState, IconButton, Loading, Row, Screen, Spacer, Text } from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import { categoryLabel, uploadImage, type WhiskeyCategory } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatScore } from '@/lib/ranking';
import { publicUrl } from '@/lib/supabase';
import { useCollection, useMyRankings, useUpdateProfile, useWishlist } from '@/hooks';
import { spacing, useTheme } from '@/theme';

function Count({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text variant="h3">{n}</Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

/** One "best of" line: a group name on the left, the winner and its score on the right. */
function BestRow({ group, name, score, onPress }: { group: string; name: string; score: number; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Best ${group}: ${name}`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: spacing.sm })}>
      <Row gap={spacing.md}>
        <Text variant="small" muted style={{ width: 110 }} numberOfLines={1}>
          {group}
        </Text>
        <Text style={{ flex: 1 }} numberOfLines={1}>
          {name}
        </Text>
        <Text variant="h3" color={t.accent}>
          {formatScore(score)}
        </Text>
      </Row>
    </Pressable>
  );
}

export default function ProfileTab() {
  const t = useTheme();
  const router = useRouter();
  const { user, profile } = useAuth();
  const rankings = useMyRankings();
  const wishlist = useWishlist(user?.id);
  const collection = useCollection(user?.id);
  const updateProfile = useUpdateProfile();

  const pickAvatar = useMutation({
    mutationFn: async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Photo library access is off. Turn it on in your device settings.');
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (picked.canceled || !picked.assets[0]) return null;
      const asset = picked.assets[0];
      const contentType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const path = await uploadImage('avatars', asset.uri, contentType);
      return publicUrl('avatars', path);
    },
    onSuccess: async (avatar_url) => {
      if (!avatar_url) return;
      updateProfile.mutate({ avatar_url });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e) => Alert.alert('Could not update your photo', e instanceof Error ? e.message : String(e)),
  });

  const list = rankings.list;
  const bestByCategory: { category: WhiskeyCategory; name: string; score: number }[] = [];
  const seenCategory = new Set<WhiskeyCategory>();
  const bestByRegion: { region: string; name: string; score: number }[] = [];
  const seenRegion = new Set<string>();
  for (const r of list) {
    const category = r.whiskey.category;
    if (!seenCategory.has(category)) {
      seenCategory.add(category);
      bestByCategory.push({ category, name: r.whiskey.name, score: r.score });
    }
    const region = r.whiskey.region ?? r.whiskey.country;
    if (region && !seenRegion.has(region)) {
      seenRegion.add(region);
      bestByRegion.push({ region, name: r.whiskey.name, score: r.score });
    }
  }

  const title = (
    <Row>
      <Text variant="title" style={{ flex: 1 }}>
        Profile
      </Text>
      <IconButton name="settings-outline" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
    </Row>
  );

  return (
    <Screen scroll>
      <Spacer h={spacing.sm} />
      {title}
      <Spacer h={spacing.md} />

      <Row gap={spacing.lg} style={{ alignItems: 'flex-start' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change your profile photo"
          onPress={() => pickAvatar.mutate()}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? profile?.username} size={80} />
          {pickAvatar.isPending ? (
            <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={t.accent} />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2" numberOfLines={1}>
            {profile?.display_name ?? 'You'}
          </Text>
          {profile?.username ? (
            <Text variant="small" muted>
              @{profile.username}
            </Text>
          ) : null}
          {profile?.home_region || profile?.home_country ? (
            <Text variant="small" muted>
              {[profile?.home_region, profile?.home_country].filter(Boolean).join(', ')}
            </Text>
          ) : null}
        </View>
      </Row>
      {profile?.bio ? (
        <>
          <Spacer h={spacing.sm} />
          <Text variant="small">{profile.bio}</Text>
        </>
      ) : null}

      <Spacer h={spacing.lg} />
      <Row gap={spacing.xl} style={{ justifyContent: 'flex-start' }}>
        <Count n={profile?.rankings_count ?? 0} label="rankings" />
        <Count n={profile?.followers_count ?? 0} label="followers" />
        <Count n={profile?.following_count ?? 0} label="following" />
      </Row>

      <Spacer h={spacing.lg} />
      <Row gap={spacing.sm}>
        <Button
          title={`Wishlist (${wishlist.data?.length ?? 0})`}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/my-list', params: { filter: 'wishlist' } })}
        />
        <Button
          title={`My bar (${collection.data?.length ?? 0})`}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/my-list', params: { filter: 'bar' } })}
        />
      </Row>

      {rankings.isPending && !rankings.data ? (
        <Loading />
      ) : list.length === 0 ? (
        <>
          <Spacer h={spacing.lg} />
          <EmptyState
            icon="wine-outline"
            title="Your list is empty"
            body="Rate a whiskey and it slots into your ranking straight away."
            action={<Button title="Log your first whiskey" onPress={() => router.push('/log')} />}
          />
        </>
      ) : (
        <>
          <Spacer h={spacing.lg} />
          <ProfileStats list={list} />

          <Spacer h={spacing.xl} />
          <Row>
            <Text variant="h2" style={{ flex: 1 }}>
              Top 5
            </Text>
            <Button title="See full ranking" variant="ghost" onPress={() => router.push('/my-list')} />
          </Row>
          {list.slice(0, 5).map((r, i) => (
            <WhiskeyRow key={r.whiskey_id} whiskey={r.whiskey} mine={r} rank={i + 1} />
          ))}

          {bestByCategory.length ? (
            <>
              <Spacer h={spacing.xl} />
              <Text variant="h2">Best by category</Text>
              <Spacer h={spacing.sm} />
              <Card>
                {bestByCategory.map((b, i) => (
                  <View key={b.category}>
                    {i > 0 ? <Divider /> : null}
                    <BestRow
                      group={categoryLabel(b.category)}
                      name={b.name}
                      score={b.score}
                      onPress={() => router.push({ pathname: '/my-list', params: { filter: `category:${b.category}` } })}
                    />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {bestByRegion.length ? (
            <>
              <Spacer h={spacing.xl} />
              <Text variant="h2">Best by region</Text>
              <Spacer h={spacing.sm} />
              <Card>
                {bestByRegion.map((b, i) => (
                  <View key={b.region}>
                    {i > 0 ? <Divider /> : null}
                    <BestRow
                      group={b.region}
                      name={b.name}
                      score={b.score}
                      onPress={() => router.push({ pathname: '/my-list', params: { filter: `region:${b.region}` } })}
                    />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
      <Spacer h={spacing.xl} />
    </Screen>
  );
}
