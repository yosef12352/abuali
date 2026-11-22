create or replace function public.save_my_avatar(p_avatar_path text)
returns text language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
 if p_avatar_path is null or p_avatar_path !~ ('^'||auth.uid()::text||'/avatar-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[.]jpg$')
 and p_avatar_path not in (auth.uid()::text||'/avatar.jpg',auth.uid()::text||'/avatar.png',auth.uid()::text||'/avatar.webp')
 then raise exception 'Invalid avatar path' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=p_avatar_path) then raise exception 'Avatar not uploaded' using errcode='22023';end if;
 insert into public.profiles(id,display_name,avatar_path) values(auth.uid(),'مستخدم',p_avatar_path)
 on conflict(id) do update set avatar_path=excluded.avatar_path;
 return p_avatar_path;
end $$;
create or replace function public.chat_save_my_cover(p_cover_path text)
returns text language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000';end if;
 if p_cover_path is null or p_cover_path !~ ('^'||auth.uid()::text||'/cover-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$')
 then raise exception 'Invalid cover path' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=p_cover_path) then raise exception 'Cover not uploaded' using errcode='22023';end if;
 insert into public.profiles(id,display_name,cover_path) values(auth.uid(),'مستخدم',p_cover_path)
 on conflict(id) do update set cover_path=excluded.cover_path;
 return p_cover_path;
end $$;
revoke all on function public.chat_save_my_cover(text) from public,anon;
grant execute on function public.chat_save_my_cover(text) to authenticated;