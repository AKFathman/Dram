/**
 * Multi-select flavour chips, grouped the way the catalog groups them.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, Loading, Text } from '@/components/ui';
import { useFlavorTags } from '@/hooks';
import type { FlavorTag } from '@/lib/api';
import { spacing } from '@/theme';

export function TastingFlavorPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const { data, isLoading } = useFlavorTags();

  if (isLoading) return <Loading style={{ padding: spacing.lg }} />;
  const tags = data ?? [];
  if (!tags.length) {
    return (
      <Text variant="small" muted>
        No flavour tags yet.
      </Text>
    );
  }

  // getFlavorTags() already orders by `sort`, so first-seen order is the right order.
  const groups = new Map<string, FlavorTag[]>();
  for (const tag of tags) {
    const list = groups.get(tag.group_label);
    if (list) list.push(tag);
    else groups.set(tag.group_label, [tag]);
  }

  const toggle = (slug: string) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

  return (
    <View style={{ gap: spacing.lg }}>
      {[...groups.entries()].map(([label, groupTags]) => (
        <View key={label} style={{ gap: spacing.sm }}>
          <Text variant="caption" muted>
            {label.toUpperCase()}
          </Text>
          <View style={styles.wrap}>
            {groupTags.map((tag) => (
              <Chip
                key={tag.slug}
                label={tag.label}
                selected={value.includes(tag.slug)}
                onPress={() => toggle(tag.slug)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
