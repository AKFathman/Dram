import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Chip, Input, Row, Screen, Spacer, Text } from '@/components/ui';
import type { Enums } from '@/lib/database.types';
import { deviceTimeZone, parseLocalDateTime, tonightAt19 } from '@/lib/event-time';
import { useCreateEvent } from '@/hooks';
import { spacing, useTheme } from '@/theme';

type Visibility = Enums<'event_visibility'>;

const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'code', label: 'Invite by code', hint: 'Only people with the 6-character join code can see the lineup.' },
  { value: 'public', label: 'Public', hint: 'Anyone on Dram can find this event and join it.' },
];

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

export default function NewEvent() {
  const t = useTheme();
  const router = useRouter();
  const create = useCreateEvent();
  const timezone = deviceTimeZone();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [startsAt, setStartsAt] = useState(tonightAt19);
  const [endsAt, setEndsAt] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('code');

  const start = parseLocalDateTime(startsAt);
  const end = endsAt.trim() ? parseLocalDateTime(endsAt) : null;
  const endInvalid = endsAt.trim().length > 0 && !end;
  const trimmed = (v: string) => (v.trim() ? v.trim() : null);

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Name your event', 'Give it something people will recognise on the invite.');
    if (!start) return Alert.alert('Check the start time', 'Use the format YYYY-MM-DD HH:mm, e.g. 2026-10-04 19:00.');
    if (endInvalid) return Alert.alert('Check the end time', 'Use the format YYYY-MM-DD HH:mm, or leave it blank.');
    if (end && end.getTime() <= start.getTime())
      return Alert.alert('Check the end time', 'It has to be after the start.');
    try {
      const event = await create.mutateAsync({
        name: name.trim(),
        description: trimmed(description),
        venue_name: trimmed(venue),
        address: trimmed(address),
        starts_at: start.toISOString(),
        ends_at: end ? end.toISOString() : null,
        timezone,
        visibility,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/event/[id]/manage', params: { id: event.id } });
    } catch (e) {
      Alert.alert('Could not create the event', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen scroll edges={['bottom']}>
      <Spacer h={spacing.lg} />
      <View style={{ gap: spacing.lg }}>
        <Field label="NAME">
          <Input placeholder="Friday night Islay flight" value={name} onChangeText={setName} autoFocus />
        </Field>

        <Field label="DESCRIPTION">
          <Input
            placeholder="What are we drinking, and who's coming?"
            value={description}
            onChangeText={setDescription}
            multiline
            style={{ minHeight: 88, textAlignVertical: 'top' }}
          />
        </Field>

        <Field label="VENUE">
          <Input placeholder="The back room" value={venue} onChangeText={setVenue} />
        </Field>

        <Field label="ADDRESS">
          <Input placeholder="21 Distillery Row" value={address} onChangeText={setAddress} />
        </Field>

        <Field label="STARTS (YYYY-MM-DD HH:mm)">
          <Input
            placeholder="2026-10-04 19:00"
            value={startsAt}
            onChangeText={setStartsAt}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
          />
          {startsAt.trim() && !start ? (
            <Text variant="small" color={t.danger}>
              Use the format YYYY-MM-DD HH:mm.
            </Text>
          ) : null}
        </Field>

        <Field label="ENDS (OPTIONAL)">
          <Input
            placeholder="2026-10-04 22:30"
            value={endsAt}
            onChangeText={setEndsAt}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
          />
          {endInvalid ? (
            <Text variant="small" color={t.danger}>
              Use the format YYYY-MM-DD HH:mm, or leave it blank.
            </Text>
          ) : null}
        </Field>

        <Field label="TIME ZONE">
          <Card style={{ paddingVertical: 12 }}>
            <Text>{timezone}</Text>
            <Text variant="small" muted>
              Taken from this device.
            </Text>
          </Card>
        </Field>

        <Field label="WHO CAN JOIN">
          <Row gap={spacing.sm}>
            {VISIBILITY.map((v) => (
              <Chip
                key={v.value}
                label={v.label}
                selected={visibility === v.value}
                onPress={() => setVisibility(v.value)}
              />
            ))}
          </Row>
          <Text variant="small" muted>
            {VISIBILITY.find((v) => v.value === visibility)?.hint}
          </Text>
        </Field>

        <Button title="Create event" loading={create.isPending} onPress={submit} />
      </View>
    </Screen>
  );
}
