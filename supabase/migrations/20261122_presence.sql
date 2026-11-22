create table if not exists public.chat_presence(
 user_id uuid primary key references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default now()
);
alter table public.chat_presence enable row level security;
revoke all on public.chat_presence from anon,authenticated;
create or replace function public.chat_presence_heartbeat()
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 insert into public.chat_presence(user_id,last_seen_at) values(auth.uid(),now())
 on conflict(user_id) do update set last_seen_at=now();
end $$;
create or replace function public.chat_get_presence(p_users uuid[])
returns table(user_id uuid,is_online boolean)
language sql stable security definer set search_path='' as $$
 select p.id,coalesce(pr.last_seen_at>now()-interval '90 seconds',false)
 from public.profiles p left join public.chat_presence pr on pr.user_id=p.id
 where auth.uid() is not null
 and p.id=any(p_users)
 and cardinality(p_users)<=50
 and (p.id=auth.uid() or (
  coalesce(p.settings->>'last_seen','everyone')<>'nobody'
  and not exists(select 1 from public.user_blocks b where
  (b.blocker_id=auth.uid() and b.blocked_id=p.id) or
  (b.blocker_id=p.id and b.blocked_id=auth.uid()))
  and (coalesce(p.settings->>'last_seen','everyone')<>'contacts' or exists(
   select 1 from public.chat_friendships f where f.status='accepted'
   and f.user_low=least(auth.uid(),p.id) and f.user_high=greatest(auth.uid(),p.id)))
 ))
$$;
revoke all on function public.chat_presence_heartbeat(),public.chat_get_presence(uuid[]) from public,anon;
grant execute on function public.chat_presence_heartbeat(),public.chat_get_presence(uuid[]) to authenticated;
