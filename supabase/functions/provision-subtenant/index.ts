import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    if (!ctx.userClaims?.sub) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    return Response.json({ error: 'SERVICE_ROLE_PROVISIONING_DISABLED' }, { status: 410 });
  }),
};
