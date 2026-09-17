-- =============================================================================
-- Dram — 0700: storage buckets and object policies
-- =============================================================================
-- Object key convention: <bucket>/<owner uuid>/<uuid>.<ext>
--   avatars         public   5 MB   profile pictures
--   whiskey-images  public  10 MB   catalog bottle shots (user contributed, moderated)
--   event-covers    public  10 MB   event banners
--   tasting-photos  private 10 MB   photos attached to tastings (signed URLs)
--   label-scans     private 10 MB   short-lived uploads for identify-label
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',        'avatars',        true,  5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('whiskey-images', 'whiskey-images', true,  10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-covers',   'event-covers',   true,  10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('tasting-photos', 'tasting-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('label-scans',    'label-scans',    false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public buckets: anyone can read, owners write inside their own folder.
create policy "public buckets are readable" on storage.objects for select
  using (bucket_id in ('avatars', 'whiskey-images', 'event-covers'));

create policy "owners upload to their folder (public buckets)" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'whiskey-images', 'event-covers', 'tasting-photos', 'label-scans')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owners update their objects" on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text)
  with check ((storage.foldername(name))[1] = auth.uid()::text);

create policy "owners delete their objects" on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator());

-- Private buckets: owner, or (for tasting photos) anyone who may view that profile.
create policy "tasting photos follow profile visibility" on storage.objects for select to authenticated
  using (bucket_id = 'tasting-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.can_view_profile(((storage.foldername(name))[1])::uuid)));

create policy "label scans are private" on storage.objects for select to authenticated
  using (bucket_id = 'label-scans' and (storage.foldername(name))[1] = auth.uid()::text);
