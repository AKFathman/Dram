import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

/** Pill segmented control used by Discover and profiles. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: t.card, borderColor: t.border }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              styles.segment,
              { backgroundColor: on ? t.accent : 'transparent', opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text variant="small" color={on ? '#fff' : t.muted} style={{ fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
});
