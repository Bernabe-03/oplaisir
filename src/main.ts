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

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Configuration CORS pour production
  const allowedOrigins = [
    'https://oplaisir-gules.vercel.app', // Votre frontend Vercel
    'http://localhost:5173', // Pour développement local
    'http://localhost:3000', // Pour développement local
  ]

  app.enableCors({
    origin: (origin, callback) => {
      // Permettre les requêtes sans origine (comme les apps mobile ou curl)
      if (!origin) return callback(null, true)
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        console.warn(`CORS bloqué pour l'origine: ${origin}`)
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Refresh-Token',
      'Accept',
      'Origin',
      'X-Requested-With'
    ],
    exposedHeaders: ['Authorization']
  })

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    })
  )

  const port = process.env.PORT || 3000
  await app.listen(port, '0.0.0.0')

  console.log(`🚀 Serveur démarré sur le port ${port}`)
  console.log(`🌐 Environnement: ${process.env.NODE_ENV || 'development'}`)
  console.log(`✅ CORS configuré pour les origines suivantes:`)
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`))
}

bootstrap()
