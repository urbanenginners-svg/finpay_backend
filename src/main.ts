import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as Sentry from "@sentry/node";
import { createSwagger } from "src/services/swagger";
import { AppConfigService } from "./services/env/env.service";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { AppModule } from "./app/app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: true,
  });

  // Default Express JSON/urlencoded limit is ~100kb; larger API payloads return 413.
  // useBodyParser respects rawBody (e.g. Razorpay webhooks) unlike ad‑hoc express.json().
  app.useBodyParser("json", { limit: "20mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "20mb" });

  const configService = app.get(AppConfigService);

  app.enableCors();

  app.setGlobalPrefix("api", {
    exclude: ["/"],
  });

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  Sentry.init({
    environment: configService.get("NODE_ENV"),
    dsn: configService.get("SENTRY_DSN"),
    tracesSampleRate: 1.0,
  });

  createSwagger(app);

  await app.listen(configService.get("PORT") ?? 3300);

  // Raise the Node.js keep-alive and headers timeout above the default 5 s so
  // heavy bulk uploads (e.g. 150+ consignment items) don't get silently dropped
  // by the HTTP layer before the request handler finishes.
  const httpServer = app.getHttpServer();
  httpServer.keepAliveTimeout = 120_000;  // 2 min
  httpServer.headersTimeout  = 125_000;  // must be > keepAliveTimeout
}
bootstrap();
