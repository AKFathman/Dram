import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Chip, Input, Screen, Spacer, Text } from '@/components/ui';
import { ageOn, completeOnboarding, legalDrinkingAge } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';

const COUNTRIES: { code: string; label: string }[] = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'IE', label: 'Ireland' },
  { code: 'JP', label: 'Japan' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
];

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function Onboarding() {
  const { user, signOut, refreshProfile } = useAuth();
  const suggested = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(suggested);
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('US');
  const [busy, setBusy] = useState(false);

  const minAge = legalDrinkingAge(country);
  const birth = parseDate(dob);
  const usernameOk = /^[a-z0-9_]{3,24}$/.test(username.toLowerCase());
  const ageOk = !!birth && ageOn(birth) >= minAge;

  const submit = async () => {
    if (!usernameOk) return Alert.alert('Pick a username', '3–24 characters: letters, numbers, underscores.');
    if (!birth) return Alert.alert('Enter your birthday as YYYY-MM-DD');
    if (!ageOk) return Alert.alert(`You must be ${minAge}+`, 'Dram is only for people of legal drinking age.');
    setBusy(true);
    try {
      await completeOnboarding({
        username,
        display_name: displayName.trim() || username,
        birthdate: birth,
        home_country: country,
      });
      await refreshProfile();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not finish setup', /unique|duplicate/i.test(msg) ? 'That username is taken.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Spacer h={spacing.xl} />
      <Text variant="title">Set up your profile</Text>
      <Text muted>This takes 20 seconds.</Text>
      <Spacer h={spacing.xl} />

      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            USERNAME
          </Text>
          <Input
            placeholder="e.g. peatfreak"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            DISPLAY NAME
          </Text>
          <Input placeholder="How friends see you" value={displayName} onChangeText={setDisplayName} />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            COUNTRY
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {COUNTRIES.map((c) => (
              <Chip key={c.code} label={c.label} selected={country === c.code} onPress={() => setCountry(c.code)} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" muted>
            BIRTHDAY (YYYY-MM-DD)
          </Text>
          <Input
            placeholder="1990-06-15"
            keyboardType="numbers-and-punctuation"
            value={dob}
            onChangeText={setDob}
            maxLength={10}
          />
          <Text variant="small" muted>
            You must be {minAge} or older. We store only that you passed the check, not your birthday.
          </Text>
        </View>
        <Button title="Let's go" loading={busy} onPress={submit} />
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
