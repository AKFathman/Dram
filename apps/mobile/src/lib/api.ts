/**
 * Data access. Every call goes through the user's JWT + RLS; nothing here
 * needs a service key. Hooks in src/hooks wrap these with React Query.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import type { Enums, Functions, Tables, TablesInsert, TablesUpdate, Views } from './database.types';
import type { Tier } from './ranking';
import { supabase } from './supabase';

// ------------------------------------------------------------------ types ---
export type Whiskey = Tables<'whiskeys'>;
export type Distillery = Tables<'distilleries'>;
export type WhiskeyWithDistillery = Whiskey & { distillery: Distillery | null };
export type WhiskeyCategory = Enums<'whiskey_category'>;
export type Profile = Tables<'profiles'>;
export type RankingRow = Tables<'rankings'>;
export type RankingView = Views<'v_rankings'>;
export type RankingWithWhiskey = RankingRow & { whiskey: Whiskey };
export type Tasting = Tables<'tastings'>;
export type TastingWithWhiskey = Tasting & {
  whiskey: Whiskey;
  flavors: { tag_slug: string; intensity: number | null }[];
};
export type FlavorTag = Tables<'flavor_tags'>;
export type Event = Tables<'events'>;
export type EventPour = Tables<'event_pours'> & { whiskey: Whiskey };
export type EventWithPours = Event & { pours: EventPour[]; my_membership: { role: Enums<'event_role'> }[] };
export type EventMember = Tables<'event_members'> & {
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
};
export type FeedItem = Functions<'feed'>['Returns'][number];
export type LeaderboardRow = Functions<'event_leaderboard'>['Returns'][number];
export type TasteMatch = Functions<'taste_match'>['Returns'][number];
export type FriendsLovedRow = Functions<'friends_loved'>['Returns'][number];
export type LineMatch = Functions<'match_whiskey_lines'>['Returns'][number];
export type FlavorProfileRow = Functions<'whiskey_flavor_profile'>['Returns'][number];
export type FriendRanking = Functions<'whiskey_friend_rankings'>['Returns'][number];
export type WishlistRow = Tables<'wishlist'> & { whiskey: Whiskey };
export type CollectionBottle = Tables<'collection_bottles'> & { whiskey: Whiskey };
export type Notification = Tables<'notifications'> & {
  actor: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
};
export type FollowRow = Tables<'follows'>;

export const CATEGORY_LABELS: Record<WhiskeyCategory, string> = {
  bourbon: 'Bourbon',
  rye: 'Rye',
  wheat: 'Wheat whiskey',
  tennessee: 'Tennessee',
  american_single_malt: 'American single malt',
  american_other: 'American (other)',
  scotch_single_malt: 'Scotch single malt',
  scotch_blended: 'Blended Scotch',
  scotch_blended_malt: 'Blended malt Scotch',
  scotch_grain: 'Scotch grain',
  irish: 'Irish',
  japanese: 'Japanese',
  canadian: 'Canadian',
  world: 'World',
  other: 'Other',
};

export const CATEGORY_GROUPS: { label: string; categories: WhiskeyCategory[] }[] = [
  { label: 'American', categories: ['bourbon', 'rye', 'wheat', 'tennessee', 'american_single_malt', 'american_other'] },
  { label: 'Scotch', categories: ['scotch_single_malt', 'scotch_blended', 'scotch_blended_malt', 'scotch_grain'] },
  { label: 'Irish', categories: ['irish'] },
  { label: 'Japanese', categories: ['japanese'] },
  { label: 'Canadian', categories: ['canadian'] },
  { label: 'World', categories: ['world', 'other'] },
];

export function categoryLabel(c: WhiskeyCategory | null | undefined) {
  return c ? CATEGORY_LABELS[c] : 'Whiskey';
}

/** "Kentucky · Bourbon · 10 yr · 45%" */
export function whiskeySubtitle(w: Pick<Whiskey, 'region' | 'country' | 'category' | 'age_years' | 'abv'>) {
  const parts = [w.region ?? w.country, categoryLabel(w.category)];
  if (w.age_years != null) parts.push(`${w.age_years} yr`);
  if (w.abv != null) parts.push(`${w.abv}%`);
  return parts.filter(Boolean).join(' · ');
}

const SELECT_WHISKEY_EMBED = '*, whiskey:whiskeys(*)';

