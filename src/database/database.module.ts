import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfig } from '../config/configuration';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { SequenceService } from './sequence.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Counter.name, schema: CounterSchema }]),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const logger = new Logger('Mongoose');
        return {
          uri: config.get('database.uri', { infer: true }),
          autoIndex: !config.get('isProduction', { infer: true }),
          // Fail fast with a clear message instead of hanging the whole boot.
          serverSelectionTimeoutMS: 10000,
          connectionFactory: (connection) => {
            connection.on('connected', () => logger.log('MongoDB connection established'));
            connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
            connection.on('error', (err: Error) => logger.error(`MongoDB error: ${err.message}`));
            return connection;
          },
        };
      },
    }),
  ],
  providers: [SequenceService],
  exports: [SequenceService, MongooseModule],
})
export class DatabaseModule {}
