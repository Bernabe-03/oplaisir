import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from './shared/prisma/prisma.service'

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    console.log('🔌 Initialisation du service App...')
    console.log(`🌍 Environnement: ${process.env.NODE_ENV}`)
    console.log(`🔑 JWT Secret configuré: ${process.env.JWT_SECRET ? 'Oui' : 'Non'}`)
    console.log(`🗄️  Base de données: ${process.env.DATABASE_URL ? 'Configurée' : 'Non configurée'}`)
  }

  getHello(): string {
    return 'Bienvenue sur l\'API Oplaisir Boutique'
  }

  async testDatabaseConnection() {
    try {
      const users = await this.prisma.user.findMany({
        take: 10,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLogin: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return users
    } catch (error) {
      console.error('❌ Erreur de connexion à la base de données:', error.message)
      throw error
    }
  }

  getSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
      },
      uptime: `${Math.round(process.uptime())} secondes`,
      environment: process.env.NODE_ENV
    }
  }
}