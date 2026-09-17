import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Platform, View, type ColorValue } from 'react-native';

import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type IconProps = { color: ColorValue; focused: boolean; size: number };

function TabIcon({ name, focusedName, color, focused, size }: IconProps & { name: IconName; focusedName: IconName }) {
  return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
}

export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
          tabBarIcon: ({ size }) => (
            <View
              style={{
                width: size + 22,
                height: size + 22,
                borderRadius: (size + 22) / 2,
                backgroundColor: t.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: Platform.OS === 'ios' ? -6 : 0,
              }}>
              <Ionicons name="add" size={size + 6} color="#fff" />
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
