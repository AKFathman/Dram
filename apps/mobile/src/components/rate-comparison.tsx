/**
 * Step 2 of the rating flow: one head-to-head question at a time. The binary
 * search lives in lib/ranking — this just asks and reports the tap.
 */
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottleImage, Button, Row, ScoreBadge, Text } from '@/components/ui';
import { whiskeySubtitle, type Whiskey } from '@/lib/api';
import type { Answer } from '@/lib/ranking';
import { radius, spacing, useTheme } from '@/theme';

export function RateComparison({
  subject,
  candidate,
  candidateScore,
  asked,
  total,
  onAnswer,
  onBack,
}: {
  subject: Whiskey;
  candidate: Whiskey;
  candidateScore: number | null;
  asked: number;
  total: number;
  onAnswer: (a: Answer) => void;
  onBack: () => void;
}) {
  const t = useTheme();
  const tap = (a: Answer) => {
    Haptics.selectionAsync().catch(() => {});
    onAnswer(a);
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="h2">Which do you prefer?</Text>
        <Text variant="small" muted>
          Question {Math.min(asked + 1, total)} of up to {total}
        </Text>
        <ProgressBar value={asked} total={total} />
      </View>

      <ChoiceCard whiskey={subject} badge="New" onPress={() => tap('new')} />
      <Row style={{ justifyContent: 'center' }}>
        <Text variant="caption" muted>
          OR
        </Text>
      </Row>
      <ChoiceCard whiskey={candidate} score={candidateScore} onPress={() => tap('existing')} />

      <Button title="Too close to call" variant="ghost" onPress={() => tap('same')} />
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
        <Text variant="small" style={{ textAlign: 'center', color: t.muted }}>
          Back to tiers
        </Text>
      </Pressable>
    </View>
  );
}

function ChoiceCard({
  whiskey,
  score,
  badge,
  onPress,
}: {
  whiskey: Whiskey;
  score?: number | null;
  badge?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Prefer ${whiskey.name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: pressed ? t.accent : t.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}>
      <BottleImage uri={whiskey.image_url} size={64} />
      <View style={{ flex: 1, gap: 2 }}>
        {badge ? (
          <Text variant="caption" style={{ color: t.accent }}>
            {badge.toUpperCase()}
          </Text>
        ) : null}
        <Text variant="h3" numberOfLines={2}>
          {whiskey.name}
        </Text>
        <Text variant="small" muted numberOfLines={1}>
          {whiskeySubtitle(whiskey)}
        </Text>
      </View>
      {score != null ? <ScoreBadge score={score} /> : null}
    </Pressable>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const t = useTheme();
  const pct = total <= 0 ? 1 : Math.min(1, value / total);
  return (
    <View
      style={{
        height: 4,
        borderRadius: radius.pill,
        backgroundColor: t.border,
        overflow: 'hidden',
        marginTop: spacing.xs,
      }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: t.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 96,
  },
});
