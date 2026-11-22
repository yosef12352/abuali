create policy "avatar accepted friends read" on storage.objects for select to authenticated using (
 bucket_id='profile-avatars'
 and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and exists (
 select 1 from public.chat_friendships f
 where f.status='accepted'
 and f.user_low=least(auth.uid(),(storage.foldername(name))[1]::uuid)
 and f.user_high=greatest(auth.uid(),(storage.foldername(name))[1]::uuid)
 )
);