/** Moderators: approve or decline taste-expert applications. */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, Linking, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { specialtyLine } from '@/components/expert-card';
import { Appear } from '@/components/motion';
import { Avatar, Button, Card, EmptyState, ErrorState, Input, Loading, Row, Screen, Text } from '@/components/ui';
import { useExpertQueue, useModerateExperts } from '@/hooks';
import type { ExpertQueueItem } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { compactCount } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { spacing, useTheme } from '@/theme';

export default function ExpertReviewScreen() {
  const { profile } = useAuth();
  const isModerator = !!profile?.is_moderator;
  const queue = useExpertQueue(isModerator);

  if (!isModerator) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Moderators only"
          body="This is where expert applications are reviewed."
        />
      </Screen>
    );
  }
  if (queue.isPending) return <Loading style={{ flex: 1 }} />;
  if (queue.isError) return <ErrorState error={queue.error} retry={() => queue.refetch()} />;

  return (
    <Screen edges={[]} padded={false}>
      <FlatList
        data={queue.data ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item, index }) => (
          // Reviewed applications fade out and the rest close the gap.
          <Animated.View exiting={FadeOut.duration(220)} layout={LinearTransition.springify().damping(18)}>
            <Appear index={index}>
              <Application app={item} />
            </Appear>
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-outline"
            title="All caught up"
            body="No applications are waiting for review."
          />
        }
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
      />
    </Screen>
  );
}

function Application({ app }: { app: ExpertQueueItem }) {
  const t = useTheme();
  const router = useRouter();
  const { review } = useModerateExperts();
  const [title, setTitle] = useState(app.requested_title);
  const [note, setNote] = useState('');
  const who = app.applicant;
  const name = who?.display_name || who?.username || 'Applicant';

  const decide = (approve: boolean) =>
    review.mutate(
      { id: app.id, approve, title, note },
      {
        onSuccess: () =>
          Haptics.notificationAsync(
            approve ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
          ).catch(() => {}),
        onError: (e) => Alert.alert('Could not save', e instanceof Error ? e.message : String(e)),
      },
    );

  return (
    <Card style={{ marginBottom: spacing.lg, gap: spacing.md }}>
      <Row gap={spacing.md}>
        <Avatar uri={who?.avatar_url} name={name} size={44} />
        <View style={{ flex: 1 }}>
          <Text
            variant="h3"
            onPress={() => who && router.push({ pathname: '/user/[id]', params: { id: who.id } })}
            numberOfLines={1}>
            {name}
          </Text>
          <Text variant="small" muted>
            @{who?.username} · {compactCount(who?.rankings_count)} rankings · {compactCount(who?.followers_count)}{' '}
            followers · applied {timeAgo(app.created_at)}
          </Text>
        </View>
      </Row>

      <Text>{app.credentials}</Text>
      <Text variant="small" muted>
        {specialtyLine(app.specialties, 6)}
      </Text>
      {app.links.map((l) => (
        <Text key={l} variant="small" color={t.accent} onPress={() => Linking.openURL(l)} numberOfLines={1}>
          {l}
        </Text>
      ))}

      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" muted>
          BADGE TITLE (EDIT BEFORE APPROVING IF NEEDED)
        </Text>
        <Input value={title} onChangeText={setTitle} maxLength={60} />
        <Input placeholder="Note to the applicant (optional)" value={note} onChangeText={setNote} maxLength={500} />
      </View>

      <Row gap={spacing.sm}>
        <Button
          title="Decline"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={review.isPending}
          onPress={() => decide(false)}
        />
        <Button
          title="Approve"
          icon="ribbon"
          style={{ flex: 1 }}
          loading={review.isPending}
          disabled={title.trim().length < 2}
          onPress={() => decide(true)}
        />
      </Row>
    </Card>
  );
}
