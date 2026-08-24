CREATE OR REPLACE FUNCTION public.deactivate_rx_staff(_staff_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _biz uuid;
  _uid uuid;
begin
  select business_id, user_id into _biz, _uid from public.rx_staff where id = _staff_id;
  if _biz is null then
    -- Already removed (e.g. stale list / double click): treat as success.
    return;
  end if;

  if not exists (
    select 1 from public.business_users
    where business_id = _biz and user_id = auth.uid() and is_active = true
  ) then
    raise exception 'You are not a member of this business';
  end if;

  if _uid is not null then
    update public.business_users set is_active = false
      where business_id = _biz and user_id = _uid;
    delete from public.user_roles where business_id = _biz and user_id = _uid;
  end if;

  delete from public.rx_staff where id = _staff_id;
end;
$function$;