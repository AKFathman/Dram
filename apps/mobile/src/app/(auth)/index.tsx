import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Appear } from '@/components/motion';
import { Button, Screen, Spacer, Text } from '@/components/ui';
import { AppleAuth, useAppleAuthAvailable } from '@/lib/apple-auth';
import { useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

export default function Welcome() {
  const t = useTheme();
  const router = useRouter();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  // Only true on an iPhone whose build actually carries the native module.
  const appleReady = useAppleAuthAvailable();

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
        <Animated.View
          entering={ZoomIn.springify().damping(14).stiffness(140)}
          style={{
            width: 96,
            height: 96,
            borderRadius: 30,
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.sm,
          }}>
          <Ionicons name="wine" size={50} color={t.accentText} />
        </Animated.View>
        <Appear index={1}>
          <Text variant="display">Dram</Text>
        </Appear>
        <Appear index={2} style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text variant="h3" style={{ textAlign: 'center', maxWidth: 320 }}>
            {"Every whiskey you've tried, ranked the easy way."}
          </Text>
          <Text muted style={{ textAlign: 'center', maxWidth: 300 }}>
            Follow taste experts, compare with friends, and keep track at every tasting.
          </Text>
        </Appear>
      </View>

      <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
        {appleReady && AppleAuth ? (
          <Appear index={3}>
            <AppleAuth.AppleAuthenticationButton
              buttonType={AppleAuth.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                t.scheme === 'dark'
                  ? AppleAuth.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuth.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={14}
              style={{ height: 52 }}
              onPress={() => run('apple')}
            />
          </Appear>
        ) : null}
        {/* Email first: it works on every device with no provider setup. */}
        <Appear index={4}>
          <Button title="Continue with email" icon="mail-outline" onPress={() => router.push('/email')} />
        </Appear>
        <Appear index={5}>
          <Button
            title="Continue with Google"
            variant="secondary"
            icon="logo-google"
            loading={busy === 'google'}
            onPress={() => run('google')}
          />
        </Appear>
        <Spacer h={spacing.xs} />
        <Appear index={6}>
          <Text variant="small" muted style={{ textAlign: 'center' }}>
            You must be of legal drinking age in your country to use Dram. Please enjoy responsibly.
          </Text>
        </Appear>
      </View>
    </Screen>
  );
}
