DROP POLICY IF EXISTS tenant_self_read ON public.tenants;

CREATE POLICY tenant_self_read ON public.tenants
FOR SELECT TO authenticated
USING (
  id = (SELECT private.mizan_user_tenant_id())
  OR (
    parent_tenant_id = (SELECT private.mizan_user_tenant_id())
    AND tenant_type = 'sub_tenant'
  )
  OR (SELECT private.mizan_is_platform_admin())
);
