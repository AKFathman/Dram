import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/theme';

export default function AppLayout() {
  const t = useTheme();
  const modal = { presentation: 'modal' as const, headerShown: true };
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: t.accent,
        headerTitleStyle: { color: t.text },
        headerStyle: { backgroundColor: t.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="whiskey/[id]" options={{ title: '' }} />
      <Stack.Screen name="user/[id]" options={{ title: '' }} />
      <Stack.Screen name="event/[id]/index" options={{ title: 'Event' }} />
      <Stack.Screen name="event/[id]/manage" options={{ title: 'Manage lineup' }} />
      <Stack.Screen name="my-list" options={{ title: 'My ranking' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="log" options={{ ...modal, title: 'Log a whiskey' }} />
      <Stack.Screen name="rate/[whiskeyId]" options={{ ...modal, title: 'Rate', gestureEnabled: false }} />
      <Stack.Screen name="add-whiskey" options={{ ...modal, title: 'Add a whiskey' }} />
      <Stack.Screen name="scan" options={{ ...modal, title: 'Scan a label' }} />
      <Stack.Screen name="tasting/[id]" options={{ ...modal, title: 'Tasting notes' }} />
      <Stack.Screen name="event/new" options={{ ...modal, title: 'New event' }} />
      <Stack.Screen name="event/join" options={{ ...modal, title: 'Join an event' }} />
    </Stack>
  );
}
