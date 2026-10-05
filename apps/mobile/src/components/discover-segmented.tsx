import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PRESS_SPRING } from '@/components/motion';
import { Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

const PAD = 3;

/** Segmented control with a thumb that slides to the selected option. */
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
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const segment = width > 0 ? (width - PAD * 2) / options.length : 0;

  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!segment) return;
    // Put the thumb in place on first layout; slide it on every change after.
    if (!placed.current) {
      x.set(index * segment);
      placed.current = true;
    } else {
      x.set(withSpring(index * segment, PRESS_SPRING));
    }
  }, [index, segment, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={[styles.wrap, { backgroundColor: t.surface }]}>
      {segment > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segment,
              backgroundColor: t.scheme === 'dark' ? t.border : t.card,
              shadowColor: '#000',
              shadowOpacity: t.scheme === 'dark' ? 0 : 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 1 },
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={styles.segment}>
            <Text variant="small" color={on ? t.text : t.muted} style={{ fontWeight: on ? '700' : '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: PAD, borderRadius: radius.pill },
  thumb: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.pill },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
});
