create or replace function public.chat_my_friend_profiles()
returns table(id uuid,display_name text,avatar_path text,bio text)
language sql stable security definer set search_path='' as $$
select p.id,p.display_name,p.avatar_path,p.bio
from public.chat_friendships f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.addressee_id else f.requester_id end
where f.status='accepted' and (f.requester_id=auth.uid() or f.addressee_id=auth.uid())
and not exists(select 1 from public.user_blocks b where
 (b.blocker_id=auth.uid() and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=auth.uid()))
$$;
revoke all on function public.chat_my_friend_profiles() from public,anon;
grant execute on function public.chat_my_friend_profiles() to authenticated;