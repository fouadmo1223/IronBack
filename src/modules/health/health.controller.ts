import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { Public, ResponseMessage } from '../../common';
import { AppConfig } from '../../config/configuration';

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
