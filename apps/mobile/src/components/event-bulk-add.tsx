import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Chip, Input, Row, Text } from '@/components/ui';
import type { LineMatch } from '@/lib/api';
import { usePourMutations } from '@/hooks';
import { spacing, useTheme } from '@/theme';

type PourMutations = ReturnType<typeof usePourMutations>;

/** Below this the fuzzy match is a coin flip, so we do not preselect it. */
const CONFIDENT = 0.45;

interface Review extends LineMatch {
  selected: boolean;
}

/**
 * Paste a menu, one whiskey per line, and let the server fuzzy-match each line
 * against the catalog before anything is added.
 */
export function EventBulkAdd({
  eventId,
  startOrder,
  inLineup,
  add,
  matchLines,
}: {
  eventId: string;
  startOrder: number;
  inLineup: Set<string>;
  add: PourMutations['add'];
  matchLines: PourMutations['matchLines'];
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [review, setReview] = useState<Review[] | null>(null);
  const [adding, setAdding] = useState(false);

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const runMatch = async () => {
    if (!lines.length) return Alert.alert('Nothing to match', 'Paste one whiskey per line first.');
    try {
      const matches = await matchLines.mutateAsync(lines);
      /** Keep the best row per line — the RPC can return more than one candidate. */
      const best = new Map<string, LineMatch>();
      for (const m of matches) {
        const key = m.line ?? '';
        const current = best.get(key);
        if (!current || (m.similarity ?? 0) > (current.similarity ?? 0)) best.set(key, m);
      }
      setReview(
        lines.map((line) => {
          const m = best.get(line) ?? { line, whiskey_id: null, whiskey_name: null, similarity: null };
          const usable = !!m.whiskey_id && !inLineup.has(m.whiskey_id);
          return { ...m, line, selected: usable && (m.similarity ?? 0) >= CONFIDENT };
        }),
      );
    } catch (e) {
      Alert.alert('Could not match those lines', e instanceof Error ? e.message : String(e));
    }
  };

  const chosen = (review ?? []).filter((r) => r.selected && r.whiskey_id);

  const addAll = async () => {
    setAdding(true);
    let order = startOrder;
    try {
      for (const r of chosen) {
        await add.mutateAsync({ event_id: eventId, whiskey_id: r.whiskey_id!, sort_order: order });
        order += 1;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReview(null);
      setText('');
      setOpen(false);
    } catch (e) {
      Alert.alert('Stopped part way', e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  if (!open) {
    return <Button title="Paste a list" variant="ghost" icon="clipboard-outline" onPress={() => setOpen(true)} />;
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="h3">Paste a list</Text>
      <Input
        placeholder={'One whiskey per line\nLagavulin 16\nArdbeg Uigeadail'}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setReview(null);
        }}
        multiline
        style={{ minHeight: 110, textAlignVertical: 'top' }}
      />

      {review ? (
        <View style={{ gap: spacing.sm }}>
          {review.map((r, i) => {
            const already = !!r.whiskey_id && inLineup.has(r.whiskey_id);
            return (
              <View key={`${r.line}-${i}`} style={{ gap: 4 }}>
                <Text variant="small" numberOfLines={1}>
                  {r.line}
                </Text>
                {r.whiskey_id && !already ? (
                  <Row gap={spacing.sm}>
                    <Chip
                      label={r.selected ? '✓ Add match' : 'Add match'}
                      selected={r.selected}
                      onPress={() =>
                        setReview((prev) =>
                          (prev ?? []).map((x, xi) => (xi === i ? { ...x, selected: !x.selected } : x)),
                        )
                      }
                    />
                    <Text variant="caption" muted style={{ flex: 1 }} numberOfLines={1}>
                      {r.whiskey_name} · {Math.round((r.similarity ?? 0) * 100)}%
                    </Text>
                  </Row>
                ) : (
                  <Text variant="caption" color={t.muted}>
                    {already ? 'Already in the lineup' : 'No match — add manually'}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {review ? (
        <Button
          title={`Add ${chosen.length} selected`}
          loading={adding}
          disabled={chosen.length === 0}
          onPress={addAll}
        />
      ) : (
        <Button
          title={`Match ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`}
          variant="secondary"
          loading={matchLines.isPending}
          disabled={lines.length === 0}
          onPress={runMatch}
        />
      )}
      <Button
        title="Cancel"
        variant="ghost"
        onPress={() => {
          setOpen(false);
          setReview(null);
        }}
      />
    </Card>
  );
}
