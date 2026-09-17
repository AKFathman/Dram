/**
 * React Query hooks over src/lib/api. Screens import from here, never from
 * supabase directly, so caching and invalidation live in one place.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { keys } from '@/lib/query';
import { deriveList, type Tier } from '@/lib/ranking';

export type { Whiskey, RankingWithWhiskey, FeedItem, EventWithPours, LeaderboardRow } from '@/lib/api';

// ---------------------------------------------------------------- catalog ---
export function useSearch(q: string, filters: api.SearchFilters = {}) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: keys.search(trimmed, filters),
    queryFn: () => api.searchWhiskeys(trimmed, filters),
    enabled: trimmed.length >= 2 || !!filters.categories?.length || !!filters.country || !!filters.region,
    placeholderData: (prev) => prev,
  });
}

export function useWhiskey(id: string | undefined) {
  return useQuery({ queryKey: keys.whiskey(id ?? ''), queryFn: () => api.getWhiskey(id!), enabled: !!id });
}

export function useWhiskeyExtras(id: string | undefined) {
  return useQuery({
    queryKey: keys.whiskeyExtras(id ?? ''),
    queryFn: () => api.getWhiskeyExtras(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useFlavorTags() {
  return useQuery({ queryKey: keys.flavorTags, queryFn: api.getFlavorTags, staleTime: Infinity });
}

export function useCreateWhiskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createWhiskey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['search'] }),
  });
}

// --------------------------------------------------------------- rankings ---
export function useRankings(userId: string | undefined) {
  const { user } = useAuth();
  const isMe = !!userId && userId === user?.id;
  const query = useQuery({
    queryKey: isMe ? keys.myRankings : keys.userRankings(userId ?? ''),
    queryFn: () => api.listRankings(userId!),
    enabled: !!userId,
  });
  /** Ordered best → worst with derived score + overall rank (matches v_rankings). */
  const list = useMemo(() => (query.data ? deriveList(query.data) : []), [query.data]);
  const byWhiskey = useMemo(() => new Map(list.map((r) => [r.whiskey_id, r])), [list]);
  return { ...query, list, byWhiskey };
}

export function useMyRankings() {
  const { user } = useAuth();
  return useRankings(user?.id);
}

export function useMyRankingFor(whiskeyId: string | undefined) {
  const { byWhiskey, ...rest } = useMyRankings();
  return { ...rest, ranking: whiskeyId ? (byWhiskey.get(whiskeyId) ?? null) : null };
}

function invalidateRankingStuff(qc: ReturnType<typeof useQueryClient>, whiskeyId: string, eventId?: string | null) {
  qc.invalidateQueries({ queryKey: keys.myRankings });
  qc.invalidateQueries({ queryKey: keys.whiskey(whiskeyId) });
  qc.invalidateQueries({ queryKey: keys.feed() });
  qc.invalidateQueries({ queryKey: keys.me });
  if (eventId) qc.invalidateQueries({ queryKey: keys.event(eventId) });
}

export function useUpsertRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.upsertRanking,
    onSuccess: (_row, vars) => invalidateRankingStuff(qc, vars.whiskeyId, vars.eventId),
  });
}

export function useRemoveRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.removeRanking,
    onSuccess: (_r, whiskeyId) => invalidateRankingStuff(qc, whiskeyId),
  });
}

/** Candidates for the comparison flow: my whiskeys in `tier`, best → worst, excluding `whiskeyId`. */
export function useTierCandidates(tier: Tier | null, whiskeyId: string, preferIds?: string[] | null) {
  const { list } = useMyRankings();
  return useMemo(() => {
    if (!tier) return [];
    const inTier = list.filter((r) => r.tier === tier && r.whiskey_id !== whiskeyId);
    if (!preferIds?.length) return inTier;
    // At an event, compare against pours from the same lineup first.
    const prefer = new Set(preferIds);
    const a = inTier.filter((r) => prefer.has(r.whiskey_id));
    return a.length >= 2 ? a : inTier;
  }, [list, tier, whiskeyId, preferIds]);
}

