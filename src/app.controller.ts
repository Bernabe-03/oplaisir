import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApiInfo() {
    return {
      message: 'API Oplaisir Boutique',
      version: '1.0.0',
      description: 'Backend pour la gestion de la boutique Oplaisir',
      endpoints: {
        auth: {
          login: { method: 'POST', path: '/api/auth/login', description: 'Authentification utilisateur' },
          validate: { method: 'POST', path: '/api/auth/validate', description: 'Validation du token JWT' },
          logout: { method: 'POST', path: '/api/auth/logout', description: 'Déconnexion' }
        },
        users: {
          profile: { method: 'GET', path: '/api/users/profile', description: 'Profil utilisateur' },
          list: { method: 'GET', path: '/api/users', description: 'Liste des utilisateurs (admin seulement)' }
        },
        products: {
          list: { method: 'GET', path: '/api/products', description: 'Liste des produits' },
          create: { method: 'POST', path: '/api/products', description: 'Créer un produit' }
        },
        coffrets: {
          list: { method: 'GET', path: '/api/coffrets', description: 'Liste des coffrets' },
          create: { method: 'POST', path: '/api/coffrets', description: 'Créer un coffret' }
        }
      },
      documentation: 'Consultez la documentation pour plus de détails',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'healthy',
      service: 'oplaisir-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'PostgreSQL',
      version: process.version
    }
  }

  @Get('status')
  getStatus() {
    return {
      api: 'running',
      port: process.env.PORT || 3000,
      cors: {
        origins: ['http://localhost:5173', 'http://localhost:3000'],
        enabled: true
      },
      authentication: 'JWT enabled',
      database: 'connected via Prisma'
    }
  }
}