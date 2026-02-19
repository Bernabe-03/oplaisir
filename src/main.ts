// main.ts - Version corrigée
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';

// Importation correcte pour compression
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bufferLogs: true,
  });

  /* ------------------ Sécurité & perf ------------------ */
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.use(helmet());
  app.use(compression()); // Maintenant ça devrait fonctionner

  /* ------------------ CORS ------------------ */
  const allowedOrigins = [
    'https://oplaisir-gules.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400,
  });

  /* ------------------ WebSocket Adapter ------------------ */
  app.useWebSocketAdapter(new IoAdapter(app));

  /* ------------------ Global config ------------------ */
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  /* ------------------ Port ------------------ */
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend lancé sur le port ${port}`);
  console.log(`🔔 Notifications WebSocket actif sur ws://localhost:${port}/notifications`);
  console.log(`📡 CORS autorisé pour: ${allowedOrigins.join(', ')}`);
  console.log(
    `📊 Mémoire utilisée: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
  );
}

bootstrap().catch((err) => {
  console.error('❌ Erreur au démarrage', err);
  process.exit(1);
});