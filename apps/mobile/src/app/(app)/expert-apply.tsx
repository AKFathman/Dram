/** Apply for a taste-expert badge, or see where an application stands. */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { SpecialtyPicker, specialtyLine } from '@/components/expert-card';
import { Appear } from '@/components/motion';
import { Button, Card, ExpertBadge, Input, Loading, Screen, Spacer, Text } from '@/components/ui';
import { useExpertApplication, useMyExpertApplication } from '@/hooks';
import type { WhiskeyCategory } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

const MIN_CREDENTIALS = 40;
const MAX_SPECIALTIES = 6;

export default function ExpertApplyScreen() {
  const { profile } = useAuth();
  const application = useMyExpertApplication();

  if (profile?.expert_since) return <AlreadyExpert />;
  if (application.isPending) return <Loading style={{ flex: 1 }} />;
  if (application.data?.status === 'pending') return <UnderReview />;
  return <ApplicationForm />;
}

function AlreadyExpert() {
  const { profile } = useAuth();
  return (
    <Screen scroll edges={['bottom']}>
      <Spacer h={spacing.xl} />
      <Appear>
        <Card style={{ gap: spacing.md, alignItems: 'flex-start' }}>
          <ExpertBadge title={profile?.expert_title} />
          <Text variant="h2">{"You're a taste expert"}</Text>
          <Text muted>
            Your badge shows on your profile and everything you post, and your rankings count toward Expert picks.
          </Text>
          <Text variant="small" muted>
            {specialtyLine(profile?.expert_specialties, 6)}
          </Text>
        </Card>
      </Appear>
    </Screen>
  );
}

function UnderReview() {
  const router = useRouter();
  const application = useMyExpertApplication();
  const { withdraw } = useExpertApplication();
  const app = application.data!;
  return (
    <Screen scroll edges={['bottom']}>
      <Spacer h={spacing.xl} />
      <Appear>
        <Card style={{ gap: spacing.md }}>
          <Text variant="h2">Your application is under review</Text>
          <Text muted>
            A moderator will look at it and you&apos;ll get a notification either way. Submitted{' '}
            {new Date(app.created_at).toLocaleDateString()}.
          </Text>
          <View style={{ gap: 4 }}>
            <Text variant="caption" muted>
              BADGE TITLE
            </Text>
            <Text>{app.requested_title}</Text>
          </View>
          <View style={{ gap: 4 }}>
            <Text variant="caption" muted>
              SPECIALTIES
            </Text>
            <Text>{specialtyLine(app.specialties, 6)}</Text>
          </View>
        </Card>
      </Appear>
      <Spacer h={spacing.lg} />
      <Button
        title="Withdraw application"
        variant="ghost"
        loading={withdraw.isPending}
        onPress={() =>
          Alert.alert('Withdraw your application?', 'You can apply again later.', [
            { text: 'Keep it', style: 'cancel' },
            {
              text: 'Withdraw',
              style: 'destructive',
              onPress: () => withdraw.mutate(undefined, { onSuccess: () => router.back() }),
            },
          ])
        }
      />
    </Screen>
  );
}

function ApplicationForm() {
  const t = useTheme();
  const router = useRouter();
  const previous = useMyExpertApplication().data;
  const { apply } = useExpertApplication();
  const [title, setTitle] = useState('');
  const [specialties, setSpecialties] = useState<WhiskeyCategory[]>([]);
  const [credentials, setCredentials] = useState('');
  const [links, setLinks] = useState('');

  const linkList = links
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const badLink = linkList.find((l) => !/^https?:\/\/\S+$/i.test(l));
  const ready =
    title.trim().length >= 2 && specialties.length > 0 && credentials.trim().length >= MIN_CREDENTIALS && !badLink;

  const submit = () =>
    apply.mutate(
      { title: title.trim(), specialties, credentials: credentials.trim(), links: linkList.slice(0, 5) },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Alert.alert('Application sent', "A moderator will review it. You'll get a notification either way.");
          router.back();
        },
        onError: (e) => Alert.alert('Could not submit', e instanceof Error ? e.message : String(e)),
      },
    );

  const remaining = Math.max(0, MIN_CREDENTIALS - credentials.trim().length);

  return (
    <Screen scroll edges={['bottom']}>
      <Spacer h={spacing.lg} />
      <Text muted>
        Taste experts get a verified badge, and their rankings power Expert picks. We verify people who work with
        whiskey: distillers, blenders, writers, educators and bar professionals.
      </Text>

      {previous?.status === 'declined' ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.xs, backgroundColor: t.surface }}>
          <Text variant="small" style={{ fontWeight: '700' }}>
            Your last application wasn&apos;t approved
          </Text>
          <Text variant="small" muted>
            {previous.reviewer_note ?? 'No note was left. You are welcome to apply again with more detail.'}
          </Text>
        </Card>
      ) : null}

      <Field label="Title for your badge" hint="How you'd like to be introduced.">
        <Input placeholder="e.g. Bourbon writer, Master blender" value={title} onChangeText={setTitle} maxLength={60} />
      </Field>

      <Field label="Specialties" hint={`Pick up to ${MAX_SPECIALTIES}.`}>
        <SpecialtyPicker value={specialties} onChange={setSpecialties} max={MAX_SPECIALTIES} />
      </Field>

      <Field
        label="Your experience"
        hint={remaining > 0 ? `${remaining} more characters needed.` : 'Where you work, what you do, how long.'}>
        <Input
          placeholder="Where you work, your role, certifications, how long you've been at it."
          value={credentials}
          onChangeText={setCredentials}
          multiline
          maxLength={1500}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
      </Field>

      <Field
        label="Links (optional)"
        hint={
          badLink
            ? `"${badLink}" needs to start with https://`
            : 'A portfolio, publication or workplace page. One per line.'
        }
        error={!!badLink}>
        <Input
          placeholder="https://"
          value={links}
          onChangeText={setLinks}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
      </Field>

      <Spacer h={spacing.xl} />
      <Button title="Send application" disabled={!ready} loading={apply.isPending} onPress={submit} />
      <Spacer h={spacing.sm} />
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        A moderator reviews every application and may get in touch to verify.
      </Text>
    </Screen>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
      <Text variant="h3">{label}</Text>
      {children}
      {hint ? (
        <Text variant="small" color={error ? t.danger : t.muted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
