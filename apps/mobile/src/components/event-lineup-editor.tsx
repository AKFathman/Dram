import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { EventBulkAdd } from '@/components/event-bulk-add';
import { Button, Card, IconButton, Input, Row, SearchBar, Text } from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import type { EventPour } from '@/lib/api';
import { usePourMutations, useSearch } from '@/hooks';
import { spacing, useTheme } from '@/theme';

type PourMutations = ReturnType<typeof usePourMutations>;

/** One pour, with the two inline fields organizers actually edit at the table. */
function PourEditorRow({
  pour,
  first,
  last,
  update,
  onMove,
  onRemove,
}: {
  pour: EventPour;
  first: boolean;
  last: boolean;
  update: PourMutations['update'];
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const [flight, setFlight] = useState(pour.flight ?? '');
  const [where, setWhere] = useState(pour.table_location ?? '');

  const commit = () => {
    const nextFlight = flight.trim() || null;
    const nextWhere = where.trim() || null;
    if (nextFlight === (pour.flight ?? null) && nextWhere === (pour.table_location ?? null)) return;
    update.mutate({ id: pour.id, flight: nextFlight, table_location: nextWhere });
  };

  return (
    <View style={[styles.pour, { borderColor: t.border }]}>
      <Row gap={spacing.sm}>
        <View style={{ flex: 1 }}>
          <WhiskeyRow whiskey={pour.whiskey} compact subtitle={pour.label ?? undefined} right={null} />
        </View>
        <View>
          <IconButton
            name="chevron-up"
            size={18}
            disabled={first}
            accessibilityLabel="Move up"
            onPress={() => onMove(-1)}
            style={{ opacity: first ? 0.3 : 1 }}
          />
          <IconButton
            name="chevron-down"
            size={18}
            disabled={last}
            accessibilityLabel="Move down"
            onPress={() => onMove(1)}
            style={{ opacity: last ? 0.3 : 1 }}
          />
        </View>
        <IconButton
          name="trash-outline"
          size={18}
          color={t.danger}
          accessibilityLabel="Remove pour"
          onPress={onRemove}
        />
      </Row>
      <Row gap={spacing.sm}>
        <Input
          placeholder="Flight"
          value={flight}
          onChangeText={setFlight}
          onBlur={commit}
          style={{ flex: 1, paddingVertical: 8 }}
        />
        <Input
          placeholder="Table / station"
          value={where}
          onChangeText={setWhere}
          onBlur={commit}
          style={{ flex: 1, paddingVertical: 8 }}
        />
      </Row>
    </View>
  );
}

export function EventLineupEditor({ eventId, pours }: { eventId: string; pours: EventPour[] }) {
  const router = useRouter();
  const { add, update, remove, matchLines } = usePourMutations(eventId);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const search = useSearch(q);

  const sorted = [...pours].sort((a, b) => a.sort_order - b.sort_order);
  const inLineup = new Set(sorted.map((p) => p.whiskey_id));

  const move = (index: number, dir: -1 | 1) => {
    const a = sorted[index];
    const b = sorted[index + dir];
    if (!a || !b) return;
    if (a.sort_order === b.sort_order) {
      update.mutate({ id: a.id, sort_order: dir === -1 ? b.sort_order - 1 : b.sort_order + 1 });
      return;
    }
    update.mutate({ id: a.id, sort_order: b.sort_order });
    update.mutate({ id: b.id, sort_order: a.sort_order });
  };

  const confirmRemove = (pour: EventPour) =>
    Alert.alert('Remove this pour?', pour.whiskey.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(pour.id, {
            onError: (e) => Alert.alert('Could not remove', e instanceof Error ? e.message : String(e)),
          }),
      },
    ]);

  const addWhiskey = (whiskeyId: string) =>
    add.mutate(
      { event_id: eventId, whiskey_id: whiskeyId, sort_order: sorted.length + 1 },
      { onError: (e) => Alert.alert('Could not add', e instanceof Error ? e.message : String(e)) },
    );

  const results = (search.data ?? []).filter((w) => !inLineup.has(w.id));

  return (
    <View style={{ gap: spacing.md }}>
      {sorted.length === 0 ? (
        <Text variant="small" muted>
          Nothing poured yet. Add the bottles you are opening.
        </Text>
      ) : (
        sorted.map((pour, i) => (
          <PourEditorRow
            key={pour.id}
            pour={pour}
            first={i === 0}
            last={i === sorted.length - 1}
            update={update}
            onMove={(dir) => move(i, dir)}
            onRemove={() => confirmRemove(pour)}
          />
        ))
      )}

      {adding ? (
        <Card style={{ gap: spacing.sm }}>
          <SearchBar placeholder="Search whiskeys" value={q} onChangeText={setQ} autoFocus />
          {search.isFetching && q.trim().length >= 2 ? (
            <Text variant="small" muted>
              Searching…
            </Text>
          ) : null}
          {results.slice(0, 8).map((w) => (
            <WhiskeyRow
              key={w.id}
              whiskey={w}
              compact
              onPress={() => addWhiskey(w.id)}
              right={
                <Button
                  title="Add"
                  variant="secondary"
                  onPress={() => addWhiskey(w.id)}
                  style={{ paddingVertical: 6, paddingHorizontal: spacing.md }}
                />
              }
            />
          ))}
          {q.trim().length >= 2 && !search.isFetching && results.length === 0 ? (
            <Text variant="small" muted>
              Nothing matched “{q.trim()}”.
            </Text>
          ) : null}
          <Button
            title="Can't find it? Add a whiskey"
            variant="ghost"
            onPress={() => router.push({ pathname: '/add-whiskey', params: { name: q.trim(), eventId } })}
          />
          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            New bottles stay unverified until a moderator approves them — they still work in the lineup.
          </Text>
          <Button title="Done" variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="Add pour" variant="secondary" icon="add" onPress={() => setAdding(true)} />
      )}

      <EventBulkAdd
        eventId={eventId}
        startOrder={sorted.length + 1}
        inLineup={inLineup}
        add={add}
        matchLines={matchLines}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pour: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
