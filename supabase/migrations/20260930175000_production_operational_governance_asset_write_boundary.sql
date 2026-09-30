-- Asset registration is a governed application action; clients do not write the table directly.
revoke insert,update,delete on public.assets from anon,authenticated;
