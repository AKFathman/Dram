import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Input, Screen, Spacer, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';

export default function EmailSignIn() {
  const { signInWithEmail, verifyEmailCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      Alert.alert('Check your email address');
      return;
    }
    setBusy(true);
    try {
      await signInWithEmail(e);
      setSent(true);
    } catch (err) {
      Alert.alert('Could not send code', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await verifyEmailCode(email.trim().toLowerCase(), code.trim());
      // The root layout routes to onboarding or the app once the session lands.
    } catch (err) {
      Alert.alert('Code not accepted', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Spacer h={spacing.xl} />
      {!sent ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="h2">{"What's your email?"}</Text>
          <Text muted>{"We'll send a 6-digit code. No password to remember."}</Text>
          <Input
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={send}
          />
          <Button title="Send code" loading={busy} onPress={send} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text variant="h2">Check your inbox</Text>
          <Text muted>Enter the code we sent to {email.trim()}. You can also tap the link in the email.</Text>
          <Input
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChangeText={setCode}
            onSubmitEditing={verify}
            style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center' }}
          />
          <Button title="Verify" loading={busy} disabled={code.trim().length < 6} onPress={verify} />
          <Button title="Use a different email" variant="ghost" onPress={() => setSent(false)} />
        </View>
      )}
    </Screen>
  );
}
