-- =============================================================================
-- Dram — 0600: row-level security
-- =============================================================================
-- Every table has RLS enabled. The app uses the anon key + user JWT only; the
-- service role is reserved for edge functions and ops.
-- =============================================================================

alter table public.profiles           enable row level security;
alter table public.distilleries       enable row level security;
alter table public.whiskeys           enable row level security;
alter table public.whiskey_aliases    enable row level security;
alter table public.flavor_tags        enable row level security;
alter table public.events             enable row level security;
alter table public.event_members      enable row level security;
alter table public.event_pours        enable row level security;
alter table public.rankings           enable row level security;
alter table public.comparisons        enable row level security;
alter table public.tastings           enable row level security;
alter table public.tasting_flavors    enable row level security;
alter table public.tasting_photos     enable row level security;
alter table public.wishlist           enable row level security;
alter table public.collection_bottles enable row level security;
alter table public.follows            enable row level security;
alter table public.blocks             enable row level security;
alter table public.activities         enable row level security;
alter table public.tasting_likes      enable row level security;
alter table public.tasting_comments   enable row level security;
alter table public.notifications      enable row level security;
alter table public.push_tokens        enable row level security;
alter table public.reports            enable row level security;

-- Helper: is the caller a member of the event?
create or replace function public.is_event_member(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_members m
                  where m.event_id = p_event_id and m.user_id = auth.uid())
$$;

create or replace function public.is_event_host(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_members m
                  where m.event_id = p_event_id and m.user_id = auth.uid()
                    and m.role in ('organizer', 'host'))
$$;

create or replace function public.can_view_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e
                  where e.id = p_event_id
                    and (e.visibility = 'public' or e.created_by = auth.uid()
                         or public.is_event_member(e.id)))
$$;

create or replace function public.can_view_tasting(p_tasting_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tastings t
                  where t.id = p_tasting_id
                    and (t.user_id = auth.uid() or public.can_view_profile(t.user_id)))
$$;

-- ---------------------------------------------------------------- profiles --
-- Basic identity is visible to every signed-in user (needed for search,
-- follow requests, event attendee lists). Content visibility is enforced on
-- the content tables via can_view_profile().
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_moderator = (select p.is_moderator from public.profiles p where p.id = auth.uid()));

-- ------------------------------------------------------------- catalog -----
create policy distilleries_select on public.distilleries for select to authenticated using (true);
create policy distilleries_insert on public.distilleries for insert to authenticated
  with check (created_by = auth.uid() and (status = 'pending' or public.is_moderator()));
create policy distilleries_update on public.distilleries for update to authenticated
  using (public.is_moderator() or (created_by = auth.uid() and status = 'pending'));

create policy whiskeys_select on public.whiskeys for select to authenticated
  using (status in ('approved', 'pending', 'merged') or created_by = auth.uid() or public.is_moderator());
create policy whiskeys_insert on public.whiskeys for insert to authenticated
  with check (created_by = auth.uid() and (status = 'pending' or public.is_moderator()));
create policy whiskeys_update on public.whiskeys for update to authenticated
  using (public.is_moderator() or (created_by = auth.uid() and status = 'pending'))
  with check (public.is_moderator() or (created_by = auth.uid() and status = 'pending'));
create policy whiskeys_delete on public.whiskeys for delete to authenticated
  using (public.is_moderator());

create policy whiskey_aliases_select on public.whiskey_aliases for select to authenticated using (true);
create policy whiskey_aliases_write on public.whiskey_aliases for all to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy flavor_tags_select on public.flavor_tags for select to authenticated using (true);

-- --------------------------------------------------------------- events -----
create policy events_select on public.events for select to authenticated
  using (visibility = 'public' or created_by = auth.uid() or public.is_event_member(id));
create policy events_insert on public.events for insert to authenticated
  with check (created_by = auth.uid());
create policy events_update on public.events for update to authenticated
  using (created_by = auth.uid() or public.is_event_host(id))
  with check (created_by = auth.uid() or public.is_event_host(id));
create policy events_delete on public.events for delete to authenticated
  using (created_by = auth.uid());

