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





import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import * as compression from 'compression'

async function bootstrap() {
  // Créer l'app avec des options réduites
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'], // Réduire les logs
    bufferLogs: true,
  })

  // Compression pour réduire la taille des réponses
  app.use(compression())

  // Configuration CORS pour production
  const allowedOrigins = [
    'https://oplaisir-gules.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ]

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        console.warn(`CORS bloqué pour l'origine: ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400, // Cache preflight requests for 24h
  })

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  )

  const port = process.env.PORT || 3000
  await app.listen(port, '0.0.0.0')

  console.log(`🚀 Serveur démarré sur le port ${port}`)
  console.log(`📊 Mémoire: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`)
}

bootstrap()