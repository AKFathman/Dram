import { Pressable } from 'react-native';

import { Row, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/** Section title with an optional trailing text action ("See all"). */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.lg }}>
      <Text variant="h2">{title}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text variant="small" color={t.accent} style={{ fontWeight: '600' }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Row>
  );
}
