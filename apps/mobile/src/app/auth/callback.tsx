/**
 * Deep-link target for magic links and OAuth (dram://auth/callback?code=...).
 * Exchanges the PKCE code for a session, then lets the root layout route.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Loading, Screen, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  // No code in the URL → nothing to exchange; render the redirect immediately.
  const [done, setDone] = useState(!code);
  const [error, setError] = useState<string | null>(error_description ?? null);

  useEffect(() => {
    if (!code) return;
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: e }) => {
        if (e) setError(e.message);
      })
      .finally(() => setDone(true));
  }, [code]);

  if (!done) return <Loading style={{ flex: 1 }} />;
  if (error) {
    return (
      <Screen>
        <Text variant="h2">Sign-in link problem</Text>
        <Text muted>{error}</Text>
      </Screen>
    );
  }
  return <Redirect href="/" />;
}
