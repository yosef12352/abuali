alter table public.profiles add column if not exists cover_path text;
create or replace function public.chat_view_profile(p_user uuid)
returns table(id uuid,display_name text,bio text,avatar_path text,cover_path text,friendship_status text,is_friend boolean)
language sql stable security definer set search_path='' as $$
select p.id,p.display_name,p.bio,p.avatar_path,p.cover_path,
 f.status,coalesce(f.status='accepted',false)
from public.profiles p
left join public.chat_friendships f on f.user_low=least(auth.uid(),p.id) and f.user_high=greatest(auth.uid(),p.id)
where auth.uid() is not null and p.id=p_user
and not exists(select 1 from public.user_blocks b where
 (b.blocker_id=auth.uid() and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=auth.uid()))
and (p.id=auth.uid() or f.status='accepted' or coalesce(p.settings->>'private','false')<>'true')
$$;
revoke all on function public.chat_view_profile(uuid) from public,anon;
grant execute on function public.chat_view_profile(uuid) to authenticated;