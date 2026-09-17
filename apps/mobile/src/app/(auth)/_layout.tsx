import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="email" options={{ presentation: 'modal', headerShown: true, title: 'Continue with email' }} />
    </Stack>
  );
}
