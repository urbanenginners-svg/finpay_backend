import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AppConfigService, EnvironmentVariables } from './env.service';

function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      validate,
      isGlobal: true,
      cache: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_CONNECTION_STRING'),

        connectionFactory: (connection) => {
          console.log('MongoDB connected successfully');

          connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
          });

          connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
          });

          return connection;
        },
      }),
      inject: [ConfigService],
    })
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule { }
