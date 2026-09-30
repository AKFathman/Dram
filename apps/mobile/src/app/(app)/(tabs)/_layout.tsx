import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, View, type ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { PRESS_SPRING } from '@/components/motion';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean; size: number };

/** Gives a small hop when its tab becomes the selected one. */
function TabIcon({ name, focusedName, color, focused, size }: IconProps & { name: IconName; focusedName: IconName }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.set(withSequence(withSpring(1.18, PRESS_SPRING), withSpring(1, PRESS_SPRING)));
  }, [focused, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={animated}>
      <Ionicons name={focused ? focusedName : name} size={size} color={color} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The accent is kept for the Log button; the selected tab is just darker.
        tabBarActiveTintColor: t.text,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle:
          t.scheme === 'dark'
            ? { backgroundColor: t.card, borderTopColor: t.border }
            : {
                backgroundColor: t.card,
                borderTopWidth: 0,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: -2 },
                elevation: 8,
              },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: (p: IconProps) => <TabIcon {...p} name="home-outline" focusedName="home" />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Discover',
          tabBarIcon: (p: IconProps) => <TabIcon {...p} name="compass-outline" focusedName="compass" />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          // The + says it; a label here sat underneath the button and collided with it.
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Log a whiskey',
          tabBarIcon: ({ size }) => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: t.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: Platform.OS === 'web' ? 0 : 6,
              }}>
              <Ionicons name="add" size={size + 4} color={t.accentText} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/log');
          },
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: (p: IconProps) => <TabIcon {...p} name="people-outline" focusedName="people" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: (p: IconProps) => <TabIcon {...p} name="person-outline" focusedName="person" />,
        }}
      />
    </Tabs>
  );
}