function unwrap<T>(res: { data: T | null; error: PostgrestError | Error | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

async function me(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

// ---------------------------------------------------------------- catalog ---
export interface SearchFilters {
  categories?: WhiskeyCategory[];
  country?: string;
  region?: string;
  limit?: number;
  offset?: number;
}

export async function searchWhiskeys(q: string, f: SearchFilters = {}): Promise<Whiskey[]> {
  return unwrap(
    await supabase.rpc('search_whiskeys', {
      q,
      p_categories: f.categories && f.categories.length ? f.categories : undefined,
      p_country: f.country,
      p_region: f.region,
      p_limit: f.limit ?? 25,
      p_offset: f.offset ?? 0,
    }),
  );
}

export async function getWhiskey(id: string): Promise<WhiskeyWithDistillery> {
  return unwrap(await supabase.from('whiskeys').select('*, distillery:distilleries(*)').eq('id', id).single());
}

export async function getWhiskeyExtras(id: string) {
  const [flavors, friends, similar] = await Promise.all([
    supabase.rpc('whiskey_flavor_profile', { p_whiskey_id: id }),
    supabase.rpc('whiskey_friend_rankings', { p_whiskey_id: id }),
    supabase.rpc('similar_whiskeys', { p_whiskey_id: id, p_limit: 8 }),
  ]);
  return { flavors: unwrap(flavors), friends: unwrap(friends), similar: unwrap(similar) };
}

export type NewWhiskey = Pick<TablesInsert<'whiskeys'>, 'name' | 'category' | 'country'> &
  Partial<
    Pick<
      TablesInsert<'whiskeys'>,
      | 'brand'
      | 'distillery_name'
      | 'region'
      | 'age_years'
      | 'abv'
      | 'subcategory'
      | 'cask_type'
      | 'finish'
      | 'description'
      | 'image_url'
      | 'bottler'
    >
  >;

export async function createWhiskey(input: NewWhiskey): Promise<Whiskey> {
  const created_by = await me();
  return unwrap(
    await supabase
      .from('whiskeys')
      .insert({ ...input, created_by, status: 'pending' })
      .select('*')
      .single(),
  );
}

export async function getFlavorTags(): Promise<FlavorTag[]> {
  return unwrap(await supabase.from('flavor_tags').select('*').order('sort'));
}

// --------------------------------------------------------------- rankings ---
export async function listRankings(userId: string): Promise<RankingWithWhiskey[]> {
  return unwrap(
    await supabase
      .from('rankings')
      .select(SELECT_WHISKEY_EMBED)
      .eq('user_id', userId)
      .order('tier', { ascending: false })
      .order('position'),
  );
}

export interface UpsertRankingInput {
  whiskeyId: string;
  tier: Tier;
  position?: number | null;
  eventId?: string | null;
  comparisons?: { winner: string; loser: string }[];
}

export async function upsertRanking(input: UpsertRankingInput): Promise<RankingView> {
  const rows = unwrap(
    await supabase.rpc('upsert_ranking', {
      p_whiskey_id: input.whiskeyId,
      p_tier: input.tier,
      p_position: input.position ?? undefined,
      p_event_id: input.eventId ?? undefined,
      p_comparisons: input.comparisons ?? [],
    }),
  );
  const row = rows[0];
  if (!row) throw new Error('Ranking was not saved');
  return row;
}

export async function removeRanking(whiskeyId: string): Promise<void> {
  unwrap(await supabase.rpc('remove_ranking', { p_whiskey_id: whiskeyId }));
}

// --------------------------------------------------------------- tastings ---
export type NewTasting = Omit<TablesInsert<'tastings'>, 'user_id'> & {
  flavors?: { tag_slug: string; intensity?: number | null }[];
};

export async function createTasting(input: NewTasting): Promise<Tasting> {
  const user_id = await me();
  const { flavors, ...rest } = input;
  const tasting: Tasting = unwrap(
    await supabase
      .from('tastings')
      .insert({ ...rest, user_id })
      .select('*')
      .single(),
  );
  if (flavors?.length) await setTastingFlavors(tasting.id, flavors);
  return tasting;
}

export async function updateTasting(
  id: string,
  patch: TablesUpdate<'tastings'> & { flavors?: { tag_slug: string; intensity?: number | null }[] },
): Promise<Tasting> {
  const { flavors, ...rest } = patch;
  const tasting: Tasting = unwrap(await supabase.from('tastings').update(rest).eq('id', id).select('*').single());
  if (flavors) await setTastingFlavors(id, flavors);
  return tasting;
}

export async function setTastingFlavors(tastingId: string, flavors: { tag_slug: string; intensity?: number | null }[]) {
  unwrap(await supabase.from('tasting_flavors').delete().eq('tasting_id', tastingId));
  if (flavors.length) {
    unwrap(
      await supabase
        .from('tasting_flavors')
        .insert(flavors.map((f) => ({ tasting_id: tastingId, tag_slug: f.tag_slug, intensity: f.intensity ?? null }))),
    );
  }
}

export async function deleteTasting(id: string) {
  unwrap(await supabase.from('tastings').delete().eq('id', id));
}

export async function getTasting(id: string): Promise<TastingWithWhiskey> {
  return unwrap(
    await supabase
      .from('tastings')
      .select('*, whiskey:whiskeys(*), flavors:tasting_flavors(tag_slug, intensity)')
      .eq('id', id)
      .single(),
  );
}

export async function listTastings(userId: string, whiskeyId?: string): Promise<TastingWithWhiskey[]> {
  let q = supabase
    .from('tastings')
    .select('*, whiskey:whiskeys(*), flavors:tasting_flavors(tag_slug, intensity)')
    .eq('user_id', userId)
    .order('tasted_at', { ascending: false })
    .limit(100);
  if (whiskeyId) q = q.eq('whiskey_id', whiskeyId);
  return unwrap(await q);
}

export async function addTastingPhoto(tastingId: string, storagePath: string, sort = 0) {
  unwrap(await supabase.from('tasting_photos').insert({ tasting_id: tastingId, storage_path: storagePath, sort }));
}

// --------------------------------------------------------------- profiles ---
export async function getProfile(id: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).single());
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  return unwrap(await supabase.from('profiles').select('*').eq('username', username).maybeSingle());
}

export async function searchProfiles(q: string): Promise<Profile[]> {
  const term = q.trim();
  if (!term) return [];
  return unwrap(
    await supabase.from('profiles').select('*').or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(20),
  );
}

export async function updateProfile(patch: TablesUpdate<'profiles'>): Promise<Profile> {
  const id = await me();
  return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select('*').single());
}