create policy event_members_select on public.event_members for select to authenticated
  using (user_id = auth.uid() or public.is_event_member(event_id) or public.can_view_event(event_id));
-- Direct joins are allowed for public events; code-only events go through join_event().
create policy event_members_insert on public.event_members for insert to authenticated
  with check (
    (user_id = auth.uid() and role = 'attendee'
       and exists (select 1 from public.events e where e.id = event_id and e.visibility = 'public'))
    or public.is_event_host(event_id)
  );
create policy event_members_update on public.event_members for update to authenticated
  using (public.is_event_host(event_id)) with check (public.is_event_host(event_id));
create policy event_members_delete on public.event_members for delete to authenticated
  using (user_id = auth.uid() or public.is_event_host(event_id));

create policy event_pours_select on public.event_pours for select to authenticated
  using (public.can_view_event(event_id));
create policy event_pours_write on public.event_pours for all to authenticated
  using (public.is_event_host(event_id)) with check (public.is_event_host(event_id));

-- --------------------------------------------------------- rankings etc. ----
create policy rankings_select on public.rankings for select to authenticated
  using (user_id = auth.uid() or public.can_view_profile(user_id));
create policy rankings_write on public.rankings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy comparisons_own on public.comparisons for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy tastings_select on public.tastings for select to authenticated
  using (user_id = auth.uid() or public.can_view_profile(user_id));
create policy tastings_write on public.tastings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and (event_id is null or public.is_event_member(event_id)));

create policy tasting_flavors_select on public.tasting_flavors for select to authenticated
  using (public.can_view_tasting(tasting_id));
create policy tasting_flavors_write on public.tasting_flavors for all to authenticated
  using (exists (select 1 from public.tastings t where t.id = tasting_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.tastings t where t.id = tasting_id and t.user_id = auth.uid()));

create policy tasting_photos_select on public.tasting_photos for select to authenticated
  using (public.can_view_tasting(tasting_id));
create policy tasting_photos_write on public.tasting_photos for all to authenticated
  using (exists (select 1 from public.tastings t where t.id = tasting_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.tastings t where t.id = tasting_id and t.user_id = auth.uid()));

create policy wishlist_select on public.wishlist for select to authenticated
  using (user_id = auth.uid() or public.can_view_profile(user_id));
create policy wishlist_write on public.wishlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy collection_select on public.collection_bottles for select to authenticated
  using (user_id = auth.uid() or public.can_view_profile(user_id));
create policy collection_write on public.collection_bottles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --------------------------------------------------------------- social -----
create policy follows_select on public.follows for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid()
         or (status = 'accepted' and (public.can_view_profile(follower_id) or public.can_view_profile(followee_id))));
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid());
create policy follows_update on public.follows for update to authenticated   -- accept a request
  using (followee_id = auth.uid()) with check (followee_id = auth.uid());
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy activities_select on public.activities for select to authenticated
  using (actor_id = auth.uid() or public.can_view_profile(actor_id));
-- Rows are inserted by triggers (security definer) and upsert_ranking (as the actor).
create policy activities_insert on public.activities for insert to authenticated
  with check (actor_id = auth.uid());
create policy activities_delete on public.activities for delete to authenticated
  using (actor_id = auth.uid());

create policy tasting_likes_select on public.tasting_likes for select to authenticated
  using (public.can_view_tasting(tasting_id));
create policy tasting_likes_insert on public.tasting_likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_tasting(tasting_id));
create policy tasting_likes_delete on public.tasting_likes for delete to authenticated
  using (user_id = auth.uid());

create policy tasting_comments_select on public.tasting_comments for select to authenticated
  using (public.can_view_tasting(tasting_id));
create policy tasting_comments_insert on public.tasting_comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_tasting(tasting_id));
create policy tasting_comments_delete on public.tasting_comments for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.tastings t where t.id = tasting_id and t.user_id = auth.uid()));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
create policy reports_update on public.reports for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- --------------------------------------------------------------- grants -----
-- Supabase grants table access to anon/authenticated by default; RLS does the
-- real gating. Anonymous users get nothing in V1 (the app requires sign-in).
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