// --------------------------------------------------------------- tastings ---
export function useTastings(userId: string | undefined, whiskeyId?: string) {
  return useQuery({
    queryKey: keys.tastings(userId ?? '', whiskeyId),
    queryFn: () => api.listTastings(userId!, whiskeyId),
    enabled: !!userId,
  });
}

export function useTasting(id: string | undefined) {
  return useQuery({ queryKey: keys.tasting(id ?? ''), queryFn: () => api.getTasting(id!), enabled: !!id });
}

export function useCreateTasting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTasting,
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tastings'] });
      qc.invalidateQueries({ queryKey: keys.feed() });
      qc.invalidateQueries({ queryKey: keys.whiskeyExtras(t.whiskey_id) });
      if (t.event_id) qc.invalidateQueries({ queryKey: keys.event(t.event_id) });
    },
  });
}

export function useUpdateTasting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Parameters<typeof api.updateTasting>[1]) =>
      api.updateTasting(id, patch),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tastings'] });
      qc.invalidateQueries({ queryKey: keys.tasting(t.id) });
      qc.invalidateQueries({ queryKey: keys.feed() });
      qc.invalidateQueries({ queryKey: keys.whiskeyExtras(t.whiskey_id) });
    },
  });
}

export function useDeleteTasting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTasting,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tastings'] });
      qc.invalidateQueries({ queryKey: keys.feed() });
    },
  });
}

// --------------------------------------------------------------- profiles ---
export function useProfile(id: string | undefined) {
  return useQuery({ queryKey: keys.profile(id ?? ''), queryFn: () => api.getProfile(id!), enabled: !!id });
}

export function useProfileSearch(q: string) {
  return useQuery({
    queryKey: ['profile-search', q],
    queryFn: () => api.searchProfiles(q),
    enabled: q.trim().length >= 2,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: async (p) => {
      qc.invalidateQueries({ queryKey: keys.profile(p.id) });
      await refreshProfile();
    },
  });
}

export function useFollowState(targetId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: keys.follows(targetId ?? ''),
    queryFn: () => api.getFollow(targetId!),
    enabled: !!targetId,
  });
  const toggle = useMutation({
    mutationFn: async () => {
      if (!targetId) return;
      if (query.data) await api.unfollow(targetId);
      else await api.follow(targetId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.follows(targetId ?? '') });
      qc.invalidateQueries({ queryKey: keys.profile(targetId ?? '') });
      qc.invalidateQueries({ queryKey: keys.userRankings(targetId ?? '') });
      qc.invalidateQueries({ queryKey: keys.feed() });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
  return {
    ...query,
    isFollowing: query.data?.status === 'accepted',
    isPending: query.data?.status === 'pending',
    toggle,
  };
}

export function useTasteMatch(otherId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.tasteMatch(otherId ?? ''),
    queryFn: () => api.tasteMatch(otherId!),
    enabled: !!otherId && otherId !== user?.id,
  });
}

export function useFollowing(userId: string | undefined) {
  return useQuery({ queryKey: ['following', userId], queryFn: () => api.listFollowing(userId!), enabled: !!userId });
}

export function useFollowers(userId: string | undefined) {
  return useQuery({ queryKey: ['followers', userId], queryFn: () => api.listFollowers(userId!), enabled: !!userId });
}

// ------------------------------------------------------------------- feed ---
export function useFeed(actor?: string | null) {
  return useInfiniteQuery({
    queryKey: keys.feed(actor ?? undefined),
    queryFn: ({ pageParam }) => api.getFeed({ beforeId: pageParam, actor }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.length ? last[last.length - 1]!.id : undefined),
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tastingId, liked }: { tastingId: string; liked: boolean }) =>
      liked ? api.unlikeTasting(tastingId) : api.likeTasting(tastingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });
}

