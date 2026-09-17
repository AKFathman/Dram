/**
 * Small form primitives shared by the logging flow (rate / tasting / add).
 * Nothing here knows about data — they just lay out labelled controls.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, Chip, Row, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** A titled card. The title renders as the app's small uppercase caption. */
export function Section({
  title,
  hint,
  children,
  style,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={style}>
      <Text variant="caption" muted>
        {title.toUpperCase()}
      </Text>
      {hint ? (
        <Text variant="small" muted style={{ marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>{children}</View>
    </Card>
  );
}

/** A card whose body opens and closes — used for the optional detail blocks. */
export function Collapsible({
  title,
  icon,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  icon?: IconName;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={spacing.sm} style={{ flexShrink: 1 }}>
            {icon ? <Ionicons name={icon} size={18} color={t.accent} /> : null}
            <View style={{ flexShrink: 1 }}>
              <Text variant="h3">{title}</Text>
              {hint && !open ? (
                <Text variant="small" muted numberOfLines={1}>
                  {hint}
                </Text>
              ) : null}
            </View>
          </Row>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
        </Row>
      </Pressable>
      {open ? <View style={{ gap: spacing.md, marginTop: spacing.lg }}>{children}</View> : null}
    </Card>
  );
}

/** Caption label above any control. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" muted>
        {label.toUpperCase()}
      </Text>
      {children}
      {hint ? (
        <Text variant="small" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** A wrapping row of single-select chips. Tapping the selected chip clears it. */
export function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  clearable = true,
}: {
  label?: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (next: T | null) => void;
  clearable?: boolean;
}) {
  const body = (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => onChange(value === o.value && clearable ? null : o.value)}
        />
      ))}
    </View>
  );
  return label ? <Field label={label}>{body}</Field> : body;
}

/** A label + switch line. */
export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }} gap={spacing.md}>
      <View style={{ flexShrink: 1 }}>
        <Text variant="h3">{label}</Text>
        {hint ? (
          <Text variant="small" muted>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ true: t.accent, false: t.border }}
        thumbColor="#fff"
      />
    </Row>
  );
}

/** Sticky bottom bar for a screen's primary action. */
export function StickyFooter({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.border,
        backgroundColor: t.bg,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        gap: spacing.sm,
      }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
