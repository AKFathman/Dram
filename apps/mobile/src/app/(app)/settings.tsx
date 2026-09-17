import { useMutation, useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import React, { useState } from 'react';
import { Alert, Linking, Platform, Share, View } from 'react-native';

import { Button, Card, Chip, Input, Row, Screen, Spacer, Text } from '@/components/ui';
import { deleteMyAccount, exportMyData, registerPushToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Enums } from '@/lib/database.types';
import { useUpdateProfile } from '@/hooks';
import { spacing, useTheme } from '@/theme';

type Visibility = Enums<'profile_visibility'>;

const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone on Dram can see your list and tasting notes.' },
  { value: 'followers', label: 'Followers only', hint: 'Only people you approve can see your list.' },
];

const PRIVACY_URL = 'https://dram.app/privacy';
const TERMS_URL = 'https://dram.app/terms';

function pushPlatform(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" muted>
        {label}
      </Text>
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <>
      <Spacer h={spacing.xl} />
      <Text variant="caption" muted>
        {children.toUpperCase()}
      </Text>
      <Spacer h={spacing.sm} />
    </>
  );
}

export default function Settings() {
  const t = useTheme();
  const { profile, signOut } = useAuth();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [country, setCountry] = useState(profile?.home_country ?? '');
  const [region, setRegion] = useState(profile?.home_region ?? '');

  const visibility = profile?.visibility ?? 'public';

  // ------------------------------------------------------------- profile ---
  const saveProfile = () => {
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) {
      return Alert.alert('Pick a username', '3–24 characters: letters, numbers, underscores.');
    }
    if (country.trim() && country.trim().length !== 2) {
      return Alert.alert('Country code', 'Use the 2-letter code, e.g. US or GB.');
    }
    updateProfile.mutate(
      {
        display_name: displayName.trim() || clean,
        username: clean,
        bio: bio.trim() || null,
        home_country: country.trim() ? country.trim().toUpperCase() : null,
        home_region: region.trim() || null,
      },
      {
        onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        onError: (e) => {
          const msg = e instanceof Error ? e.message : String(e);
          Alert.alert('Could not save', /unique|duplicate/i.test(msg) ? 'That username is taken' : msg);
        },
      },
    );
  };

  const setVisibility = (next: Visibility) =>
    updateProfile.mutate(
      { visibility: next },
      { onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : String(e)) },
    );

  // --------------------------------------------------------------- push ----
  const pushStatus = useQuery({
    queryKey: ['push-permission'],
    queryFn: () => Notifications.getPermissionsAsync(),
    staleTime: 0,
  });

  const enablePush = useMutation({
    mutationFn: async () => {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error('Notifications are off. Turn them on in your device settings.');
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) throw new Error('This build has no EAS project id, so push cannot be set up yet.');
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushToken(token.data, pushPlatform());
      return token.data;
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pushStatus.refetch();
    },
    onError: (e) => Alert.alert('Could not enable push', e instanceof Error ? e.message : String(e)),
  });

  const pushLabel = enablePush.isSuccess
    ? 'This device is registered for push.'
    : pushStatus.data?.granted
      ? 'Allowed on this device.'
      : pushStatus.data?.canAskAgain === false
        ? 'Blocked — turn notifications on in your device settings.'
        : 'Not enabled yet.';

  // --------------------------------------------------------------- data ----
  const exportData = useMutation({
    mutationFn: exportMyData,
    onSuccess: (data) => Share.share({ message: JSON.stringify(data, null, 2) }).catch(() => {}),
    onError: (e) => Alert.alert('Could not export', e instanceof Error ? e.message : String(e)),
  });

  const deleteAccount = useMutation({
    mutationFn: deleteMyAccount,
    onError: (e) => Alert.alert('Could not delete your account', e instanceof Error ? e.message : String(e)),
  });

  const confirmDelete = () =>
    Alert.alert('Delete your account?', 'Your list, tasting notes and photos are removed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Really delete everything?', 'Last chance — there is no way to get any of it back.', [
            { text: 'Keep my account', style: 'cancel' },
            { text: 'Delete forever', style: 'destructive', onPress: () => deleteAccount.mutate() },
          ]),
      },
    ]);

  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Could not open', url));

  return (
    <Screen scroll>
      <SectionTitle>Edit profile</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <Field label="DISPLAY NAME">
          <Input value={displayName} onChangeText={setDisplayName} placeholder="How friends see you" />
        </Field>
        <Field label="USERNAME">
          <Input
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            placeholder="peatfreak"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>
        <Field label="BIO">
          <Input
            value={bio}
            onChangeText={setBio}
            placeholder="Sherry bombs and anything from Campbeltown."
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </Field>
        <Row gap={spacing.sm} style={{ alignItems: 'flex-end' }}>
          <View style={{ width: 96 }}>
            <Field label="COUNTRY">
              <Input
                value={country}
                onChangeText={(v) => setCountry(v.toUpperCase().slice(0, 2))}
                placeholder="US"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={2}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="REGION">
              <Input value={region} onChangeText={setRegion} placeholder="Brooklyn, NY" />
            </Field>
          </View>
        </Row>
        <Button title="Save" loading={updateProfile.isPending} onPress={saveProfile} />
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Row gap={spacing.sm}>
          {VISIBILITY.map((v) => (
            <Chip key={v.value} label={v.label} selected={visibility === v.value} onPress={() => setVisibility(v.value)} />
          ))}
        </Row>
        <Text variant="small" muted>
          {VISIBILITY.find((v) => v.value === visibility)?.hint}
        </Text>
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Text variant="small" muted>
          {pushLabel}
        </Text>
        <Button
          title="Enable push notifications"
          variant="secondary"
          icon="notifications-outline"
          loading={enablePush.isPending}
          onPress={() => enablePush.mutate()}
        />
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Button
          title="Export my data"
          variant="secondary"
          icon="download-outline"
          loading={exportData.isPending}
          onPress={() => exportData.mutate()}
        />
        <Button
          title="Delete account"
          variant="danger"
          icon="trash-outline"
          loading={deleteAccount.isPending}
          onPress={confirmDelete}
        />
      </Card>

      <Spacer h={spacing.xl} />
      <Button title="Sign out" variant="ghost" onPress={() => signOut()} />

      <Spacer h={spacing.xl} />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Row gap={spacing.lg}>
          <Text variant="small" color={t.accent} onPress={() => open(PRIVACY_URL)} accessibilityRole="link">
            Privacy policy
          </Text>
          <Text variant="small" color={t.accent} onPress={() => open(TERMS_URL)} accessibilityRole="link">
            Terms
          </Text>
        </Row>
        <Text variant="caption" muted>
          Dram {Constants.expoConfig?.version ?? '—'}
        </Text>
      </View>
      <Spacer h={spacing.xl} />
    </Screen>
  );
}
