import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { categoryLabel, type Whiskey } from '@/lib/api';
import { spacing } from '@/theme';

/** Two-column grid of catalog facts; anything missing is simply left out. */
export function WhiskeyFacts({ whiskey: w }: { whiskey: Whiskey }) {
  const facts: { label: string; value: string }[] = [];
  const push = (label: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && `${value}`.trim() !== '') facts.push({ label, value: `${value}` });
  };

  push('Category', categoryLabel(w.category));
  push('Origin', w.region ? `${w.region}, ${w.country}` : w.country);
  facts.push({ label: 'Age', value: w.age_years != null ? `${w.age_years} yr` : 'NAS' });
  if (w.abv != null) facts.push({ label: 'Strength', value: `${w.abv}% · ${Math.round(w.abv * 2 * 10) / 10} proof` });
  push('Cask', w.cask_type);
  push('Finish', w.finish);
  push('Mash bill', w.mash_bill);
  push('Released', w.release_year);
  push('Bottler', w.bottler);

  return (
    <Card style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, columnGap: spacing.md }}>
      {facts.map((f) => (
        <View key={f.label} style={{ width: '46%', gap: 2 }}>
          <Text variant="caption" muted>
            {f.label.toUpperCase()}
          </Text>
          <Text variant="small" style={{ fontWeight: '600' }}>
            {f.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}
