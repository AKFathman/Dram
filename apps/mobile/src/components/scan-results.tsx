/**
 * What came back from the identify-label edge function: what it read off the
 * label, and the catalog matches it found.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Divider, Row, Text } from '@/components/ui';
import { WhiskeyRow } from '@/components/whiskey-row';
import { categoryLabel, type IdentifyResult } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

const CONFIDENCE: Record<IdentifyResult['extracted']['confidence'], string> = {
  high: 'Confident read',
  medium: 'Partial read',
  low: 'Hard to read',
};

export function ScanResults({
  result,
  onPick,
  onAdd,
  onRetry,
}: {
  result: IdentifyResult;
  onPick: (whiskeyId: string) => void;
  onAdd: () => void;
  onRetry: () => void;
}) {
  const t = useTheme();
  const e = result.extracted;
  const title = [e.brand, e.expression].filter(Boolean).join(' ') || 'Could not read the label';
  const facts = [
    e.distillery,
    e.category ? categoryLabel(e.category) : null,
    e.age_years != null ? `${e.age_years} yr` : null,
    e.abv != null ? `${e.abv}%` : null,
    e.country,
  ].filter(Boolean);

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }} gap={spacing.md}>
          <Text variant="caption" muted>
            FROM THE LABEL
          </Text>
          <View style={[styles.pill, { backgroundColor: e.confidence === 'low' ? t.border : t.accentSoft }]}>
            <Text variant="caption" style={{ color: e.confidence === 'low' ? t.muted : t.accent }}>
              {CONFIDENCE[e.confidence]}
            </Text>
          </View>
        </Row>
        <Text variant="h2" style={{ marginTop: spacing.sm }}>
          {title}
        </Text>
        {facts.length ? (
          <Text variant="small" muted style={{ marginTop: 2 }}>
            {facts.join(' · ')}
          </Text>
        ) : null}
      </Card>

      <View>
        <Text variant="caption" muted>
          {result.matches.length ? 'MATCHES IN THE CATALOG' : 'NO MATCHES'}
        </Text>
        {result.matches.length ? (
          result.matches.map((w) => <WhiskeyRow key={w.id} whiskey={w} onPress={() => onPick(w.id)} />)
        ) : (
          <>
            <Divider />
            <Text variant="small" muted>
              Nothing in the catalog looks like this yet — add it and it&apos;s ready to rate.
            </Text>
          </>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title="None of these — add it" icon="add-circle-outline" onPress={onAdd} />
        <Button title="Try again" variant="ghost" icon="refresh" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
});
