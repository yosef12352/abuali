-- Safe discoverability: profiles remain self-readable under existing RLS.
-- This SECURITY DEFINER RPC exposes only id/display_name/avatar_path/bio,
-- excludes blocked/private accounts and never exposes email or settings.
create or replace function public.chat_discover_people(p_search text default '',p_limit integer default 30)
returns table(id uuid,display_name text,avatar_path text,bio text,friendship_id uuid,friendship_status text,requester_id uuid)
language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,p.avatar_path,p.bio,f.id,f.status,f.requester_id
 from public.profiles p
 left join public.chat_friendships f on f.user_low=least(auth.uid(),p.id) and f.user_high=greatest(auth.uid(),p.id)
 where auth.uid() is not null and p.id<>auth.uid()
 and coalesce(p.settings->>'private','false')<>'true'
 and not exists(select 1 from public.user_blocks b where
 (b.blocker_id=auth.uid() and b.blocked_id=p.id) or
 (b.blocker_id=p.id and b.blocked_id=auth.uid()))
 and (coalesce(trim(p_search),'')='' or strpos(lower(coalesce(p.display_name,'')),lower(left(trim(p_search),60)))>0)
 order by (f.status='accepted') desc nulls last,p.created_at desc
 limit least(greatest(coalesce(p_limit,30),1),50)
$$;
revoke all on function public.chat_discover_people(text,integer) from public,anon;
grant execute on function public.chat_discover_people(text,integer) to authenticated;
-- A rejected request may be reinitiated only by its previous recipient.
-- This avoids infinite spam from the original sender.
create or replace function public.chat_send_friend_request(p_other uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); request_id uuid; old public.chat_friendships%rowtype;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 if p_other is null or p_other=me then raise exception 'INVALID_TARGET';end if;
 if not exists(select 1 from public.profiles where id=p_other) then raise exception 'USER_NOT_FOUND';end if;
 if exists(select 1 from public.user_blocks where (blocker_id=me and blocked_id=p_other) or (blocker_id=p_other and blocked_id=me)) then raise exception 'BLOCKED';end if;
 if coalesce((select settings->>'private' from public.profiles where id=p_other),'false')='true' then raise exception 'ACCOUNT_PRIVATE';end if;
 if (select count(*) from public.chat_friendships where requester_id=me and created_at>now()-interval '24 hours')>=30 then raise exception 'RATE_LIMIT';end if;
 insert into public.chat_friendships(requester_id,addressee_id) values(me,p_other)
 on conflict(user_low,user_high) do nothing returning id into request_id;
 if request_id is not null then return request_id;end if;
 select * into old from public.chat_friendships where user_low=least(me,p_other) and user_high=greatest(me,p_other) for update;
 if old.status='rejected' and old.addressee_id=me and old.updated_at<now()-interval '24 hours' then
 update public.chat_friendships set requester_id=me,addressee_id=p_other,status='pending',created_at=now(),updated_at=now() where id=old.id returning id into request_id;
 return request_id;
 end if;
 raise exception 'RELATION_EXISTS: %',old.status;
end $$;
