/**
 * The optional 100-point scoresheet: five 0–20 categories.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton, Row, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

export interface Scoresheet {
  appearance: number;
  nose: number;
  palate: number;
  finish: number;
  balance: number;
}

export const EMPTY_SCORESHEET: Scoresheet = { appearance: 0, nose: 0, palate: 0, finish: 0, balance: 0 };

const ROWS: { key: keyof Scoresheet; label: string }[] = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'nose', label: 'Nose' },
  { key: 'palate', label: 'Palate' },
  { key: 'finish', label: 'Finish' },
  { key: 'balance', label: 'Balance' },
];

export function scoresheetTotal(s: Scoresheet) {
  return ROWS.reduce((sum, r) => sum + (s[r.key] || 0), 0);
}

export function TastingScoresheet({ value, onChange }: { value: Scoresheet; onChange: (next: Scoresheet) => void }) {
  const t = useTheme();
  const set = (key: keyof Scoresheet, n: number) =>
    onChange({ ...value, [key]: Math.max(0, Math.min(20, n)) });

  return (
    <View style={{ gap: spacing.sm }}>
      {ROWS.map((row) => (
        <Row key={row.key} style={{ justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>{row.label}</Text>
          <Row gap={spacing.xs}>
            <IconButton
              name="remove"
              size={18}
              accessibilityLabel={`Lower ${row.label}`}
              disabled={value[row.key] <= 0}
              color={value[row.key] <= 0 ? t.muted : t.text}
              onPress={() => set(row.key, value[row.key] - 1)}
              style={[styles.step, { borderColor: t.border }]}
            />
            <Text variant="h3" style={{ width: 34, textAlign: 'center' }}>
              {value[row.key]}
            </Text>
            <IconButton
              name="add"
              size={18}
              accessibilityLabel={`Raise ${row.label}`}
              disabled={value[row.key] >= 20}
              color={value[row.key] >= 20 ? t.muted : t.text}
              onPress={() => set(row.key, value[row.key] + 1)}
              style={[styles.step, { borderColor: t.border }]}
            />
          </Row>
        </Row>
      ))}
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Text variant="caption" muted>
          TOTAL
        </Text>
        <Text variant="h2" style={{ color: t.accent }}>
          {scoresheetTotal(value)}/100
        </Text>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
});
