-- Compatible with existing public.profiles and public.user_blocks.
-- Additive: no existing chat or profile data is modified.
create table if not exists public.chat_friendships(
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users(id) on delete cascade,
 addressee_id uuid not null references auth.users(id) on delete cascade,
 user_low uuid generated always as (least(requester_id,addressee_id)) stored,
 user_high uuid generated always as (greatest(requester_id,addressee_id)) stored,
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint chat_friendship_not_self check(requester_id<>addressee_id),
 constraint chat_friendship_pair_unique unique(user_low,user_high)
);
create index if not exists chat_friendships_incoming_idx on public.chat_friendships(addressee_id,status);
create index if not exists chat_friendships_outgoing_idx on public.chat_friendships(requester_id,status);
alter table public.chat_friendships enable row level security;
revoke all on public.chat_friendships from anon;
grant select on public.chat_friendships to authenticated;
create policy chat_friendships_participants_read on public.chat_friendships for select to authenticated using(requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));

create or replace function public.chat_send_friend_request(p_other uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); request_id uuid; existing_status text;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 if p_other is null or p_other=me then raise exception 'INVALID_TARGET';end if;
 if not exists(select 1 from public.profiles where id=p_other) then raise exception 'USER_NOT_FOUND';end if;
 if exists(select 1 from public.user_blocks where (blocker_id=me and blocked_id=p_other) or (blocker_id=p_other and blocked_id=me)) then raise exception 'BLOCKED';end if;
 if coalesce((select settings->>'private' from public.profiles where id=p_other),'false')='true' then raise exception 'ACCOUNT_PRIVATE';end if;
 if (select count(*) from public.chat_friendships where requester_id=me and created_at>now()-interval '24 hours')>=30 then raise exception 'RATE_LIMIT';end if;
 insert into public.chat_friendships(requester_id,addressee_id) values(me,p_other)
 on conflict(user_low,user_high) do nothing returning id into request_id;
 if request_id is null then
 select status into existing_status from public.chat_friendships where user_low=least(me,p_other) and user_high=greatest(me,p_other);
 raise exception 'RELATION_EXISTS: %',existing_status;
 end if;
 return request_id;
end $$;
create or replace function public.chat_respond_friend_request(p_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); friend public.chat_friendships%rowtype;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 select * into friend from public.chat_friendships where id=p_id for update;
 if not found or friend.addressee_id<>me or friend.status<>'pending' then raise exception 'REQUEST_NOT_AVAILABLE';end if;
 if exists(select 1 from public.user_blocks where (blocker_id=me and blocked_id=friend.requester_id) or (blocker_id=friend.requester_id and blocked_id=me)) then raise exception 'BLOCKED';end if;
 update public.chat_friendships set status=case when p_accept then 'accepted' else 'rejected' end,updated_at=now() where id=p_id;
end $$;
create or replace function public.chat_cancel_friend_request(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 delete from public.chat_friendships where id=p_id and requester_id=auth.uid() and status='pending';
 if not found then raise exception 'REQUEST_NOT_AVAILABLE';end if;
end $$;
create or replace function public.chat_remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 delete from public.chat_friendships where user_low=least(auth.uid(),p_other) and user_high=greatest(auth.uid(),p_other) and status='accepted';
 if not found then raise exception 'FRIENDSHIP_NOT_FOUND';end if;
end $$;
revoke all on function public.chat_send_friend_request(uuid),public.chat_respond_friend_request(uuid,boolean),public.chat_cancel_friend_request(uuid),public.chat_remove_friend(uuid) from public,anon;
grant execute on function public.chat_send_friend_request(uuid),public.chat_respond_friend_request(uuid,boolean),public.chat_cancel_friend_request(uuid),public.chat_remove_friend(uuid) to authenticated;