export function legalDrinkingAge(country: string | null | undefined) {
  return country === 'US' ? 21 : 18;
}

export function ageOn(birthdate: Date, on = new Date()) {
  let age = on.getFullYear() - birthdate.getFullYear();
  const m = on.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < birthdate.getDate())) age--;
  return age;
}

export async function completeOnboarding(input: {
  username: string;
  display_name: string;
  birthdate: Date;
  home_country: string;
}) {
  const min = legalDrinkingAge(input.home_country);
  if (ageOn(input.birthdate) < min) {
    throw new Error(`You must be ${min} or older to use Dram.`);
  }
  return updateProfile({
    username: input.username.toLowerCase(),
    display_name: input.display_name,
    home_country: input.home_country,
    age_verified_at: new Date().toISOString(),
    onboarded_at: new Date().toISOString(),
  });
}

// ----------------------------------------------------------------- social ---
export async function getFollow(targetId: string): Promise<FollowRow | null> {
  const id = await me();
  return unwrap(
    await supabase.from('follows').select('*').eq('follower_id', id).eq('followee_id', targetId).maybeSingle(),
  );
}

export async function follow(targetId: string): Promise<FollowRow> {
  const id = await me();
  return unwrap(await supabase.from('follows').insert({ follower_id: id, followee_id: targetId }).select('*').single());
}

export async function unfollow(targetId: string) {
  const id = await me();
  unwrap(await supabase.from('follows').delete().eq('follower_id', id).eq('followee_id', targetId));
}

export async function acceptFollow(followerId: string) {
  const id = await me();
  unwrap(
    await supabase.from('follows').update({ status: 'accepted' }).eq('follower_id', followerId).eq('followee_id', id),
  );
}

export async function listFollowing(userId: string) {
  return unwrap(
    await supabase
      .from('follows')
      .select('followee_id, status, profile:profiles!follows_followee_id_fkey(id, username, display_name, avatar_url)')
      .eq('follower_id', userId)
      .eq('status', 'accepted'),
  );
}

export async function listFollowers(userId: string) {
  return unwrap(
    await supabase
      .from('follows')
      .select('follower_id, status, profile:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)')
      .eq('followee_id', userId),
  );
}

export async function tasteMatch(otherId: string): Promise<TasteMatch | null> {
  const rows = unwrap(await supabase.rpc('taste_match', { p_other: otherId }));
  return rows[0] ?? null;
}

export async function getFeed(
  opts: { beforeId?: number | null; actor?: string | null; limit?: number } = {},
): Promise<FeedItem[]> {
  return unwrap(
    await supabase.rpc('feed', {
      p_limit: opts.limit ?? 30,
      p_before_id: opts.beforeId ?? undefined,
      p_actor: opts.actor ?? undefined,
    }),
  );
}

