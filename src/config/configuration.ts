/**
 * Namespaced, typed view over the validated environment. Inject via
 * `ConfigService<AppConfig, true>` and read with `config.get('jwt.secret', { infer: true })`.
 */
export interface AppConfig {
  env: string;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  logLevel: string;
  urls: {
    frontend: string;
    dashboard: string;
  };
  database: {
    uri: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
    passwordResetExpiresIn: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    folderRoot: string;
    enabled: boolean;
  };
  business: {
    expiringSoonThresholdDays: number;
    duplicateCheckinWindowSeconds: number;
    memberCodePrefix: string;
  };
  throttle: {
    ttlSeconds: number;
    limit: number;
  };
  seed: {
    defaultPassword: string;
  };
}

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  return {
    env,
    isProduction: env === 'production',
    port: Number(process.env.PORT ?? 4000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    urls: {
      frontend: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      dashboard: process.env.DASHBOARD_URL ?? 'http://localhost:5173',
    },
    database: {
      uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/iron_gym',
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? '',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
      passwordResetExpiresIn: process.env.PASSWORD_RESET_EXPIRES_IN ?? '1h',
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
      folderRoot: process.env.CLOUDINARY_FOLDER_ROOT ?? 'iron-gym',
      enabled: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET,
      ),
    },
    business: {
      expiringSoonThresholdDays: Number(process.env.EXPIRING_SOON_THRESHOLD_DAYS ?? 7),
      duplicateCheckinWindowSeconds: Number(process.env.DUPLICATE_CHECKIN_WINDOW_SECONDS ?? 120),
      memberCodePrefix: process.env.MEMBER_CODE_PREFIX ?? 'IRON',
    },
    throttle: {
      ttlSeconds: Number(process.env.THROTTLE_TTL_SECONDS ?? 60),
      limit: Number(process.env.THROTTLE_LIMIT ?? 120),
    },
    seed: {
      defaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? 'Passw0rd!2024',
    },
  };
};