// --------------------------------------------------------------- discover ---
export function useTrending() {
  return useQuery({ queryKey: keys.discover('trending'), queryFn: () => api.trending(), staleTime: 5 * 60_000 });
}
export function useTop(f: Parameters<typeof api.topWhiskeys>[0]) {
  return useQuery({ queryKey: keys.discover('top', f), queryFn: () => api.topWhiskeys(f), staleTime: 5 * 60_000 });
}
export function useFriendsLoved() {
  return useQuery({ queryKey: keys.discover('friends-loved'), queryFn: () => api.friendsLoved(), staleTime: 60_000 });
}

// ----------------------------------------------------------------- events ---
export function useMyEvents() {
  return useQuery({ queryKey: keys.events, queryFn: api.listMyEvents });
}
export function usePublicEvents() {
  return useQuery({ queryKey: ['events', 'public'], queryFn: api.listPublicEvents });
}
export function useEvent(id: string | undefined) {
  return useQuery({ queryKey: keys.event(id ?? ''), queryFn: () => api.getEvent(id!), enabled: !!id });
}
export function useEventMembers(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.event(id ?? ''), 'members'],
    queryFn: () => api.listEventMembers(id!),
    enabled: !!id,
  });
}
export function useLeaderboard(id: string | undefined) {
  return useQuery({
    queryKey: keys.leaderboard(id ?? ''),
    queryFn: () => api.getLeaderboard(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}
export function useMyEventTastings(id: string | undefined) {
  return useQuery({
    queryKey: keys.myEventTastings(id ?? ''),
    queryFn: () => api.listMyEventTastings(id!),
    enabled: !!id,
  });
}
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.createEvent, onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }) });
}
export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Parameters<typeof api.updateEvent>[1]) =>
      api.updateEvent(id, patch),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: keys.event(e.id) });
      qc.invalidateQueries({ queryKey: keys.events });
    },
  });
}
export function useJoinEvent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.joinEvent, onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }) });
}
export function useJoinPublicEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.joinPublicEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
export function useLeaveEvent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.leaveEvent, onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }) });
}
export function usePourMutations(eventId: string) {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: keys.event(eventId) });
    qc.invalidateQueries({ queryKey: keys.leaderboard(eventId) });
  };
  return {
    add: useMutation({ mutationFn: api.addPour, onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: { id: string } & Parameters<typeof api.updatePour>[1]) =>
        api.updatePour(id, patch),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: api.removePour, onSuccess: done }),
    matchLines: useMutation({ mutationFn: api.matchLines }),
  };
}

// -------------------------------------------------------- wishlist & bar ----
export function useWishlist(userId: string | undefined) {
  return useQuery({
    queryKey: [...keys.wishlist, userId],
    queryFn: () => api.listWishlist(userId!),
    enabled: !!userId,
  });
}
export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ whiskeyId, on }: { whiskeyId: string; on: boolean }) => api.setWishlisted(whiskeyId, on),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: keys.wishlist });
      qc.invalidateQueries({ queryKey: keys.whiskey(v.whiskeyId) });
    },
  });
}
export function useCollection(userId: string | undefined) {
  return useQuery({
    queryKey: [...keys.collection, userId],
    queryFn: () => api.listCollection(userId!),
    enabled: !!userId,
  });
}
export function useCollectionMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: keys.collection });
  return {
    add: useMutation({ mutationFn: api.addBottle, onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: { id: string } & Parameters<typeof api.updateBottle>[1]) =>
        api.updateBottle(id, patch),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: api.removeBottle, onSuccess: done }),
  };
}

// ---------------------------------------------------------- notifications ---
export function useNotifications() {
  return useQuery({ queryKey: keys.notifications, queryFn: api.listNotifications, refetchInterval: 60_000 });
}
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

// ---------------------------------------------------------- identify-label --
export function useIdentifyLabel() {
  return useMutation({
    mutationFn: ({ base64, mediaType }: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }) =>
      api.identifyLabel(base64, mediaType),
  });
}
