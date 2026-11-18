import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors';
import { SocketIoAdapter } from './realtime/socket-io.adapter';

async function bootstrap() {
  // rawBody: BOG's payment callback is signed over the exact request bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Orders carry the design's print-ready PNG and layers (several MB).
  app.useBodyParser('json', { limit: '30mb' });

  // Don't advertise the framework; basic hardening headers on every answer.
  app.disable('x-powered-by');
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors(buildCorsOptions());
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  // Bind to 0.0.0.0 so Render can route traffic to the container.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
