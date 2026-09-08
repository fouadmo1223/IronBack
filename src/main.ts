import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService) as ConfigService<AppConfig, true>;
  const apiPrefix = config.get('apiPrefix', { infer: true });
  const port = config.get('port', { infer: true });
  const isProd = config.get('isProduction', { infer: true });

  app.setGlobalPrefix(apiPrefix);
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = [
    config.get('urls.frontend', { infer: true }),
    config.get('urls.dashboard', { infer: true }),
    ...(process.env.EXTRA_CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ];
  // In dev, also accept any localhost / 127.0.0.1 port (Next alt port, LAN previews, etc.).
  const devOriginRe = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || (!isProd && devOriginRe.test(origin))) {
        cb(null, true);
      } else {
        cb(new Error(`Origin ${origin} not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('IRON GYM API')
      .setDescription('Membership, payments, access control, CMS and reporting API.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();
  await app.listen(port);

  const url = await app.getUrl();
  // eslint-disable-next-line no-console
  console.log(`\n  IRON GYM API  →  ${url}/${apiPrefix}`);
  if (!isProd) console.log(`  Swagger       →  ${url}/${apiPrefix}/docs\n`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('\n✖ IRON GYM API failed to start:\n', err?.message ?? err);
  if (String(err?.message ?? err).includes('whitelist') || String(err).includes('ENOTFOUND')) {
    // eslint-disable-next-line no-console
    console.error(
      '\n  → MongoDB is unreachable. Add this machine\'s IP to the Atlas Network Access\n' +
        '    allowlist (or use 0.0.0.0/0 for local dev), or point MONGODB_URI at a local MongoDB.\n',
    );
  }
  process.exit(1);
});
