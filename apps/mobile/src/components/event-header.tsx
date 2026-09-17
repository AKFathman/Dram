import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { EventRoleBadge, EventStatusChip } from '@/components/event-card';
import { Card, IconButton, Row, Text } from '@/components/ui';
import type { Event } from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import { formatEventDate } from '@/lib/event-time';
import { radius, spacing, useTheme } from '@/theme';

/** Name, when, where, how many people. */
export function EventHeader({ event, role }: { event: Event; role?: Enums<'event_role'> | null }) {
  const t = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="title">{event.name}</Text>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <EventStatusChip status={event.status} />
        {role ? <EventRoleBadge role={role} /> : null}
      </Row>
      <Text muted>{formatEventDate(event.starts_at, event.ends_at)}</Text>
      {event.venue_name || event.address ? (
        <Row gap={6}>
          <Ionicons name="location-outline" size={14} color={t.muted} />
          <Text variant="small" muted style={{ flex: 1 }}>
            {[event.venue_name, event.address].filter(Boolean).join(' · ')}
          </Text>
        </Row>
      ) : null}
      <Row gap={6}>
        <Ionicons name="people-outline" size={14} color={t.muted} />
        <Text variant="small" muted>
          {event.member_count} {event.member_count === 1 ? 'attendee' : 'attendees'}
        </Text>
      </Row>
      {event.description ? (
        <Text variant="small" style={{ marginTop: spacing.xs }}>
          {event.description}
        </Text>
      ) : null}
    </View>
  );
}

/** The join code, with copy and share affordances. */
export function EventJoinCode({ event }: { event: Event }) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(event.join_code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = () =>
    Share.share({ message: `Join ${event.name} on Dram — code ${event.join_code}` }).catch(() => {});

  return (
    <Card style={{ paddingVertical: spacing.md }}>
      <Row gap={spacing.md}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" muted>
            {copied ? 'COPIED' : 'JOIN CODE'}
          </Text>
          <Text style={[styles.code, { color: t.text }]} accessibilityLabel={`Join code ${event.join_code}`}>
            {event.join_code}
          </Text>
        </View>
        <IconButton name={copied ? 'checkmark' : 'copy-outline'} accessibilityLabel="Copy join code" onPress={copy} />
        <IconButton name="share-outline" accessibilityLabel="Share this event" onPress={share} />
      </Row>
    </Card>
  );
}

/** "{tried} of {total} tried" with a bar. */
export function EventProgress({ tried, total }: { tried: number; total: number }) {
  const t = useTheme();
  const pct = total > 0 ? Math.min(1, tried / total) : 0;
  return (
    <Card style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
      <Row>
        <Text variant="h3" style={{ flex: 1 }}>
          {tried} of {total} tried
        </Text>
        <Text variant="caption" muted>
          {Math.round(pct * 100)}%
        </Text>
      </Row>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: tried }}
        style={[styles.track, { backgroundColor: t.border }]}>
        <View style={[styles.fill, { backgroundColor: t.accent, width: `${pct * 100}%` }]} />
      </View>
      {total === 0 ? (
        <Text variant="small" muted>
          No pours in the lineup yet.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 30, fontWeight: '700', letterSpacing: 6 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
