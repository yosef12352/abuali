-- Abu Ali Chat: additive social graph migration v1
-- Review against production schema before executing. No existing table is altered.
begin;
create extension if not exists pgcrypto;
create table if not exists public.social_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text unique,
 display_name text not null default '',
 bio text not null default '',
 avatar_path text,
 cover_path text,
 discoverable boolean not null default true,
 friend_request_policy text not null default 'everyone' check (friend_request_policy in ('everyone','mutuals','nobody')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint username_valid check(username is null or username ~ '^[a-z0-9_]{3,30}$'),
 constraint bio_length check(char_length(bio)<=160)
);
create table if not exists public.social_friendships (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users(id) on delete cascade,
 addressee_id uuid not null references auth.users(id) on delete cascade,
 user_low uuid generated always as (least(requester_id,addressee_id)) stored,
 user_high uuid generated always as (greatest(requester_id,addressee_id)) stored,
 status text not null default 'pending' check (status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(requester_id<>addressee_id),
 unique(user_low,user_high)
);
create index if not exists social_friendships_addressee_status on public.social_friendships(addressee_id,status);
create index if not exists social_friendships_requester_status on public.social_friendships(requester_id,status);
create table if not exists public.social_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
create table if not exists public.social_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('friend_request','friend_accepted')),
 friendship_id uuid references public.social_friendships(id) on delete cascade,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists social_notifications_recipient on public.social_notifications(recipient_id,created_at desc);
alter table public.social_profiles enable row level security;
alter table public.social_friendships enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_notifications enable row level security;
revoke all on public.social_profiles,public.social_friendships,public.social_blocks,public.social_notifications from anon;
grant select,insert,update on public.social_profiles to authenticated;
grant select on public.social_friendships,public.social_blocks,public.social_notifications to authenticated;
create policy social_profile_read on public.social_profiles for select to authenticated using (
 user_id=(select auth.uid()) or
 (discoverable and not exists(
 select 1 from public.social_blocks b where
 (b.blocker_id=(select auth.uid()) and b.blocked_id=user_id) or
 (b.blocked_id=(select auth.uid()) and b.blocker_id=user_id)))
);
create policy social_profile_insert on public.social_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy social_profile_update on public.social_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy social_friendship_read on public.social_friendships for select to authenticated using(
 requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
create policy social_block_read on public.social_blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy social_notification_read on public.social_notifications for select to authenticated using(recipient_id=(select auth.uid()));
-- RPC writes only. SECURITY DEFINER owner must be trusted; search_path is pinned.
create or replace function public.social_send_friend_request(p_target uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_me uuid:=auth.uid(); v_policy text; v_id uuid; v_status text; v_requester uuid;
begin
 if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_target is null or p_target=v_me then raise exception 'INVALID_TARGET'; end if;
 if not exists(select 1 from auth.users where id=p_target) then raise exception 'USER_NOT_FOUND'; end if;
 if exists(select 1 from public.social_blocks where
 (blocker_id=v_me and blocked_id=p_target) or (blocker_id=p_target and blocked_id=v_me)) then
 raise exception 'BLOCKED'; end if;
 select friend_request_policy into v_policy from public.social_profiles where user_id=p_target and discoverable;
 if v_policy is null or v_policy='nobody' then raise exception 'REQUESTS_DISABLED'; end if;
 if v_policy='mutuals' and not exists(
 select 1 from public.social_friendships a join public.social_friendships b
 on (case when a.requester_id=v_me then a.addressee_id else a.requester_id end)=
    (case when b.requester_id=p_target then b.addressee_id else b.requester_id end)
 where a.status='accepted' and b.status='accepted'
 and v_me in (a.requester_id,a.addressee_id)
 and p_target in (b.requester_id,b.addressee_id)
 ) then raise exception 'MUTUAL_FRIEND_REQUIRED'; end if;
 -- simple anti-spam cap; use a dedicated rate-limit service for production.
 if (select count(*) from public.social_friendships where requester_id=v_me and created_at>now()-interval '24 hours')>=30
 then raise exception 'RATE_LIMIT'; end if;
 insert into public.social_friendships(requester_id,addressee_id)
 values(v_me,p_target)
 on conflict(user_low,user_high) do nothing returning id into v_id;
 if v_id is null then
 select id,status,requester_id into v_id,v_status,v_requester
 from public.social_friendships where user_low=least(v_me,p_target) and user_high=greatest(v_me,p_target);
 if v_status='accepted' then raise exception 'ALREADY_FRIENDS'; end if;
 if v_status='pending' then raise exception 'REQUEST_ALREADY_EXISTS'; end if;
 -- A rejected request is not silently reactivated; recipient may initiate a new request.
 raise exception 'PREVIOUSLY_REJECTED';
 end if;
 insert into public.social_notifications(recipient_id,actor_id,kind,friendship_id)
 values(p_target,v_me,'friend_request',v_id);
 return v_id;
end $$;
create or replace function public.social_respond_friend_request(p_request uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_me uuid:=auth.uid(); v_row public.social_friendships%rowtype;
begin
 if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_row from public.social_friendships where id=p_request for update;
 if not found or v_row.addressee_id<>v_me or v_row.status<>'pending' then raise exception 'REQUEST_NOT_AVAILABLE'; end if;
 if exists(select 1 from public.social_blocks where
 (blocker_id=v_me and blocked_id=v_row.requester_id) or
 (blocker_id=v_row.requester_id and blocked_id=v_me)) then raise exception 'BLOCKED'; end if;
 update public.social_friendships set status=case when p_accept then 'accepted' else 'rejected' end,updated_at=now() where id=p_request;
 if p_accept then
 insert into public.social_notifications(recipient_id,actor_id,kind,friendship_id)
 values(v_row.requester_id,v_me,'friend_accepted',p_request);
 end if;
end $$;
create or replace function public.social_remove_friendship(p_other uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_me uuid:=auth.uid();
begin
 if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
 delete from public.social_friendships where user_low=least(v_me,p_other) and user_high=greatest(v_me,p_other);
end $$;
create or replace function public.social_set_block(p_other uuid,p_block boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_me uuid:=auth.uid();
begin
 if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_other is null or p_other=v_me then raise exception 'INVALID_TARGET'; end if;
 if p_block then
 insert into public.social_blocks(blocker_id,blocked_id) values(v_me,p_other) on conflict do nothing;
 delete from public.social_friendships where user_low=least(v_me,p_other) and user_high=greatest(v_me,p_other);
 else
 delete from public.social_blocks where blocker_id=v_me and blocked_id=p_other;
 end if;
end $$;
revoke all on function public.social_send_friend_request(uuid),public.social_respond_friend_request(uuid,boolean),public.social_remove_friendship(uuid),public.social_set_block(uuid,boolean) from public,anon;
grant execute on function public.social_send_friend_request(uuid),public.social_respond_friend_request(uuid,boolean),public.social_remove_friendship(uuid),public.social_set_block(uuid,boolean) to authenticated;
commit;
