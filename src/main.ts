
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression'; // ✅ correction
import helmet from 'helmet';
import { json, urlencoded } from 'express';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bufferLogs: true,
  });

  /* ------------------ Sécurité & perf ------------------ */
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.use(helmet());
  app.use(compression()); 

  /* ------------------ CORS ------------------ */
  const allowedOrigins = [
    'https://oplaisir-gules.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // mobile / curl
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

  /* ------------------ Port (OBLIGATOIRE pour Render) ------------------ */
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend lancé sur le port ${port}`);
  console.log(
    `📊 Mémoire utilisée: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2,
    )} MB`,
  );
}

bootstrap().catch((err) => {
  console.error('❌ Erreur au démarrage', err);
  process.exit(1);
});

