ALTER TABLE public.rx_staff
  ADD COLUMN IF NOT EXISTS chamber_id uuid REFERENCES public.rx_chambers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.provision_rx_staff(_business_id uuid, _user_id uuid, _email text, _name text, _phone text, _username text, _chamber_id uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _role_id uuid;
begin
  if not exists (
    select 1 from public.business_users
    where business_id = _business_id
      and user_id = auth.uid()
      and is_active = true
  ) then
    raise exception 'You are not a member of this business';
  end if;

  if _chamber_id is not null and not exists (
    select 1 from public.rx_chambers where id = _chamber_id and business_id = _business_id
  ) then
    raise exception 'Invalid location for this business';
  end if;

  insert into public.profiles (id, email, first_name)
  values (_user_id, _email, _name)
  on conflict (id) do update set email = excluded.email, first_name = excluded.first_name;

  insert into public.business_users (business_id, user_id, access_all_locations, is_active)
  values (_business_id, _user_id, true, true)
  on conflict (business_id, user_id) do update set is_active = true;

  select id into _role_id
  from public.roles
  where business_id = _business_id and name ilike 'Assistant'
  limit 1;

  if _role_id is null then
    insert into public.roles (business_id, name, is_default, allowed_sections)
    values (_business_id, 'Assistant', false, array['rx-queue'])
    returning id into _role_id;
  end if;

  delete from public.user_roles where user_id = _user_id and business_id = _business_id;

  insert into public.user_roles (user_id, role_id, business_id, allowed_sections)
  values (_user_id, _role_id, _business_id, array['rx-queue']);

  insert into public.rx_staff (business_id, doctor_id, user_id, name, phone, username, is_active, chamber_id)
  values (_business_id, auth.uid(), _user_id, _name, nullif(_phone, ''), _username, true, _chamber_id)
  on conflict (business_id, username) do update
    set name = excluded.name,
        phone = excluded.phone,
        user_id = excluded.user_id,
        chamber_id = excluded.chamber_id,
        is_active = true;
end;
$function$;