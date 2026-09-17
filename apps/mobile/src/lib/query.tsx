import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** React Query treats "app came to foreground" as window focus. */
function useAppStateFocus() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  useAppStateFocus();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Query key factory so invalidation stays consistent across the app. */
export const keys = {
  me: ['me'] as const,
  profile: (id: string) => ['profile', id] as const,
  myRankings: ['rankings', 'me'] as const,
  userRankings: (id: string) => ['rankings', id] as const,
  whiskey: (id: string) => ['whiskey', id] as const,
  whiskeyExtras: (id: string) => ['whiskey', id, 'extras'] as const,
  search: (q: string, f: unknown) => ['search', q, f] as const,
  feed: (actor?: string) => ['feed', actor ?? 'home'] as const,
  discover: (kind: string, f?: unknown) => ['discover', kind, f] as const,
  events: ['events', 'mine'] as const,
  event: (id: string) => ['event', id] as const,
  leaderboard: (id: string) => ['event', id, 'leaderboard'] as const,
  myEventTastings: (id: string) => ['event', id, 'my-tastings'] as const,
  tastings: (userId: string, whiskeyId?: string) => ['tastings', userId, whiskeyId ?? 'all'] as const,
  tasting: (id: string) => ['tasting', id] as const,
  wishlist: ['wishlist'] as const,
  collection: ['collection'] as const,
  follows: (id: string) => ['follows', id] as const,
  tasteMatch: (id: string) => ['taste-match', id] as const,
  notifications: ['notifications'] as const,
  flavorTags: ['flavor-tags'] as const,
};
