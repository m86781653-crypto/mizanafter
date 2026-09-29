BEGIN;
SELECT plan(7);
SELECT ok(EXISTS (SELECT 1 FROM public.mizan_permissions WHERE permission_code='governance.users.manage'),'central governance user-management permission exists');
SELECT ok(EXISTS (SELECT 1 FROM public.mizan_role_permissions WHERE role_code='central_governance' AND permission_code='governance.users.manage'),'central governance receives user-management permission');
SELECT ok(has_function_privilege('anon','private.mizan_can_manage_project_user(uuid)','EXECUTE')=false AND has_function_privilege('authenticated','private.mizan_can_manage_project_user(uuid)','EXECUTE')=false,'project-user authorization helper is not client callable');
SELECT ok(
 pg_get_functiondef('private.mizan_can_manage_project_user(uuid)'::regprocedure) LIKE '%project_manager%'
 AND pg_get_functiondef('private.mizan_can_manage_project_user(uuid)'::regprocedure) LIKE '%meter_reader%'
 AND pg_get_functiondef('private.mizan_can_manage_project_user(uuid)'::regprocedure) LIKE '%collection_officer%'
 AND pg_get_functiondef('private.mizan_can_manage_project_user(uuid)'::regprocedure) LIKE '%operations_maintenance%',
 'authorization helper covers all four canonical operational identities'
);
SELECT ok(
 pg_get_functiondef('private.mizan_can_manage_project_user(uuid)'::regprocedure) ~ 'parent_tenant_id\s*=\s*actor_tenant_id'
 AND pg_get_functiondef('private.mizan_can_manage_project_user(uuid)'::regprocedure) ~ 'target_project\\.status\s*<>\s*''archived''',
 'authorization helper enforces central child-tenant and active-project scope'
);
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND cmd='UPDATE' AND roles @> ARRAY['authenticated']::name[] AND policyname='central_governance_project_users_update'),'central governance receives no direct profile UPDATE policy');
SELECT ok(pg_get_functiondef('private.mizan_can_manage_project_user(uuid)'::regprocedure) ~ 'mizan_user_role\(\)\s*<>\s*''central_governance''','authorization helper rejects non-central actors');
SELECT * FROM finish(); ROLLBACK;