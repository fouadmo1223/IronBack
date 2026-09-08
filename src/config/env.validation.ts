import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Strongly-typed schema for process.env. Validated once at boot; the app
 * refuses to start with an invalid or incomplete configuration.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  PORT = 4000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX = 'api/v1';

  @IsString()
  @IsOptional()
  LOG_LEVEL = 'info';

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL!: string;

  @IsString()
  @IsNotEmpty()
  DASHBOARD_URL!: string;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsString()
  @MinLength(24)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN = '15m';

  @IsString()
  @MinLength(24)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN = '30d';

  @IsString()
  @IsNotEmpty()
  PASSWORD_RESET_EXPIRES_IN = '1h';

  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET = '';

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_FOLDER_ROOT = 'iron-gym';

  @IsInt()
  EXPIRING_SOON_THRESHOLD_DAYS = 7;

  @IsInt()
  DUPLICATE_CHECKIN_WINDOW_SECONDS = 120;

  @IsString()
  @IsNotEmpty()
  MEMBER_CODE_PREFIX = 'IRON';

  @IsInt()
  THROTTLE_TTL_SECONDS = 60;

  @IsInt()
  THROTTLE_LIMIT = 120;

  @IsString()
  @IsOptional()
  SEED_DEFAULT_PASSWORD = 'Passw0rd!2024';
}

const NUMERIC_KEYS = new Set([
  'PORT',
  'EXPIRING_SOON_THRESHOLD_DAYS',
  'DUPLICATE_CHECKIN_WINDOW_SECONDS',
  'THROTTLE_TTL_SECONDS',
  'THROTTLE_LIMIT',
]);

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const coerced: Record<string, unknown> = { ...config };
  for (const key of NUMERIC_KEYS) {
    if (coerced[key] !== undefined && coerced[key] !== '') {
      coerced[key] = Number(coerced[key]);
    }
  }

  const validated = plainToInstance(EnvironmentVariables, coerced, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return validated;
}
