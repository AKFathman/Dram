import type { Session, User } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { APPLE_UNAVAILABLE, AppleAuth } from './apple-auth';
import { queryClient } from './query';
import { supabase } from './supabase';
import type { Tables } from './database.types';

WebBrowser.maybeCompleteAuthSession();

export type Profile = Tables<'profiles'>;

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True until the persisted session has been read from storage. */
  loading: boolean;
  /** Profile exists and onboarding (username + age gate) is complete. */
  onboarded: boolean;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, token: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Where Supabase should send a sign-in link or OAuth redirect back to.
 *
 * expo-linking's web build resolves the path against `window.location.origin`
 * alone, which drops the sub-path a static host like GitHub Pages serves the
 * app from — the link would come back to /auth/callback instead of
 * /Dram/auth/callback and land on the host's 404. The bundle is compiled with
 * its own base path, so use that on web and leave native to expo-linking.
 */
function authCallbackUrl(): string {
  if (Platform.OS !== 'web') return Linking.createURL('/auth/callback');
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  return `${window.location.origin}${base}/auth/callback`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      await loadProfile(next?.user.id);
      if (!next) queryClient.clear();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      onboarded: !!profile?.onboarded_at,
      refreshProfile: () => loadProfile(session?.user.id),

      async signInWithEmail(email) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true, emailRedirectTo: authCallbackUrl() },
        });
        if (error) throw error;
      },

      async verifyEmailCode(email, token) {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw error;
      },

      async signInWithApple() {
        if (Platform.OS !== 'ios' || !AppleAuth) throw new Error(APPLE_UNAVAILABLE);
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
        const credential = await AppleAuth.signInAsync({
          requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
        if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });
        if (error) throw error;
      },

      async signInWithGoogle() {
        const redirectTo = authCallbackUrl();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') return;
        const { queryParams } = Linking.parse(result.url);
        const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
        if (!code) throw new Error('Google sign-in did not return a code.');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      },

      async signOut() {
        await supabase.auth.signOut();
        queryClient.clear();
      },
    }),
    [session, profile, loading, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Throws if there is no signed-in user; use inside protected routes. */
export function useUserId(): string {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user.id;
}
