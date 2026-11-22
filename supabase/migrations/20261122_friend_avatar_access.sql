-- Allow accepted friends to fetch signed avatar URLs without making the bucket public.
create policy "avatar accepted friends read" on storage.objects
for select to authenticated using (
 bucket_id='profile-avatars' and exists (
 select 1 from public.chat_friendships f
 where f.status='accepted'
 and f.user_low=least(auth.uid(),(storage.foldername(name))[1]::uuid)
 and f.user_high=greatest(auth.uid(),(storage.foldername(name))[1]::uuid)
 )
);
