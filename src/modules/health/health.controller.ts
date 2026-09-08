import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { Public, ResponseMessage } from '../../common';
import { AppConfig } from '../../config/configuration';

/** API root — a friendly landing response instead of a bare 404. */
@ApiExcludeController()
@Controller()
export class RootController {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Get()
  @Public()
  @ResponseMessage('IRON GYM API')
  root() {
    return {
      name: 'IRON GYM API',
      status: 'online',
      env: this.config.get('env', { infer: true }),
      docs: this.config.get('isProduction', { infer: true })
        ? null
        : `/${this.config.get('apiPrefix', { infer: true })}/docs`,
      health: `/${this.config.get('apiPrefix', { infer: true })}/health`,
      timestamp: new Date().toISOString(),
    };
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Get()
  @Public()
  @ResponseMessage('Service is healthy')
  check() {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    return {
      status: 'ok',
      env: this.config.get('env', { infer: true }),
      uptimeSeconds: Math.round(process.uptime()),
      database: states[this.connection.readyState] ?? 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
