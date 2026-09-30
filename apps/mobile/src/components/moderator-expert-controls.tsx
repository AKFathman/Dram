/**
 * Moderators only: designate someone a taste expert straight from their
 * profile, change their badge, or take it away. Renders nothing for anyone else.
 */
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { SpecialtyPicker } from '@/components/expert-card';
import { Appear } from '@/components/motion';
import { Button, Card, Input, Row, Text } from '@/components/ui';
import { useModerateExperts } from '@/hooks';
import type { Profile, WhiskeyCategory } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';

export function ModeratorExpertControls({ profile }: { profile: Profile }) {
  const { profile: me } = useAuth();
  const { setExpert, revoke } = useModerateExperts();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(profile.expert_title ?? '');
  const [specialties, setSpecialties] = useState<WhiskeyCategory[]>(profile.expert_specialties ?? []);
  if (!me?.is_moderator) return null;

  const isExpert = !!profile.expert_since;
  const name = profile.display_name || profile.username;

  const save = () =>
    setExpert.mutate(
      { userId: profile.id, title: title.trim(), specialties },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setEditing(false);
        },
        onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : String(e)),
      },
    );

  const remove = () =>
    Alert.alert(`Remove ${name}'s expert badge?`, 'Their rankings stop counting toward Expert picks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          revoke.mutate(profile.id, {
            onError: (e) => Alert.alert('Could not remove', e instanceof Error ? e.message : String(e)),
          }),
      },
    ]);

  return (
    // A plain card: its inputs and chips use the quiet fill, and need a lighter ground to show against.
    <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
      <Text variant="caption" muted>
        MODERATOR
      </Text>
      {editing ? (
        <Appear style={{ gap: spacing.md }}>
          <Input placeholder="Badge title, e.g. Master blender" value={title} onChangeText={setTitle} maxLength={60} />
          <SpecialtyPicker value={specialties} onChange={setSpecialties} />
          <Row gap={spacing.sm}>
            <Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setEditing(false)} />
            <Button
              title={isExpert ? 'Save badge' : 'Make expert'}
              style={{ flex: 1 }}
              loading={setExpert.isPending}
              disabled={title.trim().length < 2 || specialties.length === 0}
              onPress={save}
            />
          </Row>
        </Appear>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Button
            title={isExpert ? 'Edit expert badge' : 'Designate as taste expert'}
            variant="secondary"
            icon="ribbon-outline"
            onPress={() => setEditing(true)}
          />
          {isExpert ? (
            <Button title="Remove expert badge" variant="ghost" loading={revoke.isPending} onPress={remove} />
          ) : null}
        </View>
      )}
    </Card>
  );
}
