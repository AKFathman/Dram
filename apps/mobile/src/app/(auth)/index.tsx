import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button, Screen, Spacer, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

export default function Welcome() {
  const t = useTheme();
  const router = useRouter();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  const run = async (which: 'apple' | 'google') => {
    setBusy(which);
    try {
      await (which === 'apple' ? signInWithApple() : signInWithGoogle());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/canceled|cancelled|ERR_REQUEST_CANCELED/i.test(msg)) Alert.alert('Sign-in failed', msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="wine" size={52} color="#fff" />
        </View>
        <Text variant="title">Dram</Text>
        <Text muted style={{ textAlign: 'center', maxWidth: 300 }}>
          {"Every whiskey you've tried, ranked the easy way. Find your favorites by region, share with friends, and never lose track at a tasting."}
        </Text>
      </View>

      <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              t.scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={{ height: 50 }}
            onPress={() => run('apple')}
          />
        ) : null}
        <Button title="Continue with Google" variant="secondary" icon="logo-google" loading={busy === 'google'} onPress={() => run('google')} />
        <Button title="Continue with email" variant="ghost" icon="mail-outline" onPress={() => router.push('/email')} />
        <Spacer h={spacing.sm} />
        <Text variant="small" muted style={{ textAlign: 'center' }}>
          You must be of legal drinking age in your country to use Dram. Please enjoy responsibly.
        </Text>
      </View>
    </Screen>
  );
}
