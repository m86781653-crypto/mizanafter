import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    if (!ctx.userClaims?.sub) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    return Response.json({
      error: 'LEGACY_SERVICE_ROLE_PATH_DISABLED',
      message: 'هذا المسار القديم متوقف. يستخدم النظام المسارات المقيدة بـRLS وRPC وAuth المباشر.',
    }, { status: 410 });
  }),
};