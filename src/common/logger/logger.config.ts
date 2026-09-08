import { Params } from 'nestjs-pino';

/** Structured request logging via pino; pretty in dev, JSON in prod. */
export function buildLoggerConfig(opts: { logLevel: string; isProduction: boolean }): Params {
  return {
    pinoHttp: {
      level: opts.logLevel,
      transport: opts.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.refreshToken',
        ],
        remove: true,
      },
      autoLogging: {
        ignore: (req) => req.url === '/api/v1/health' || req.url === '/health',
      },
      customProps: () => ({ context: 'HTTP' }),
    },
  };
}
