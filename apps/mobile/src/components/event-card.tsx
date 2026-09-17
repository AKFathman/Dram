import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Row, Text } from '@/components/ui';
import type { Event } from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import { formatEventDate } from '@/lib/event-time';
import { radius, spacing, useTheme } from '@/theme';

type Status = Enums<'event_status'>;
type Role = Enums<'event_role'>;

const STATUS_LABEL: Record<Status, string> = { draft: 'Draft', live: 'Live', ended: 'Ended' };

export function EventStatusChip({ status }: { status: Status }) {
  const t = useTheme();
  const color = status === 'live' ? t.success : status === 'draft' ? t.muted : t.border;
  const fg = status === 'ended' ? t.muted : '#fff';
  return (
    <View style={[styles.chip, { backgroundColor: status === 'ended' ? t.border : color }]}>
      <Text variant="caption" color={fg}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function EventRoleBadge({ role }: { role: Role }) {
  const t = useTheme();
  if (role === 'attendee') return null;
  return (
    <View style={[styles.chip, { backgroundColor: t.accentSoft }]}>
      <Text variant="caption" color={t.accent}>
        {role === 'organizer' ? 'Organizer' : 'Host'}
      </Text>
    </View>
  );
}

/**
 * One event in a list. `right` holds the trailing slot (e.g. a Join button for
 * public events the user has not joined yet).
 */
export function EventCard({
  event,
  role,
  right,
  onPress,
}: {
  event: Event;
  role?: Role | null;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const t = useTheme();
  const where = [event.venue_name, formatEventDate(event.starts_at, event.ends_at)].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={event.name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.75 : 1 },
      ]}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
            {event.name}
          </Text>
          <EventStatusChip status={event.status} />
          {role ? <EventRoleBadge role={role} /> : null}
        </Row>
        <Text variant="small" muted numberOfLines={2}>
          {where || 'Date to be confirmed'}
        </Text>
        <Row gap={4}>
          <Ionicons name="people-outline" size={13} color={t.muted} />
          <Text variant="caption" muted>
            {event.member_count} {event.member_count === 1 ? 'attendee' : 'attendees'}
          </Text>
        </Row>
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={t.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
});