export async function likeTasting(tastingId: string) {
  const id = await me();
  unwrap(await supabase.from('tasting_likes').insert({ user_id: id, tasting_id: tastingId }));
}

export async function unlikeTasting(tastingId: string) {
  const id = await me();
  unwrap(await supabase.from('tasting_likes').delete().eq('user_id', id).eq('tasting_id', tastingId));
}

export async function blockUser(targetId: string) {
  const id = await me();
  unwrap(await supabase.from('blocks').insert({ blocker_id: id, blocked_id: targetId }));
}

export async function reportContent(input: {
  target_type: 'tasting' | 'profile' | 'whiskey' | 'comment' | 'event';
  target_id: string;
  reason: 'spam' | 'abuse' | 'inaccurate' | 'duplicate' | 'other';
  details?: string;
}) {
  const reporter_id = await me();
  unwrap(await supabase.from('reports').insert({ ...input, reporter_id }));
}

// --------------------------------------------------------------- discover ---
export async function trending(days = 14, limit = 20): Promise<Whiskey[]> {
  return unwrap(await supabase.rpc('trending_whiskeys', { p_days: days, p_limit: limit }));
}

export async function topWhiskeys(
  f: { category?: WhiskeyCategory; country?: string; region?: string; limit?: number } = {},
): Promise<Whiskey[]> {
  return unwrap(
    await supabase.rpc('top_whiskeys', {
      p_category: f.category,
      p_country: f.country,
      p_region: f.region,
      p_limit: f.limit ?? 20,
    }),
  );
}

export async function friendsLoved(limit = 20): Promise<FriendsLovedRow[]> {
  return unwrap(await supabase.rpc('friends_loved', { p_limit: limit }));
}

// ----------------------------------------------------------------- events ---
export async function listMyEvents(): Promise<(Event & { my_membership: { role: Enums<'event_role'> }[] })[]> {
  const id = await me();
  return unwrap(
    await supabase
      .from('events')
      .select('*, my_membership:event_members!inner(role)')
      .eq('event_members.user_id', id)
      .order('starts_at', { ascending: false }),
  );
}

export async function listPublicEvents(): Promise<Event[]> {
  return unwrap(
    await supabase
      .from('events')
      .select('*')
      .eq('visibility', 'public')
      .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
      .order('starts_at')
      .limit(50),
  );
}

export async function getEvent(id: string): Promise<EventWithPours> {
  const uid = await me();
  return unwrap(
    await supabase
      .from('events')
      .select('*, pours:event_pours(*, whiskey:whiskeys(*)), my_membership:event_members(role)')
      .eq('id', id)
      .eq('event_members.user_id', uid)
      .order('sort_order', { referencedTable: 'event_pours' })
      .single(),
  );
}

