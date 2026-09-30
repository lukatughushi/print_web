const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (config.NODE_ENV === 'production' && String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  return config;
}
