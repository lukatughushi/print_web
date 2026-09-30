type OriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Origin check shared by the HTTP server and the Socket.IO gateway.
 * Allows the explicit CORS_ORIGINS list plus (optionally) Vercel preview URLs
 * for the project named in VERCEL_PREVIEW_PROJECT.
 */
export function buildOriginCheck(env: NodeJS.ProcessEnv = process.env) {
  const allowed = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const project = env.VERCEL_PREVIEW_PROJECT?.trim();
  const previewPattern = project
    ? new RegExp(`^https://${escapeRegExp(project)}(-[a-z0-9-]+)?\\.vercel\\.app$`)
    : null;

  return (origin: string | undefined, callback: OriginCallback) => {
    // Non-browser clients (curl, server-to-server, health checks) send no Origin.
    if (!origin) return callback(null, true);
    // Disallowed origins get no CORS headers, so the browser blocks the response.
    callback(null, allowed.includes(origin) || !!previewPattern?.test(origin));
  };
}

export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    origin: buildOriginCheck(env),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