export async function listEventMembers(eventId: string): Promise<EventMember[]> {
  return unwrap(
    await supabase
      .from('event_members')
      .select('*, profile:profiles(id, username, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('joined_at'),
  );
}

export type NewEvent = Pick<TablesInsert<'events'>, 'name' | 'starts_at'> &
  Partial<
    Pick<
      TablesInsert<'events'>,
      'description' | 'venue_name' | 'address' | 'ends_at' | 'timezone' | 'visibility' | 'cover_image_url'
    >
  >;

export async function createEvent(input: NewEvent): Promise<Event> {
  const created_by = await me();
  // join_code is assigned by a trigger; the generated Insert type requires it so pass a placeholder that the trigger overwrites when null.
  return unwrap(
    await supabase
      .from('events')
      .insert({ ...input, created_by, join_code: null as unknown as string })
      .select('*')
      .single(),
  );
}

export async function updateEvent(id: string, patch: TablesUpdate<'events'>): Promise<Event> {
  return unwrap(await supabase.from('events').update(patch).eq('id', id).select('*').single());
}

export async function joinEvent(code: string): Promise<Event> {
  const rows = unwrap(await supabase.rpc('join_event', { p_code: code }));
  const ev = rows[0];
  if (!ev) throw new Error('No event with that code');
  return ev;
}

export async function joinPublicEvent(eventId: string) {
  const user_id = await me();
  unwrap(await supabase.from('event_members').insert({ event_id: eventId, user_id, role: 'attendee' }));
}

export async function leaveEvent(eventId: string) {
  const user_id = await me();
  unwrap(await supabase.from('event_members').delete().eq('event_id', eventId).eq('user_id', user_id));
}

export async function addPour(
  input: Pick<TablesInsert<'event_pours'>, 'event_id' | 'whiskey_id'> &
    Partial<Pick<TablesInsert<'event_pours'>, 'label' | 'flight' | 'table_location' | 'sort_order' | 'notes'>>,
) {
  const added_by = await me();
  return unwrap(
    await supabase
      .from('event_pours')
      .insert({ ...input, added_by })
      .select('*')
      .single(),
  );
}

export async function updatePour(id: string, patch: TablesUpdate<'event_pours'>) {
  return unwrap(await supabase.from('event_pours').update(patch).eq('id', id).select('*').single());
}

export async function removePour(id: string) {
  unwrap(await supabase.from('event_pours').delete().eq('id', id));
}

export async function matchLines(lines: string[]): Promise<LineMatch[]> {
  return unwrap(await supabase.rpc('match_whiskey_lines', { p_lines: lines }));
}

export async function getLeaderboard(eventId: string): Promise<LeaderboardRow[]> {
  return unwrap(await supabase.rpc('event_leaderboard', { p_event_id: eventId }));
}

export async function listMyEventTastings(eventId: string): Promise<Tasting[]> {
  const user_id = await me();
  return unwrap(await supabase.from('tastings').select('*').eq('event_id', eventId).eq('user_id', user_id));
}

// -------------------------------------------------------- wishlist & bar ----
export async function listWishlist(userId: string): Promise<WishlistRow[]> {
  return unwrap(
    await supabase
      .from('wishlist')
      .select(SELECT_WHISKEY_EMBED)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function setWishlisted(whiskeyId: string, on: boolean) {
  const user_id = await me();
  if (on) unwrap(await supabase.from('wishlist').upsert({ user_id, whiskey_id: whiskeyId }));
  else unwrap(await supabase.from('wishlist').delete().eq('user_id', user_id).eq('whiskey_id', whiskeyId));
}

export async function listCollection(userId: string): Promise<CollectionBottle[]> {
  return unwrap(
    await supabase
      .from('collection_bottles')
      .select(SELECT_WHISKEY_EMBED)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function addBottle(input: Omit<TablesInsert<'collection_bottles'>, 'user_id'>) {
  const user_id = await me();
  return unwrap(
    await supabase
      .from('collection_bottles')
      .insert({ ...input, user_id })
      .select('*')
      .single(),
  );
}

export async function updateBottle(id: string, patch: TablesUpdate<'collection_bottles'>) {
  return unwrap(await supabase.from('collection_bottles').update(patch).eq('id', id).select('*').single());
}

export async function removeBottle(id: string) {
  unwrap(await supabase.from('collection_bottles').delete().eq('id', id));
}

// ---------------------------------------------------------- notifications ---
export async function listNotifications(): Promise<Notification[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50),
  );
}

export async function markNotificationsRead(ids?: number[]) {
  const user_id = await me();
  let q = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .is('read_at', null);
  if (ids?.length) q = q.in('id', ids);
  unwrap(await q);
}

export async function registerPushToken(token: string, platform: 'ios' | 'android' | 'web') {
  const user_id = await me();
  unwrap(await supabase.from('push_tokens').upsert({ token, user_id, platform, updated_at: new Date().toISOString() }));
}

// ---------------------------------------------------------------- storage ---
export type Bucket = 'avatars' | 'whiskey-images' | 'event-covers' | 'tasting-photos' | 'label-scans';

/** Upload a local image (file:// or content:// uri) into `<bucket>/<uid>/<random>.<ext>`; returns the object path. */
export async function uploadImage(bucket: Bucket, localUri: string, contentType = 'image/jpeg'): Promise<string> {
  const uid = await me();
  const ext = contentType.split('/')[1] ?? 'jpg';
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(localUri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedUrl(bucket: Bucket, path: string, seconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ---------------------------------------------------------- identify-label --
export interface LabelExtraction {
  brand: string | null;
  expression: string | null;
  distillery: string | null;
  category: WhiskeyCategory | null;
  country: string | null;
  age_years: number | null;
  abv: number | null;
  confidence: 'high' | 'medium' | 'low';
  raw_text: string;
}
export interface IdentifyResult {
  extracted: LabelExtraction;
  query: string;
  matches: Whiskey[];
}

export async function identifyLabel(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<IdentifyResult> {
  const { data, error } = await supabase.functions.invoke<IdentifyResult>('identify-label', {
    body: { image_base64: imageBase64, media_type: mediaType },
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No response from identify-label');
  return data;
}

// ---------------------------------------------------------------- account ---
export async function exportMyData(): Promise<unknown> {
  return unwrap(await supabase.rpc('export_my_data'));
}

export async function deleteMyAccount() {
  unwrap(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut();
}
