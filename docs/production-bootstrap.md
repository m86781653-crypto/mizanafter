# MIZAN AI — Production Bootstrap

The production database is intentionally provisioned without a default administrator credential.

## First platform administrator

Create the first Auth user in the Supabase Dashboard using the project's Auth > Users area. Use the operator's real administrative email and a temporary password, then set the user's server-controlled app_metadata through an authenticated provisioning path before granting production access.

Required MIZAN profile scope:
- role: platform_admin
- tenant: the active MIZAN main tenant
- must_change_password: true

Do not use user_metadata for role or tenant authorization.

## After the first administrator exists

Use the deployed provision-user Edge Function for subsequent users. It requires a valid JWT and only allows:
- platform administrators to provision users within active tenant boundaries;
- tenant managers to provision users inside their own tenant.

Authorization is enforced again by the database trigger/RLS layer.

## Important

There is no default admin/admin account and no unauthenticated setup endpoint. The legacy insecure setup-admin function was removed from the repository and is not deployed.
