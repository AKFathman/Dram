import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/lib/auth';
import { QueryProvider } from '@/lib/query';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { loading, session, onboarded } = useAuth();
  const t = useTheme();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;
  const signedIn = !!session;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  const t = useTheme();
  const navTheme = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider
        value={{
          ...navTheme,
          colors: {
            ...navTheme.colors,
            background: t.bg,
            card: t.card,
            text: t.text,
            border: t.border,
            primary: t.accent,
          },
        }}>
        <QueryProvider>
          <AuthProvider>
            <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
            <RootNavigator />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
