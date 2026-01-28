// import { NestFactory } from '@nestjs/core'
// import { AppModule } from './app.module'
// import { ValidationPipe } from '@nestjs/common'

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule)

//   app.enableCors({
//     origin: ['http://localhost:5173', 'http://localhost:3000'],
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//     allowedHeaders: [
//       'Content-Type',
//       'Authorization',
//       'X-Refresh-Token',
//       'Accept',
//       'Origin',
//       'X-Requested-With'
//     ],
//     exposedHeaders: ['Authorization']
//   })

//   app.setGlobalPrefix('api')

//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       transform: true,
//       forbidNonWhitelisted: false
//     })
//   )

//   const port = process.env.PORT || 3000
//   await app.listen(port)

//   console.log(`🚀 Serveur démarré sur http://localhost:${port}`)
//   console.log(`🌐 CORS configuré pour: http://localhost:5173`)
// }

// bootstrap()





import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression'; // ✅ correction
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'], // logs légers pour Render
    bufferLogs: true,
  });

  /* ------------------ Sécurité & perf ------------------ */
  app.use(helmet());
  app.use(compression()); // ✅ fonctionne maintenant

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

