import { Injectable, UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { LoginDto } from './dto/login.dto'
import { PrismaService } from '../shared/prisma/prisma.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Recherche de l'utilisateur
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        this.logger.warn(`Tentative de connexion échouée : ${normalizedEmail} (Non trouvé)`);
        throw new UnauthorizedException('Identifiants incorrects');
      }

      // 2. Vérification de l'état du compte
      if (!user.isActive) {
        this.logger.warn(`Tentative de connexion : ${normalizedEmail} (Compte inactif)`);
        throw new UnauthorizedException('Ce compte est désactivé');
      }

      // 3. Vérification du mot de passe
      // Note: bcrypt.compare renvoie false si user.password n'est pas un hash valide
      const isPasswordValid = await bcrypt.compare(password, user.password).catch(() => false);
      
      if (!isPasswordValid) {
        this.logger.warn(`Tentative de connexion échouée : ${normalizedEmail} (Mot de passe incorrect)`);
        throw new UnauthorizedException('Identifiants incorrects');
      }

      // 4. Mise à jour de la dernière connexion (Optionnel, ne doit pas bloquer le login)
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      }).catch(err => this.logger.error("Erreur update lastLogin", err));

      // 5. Génération du Token JWT
      // C'est ici que l'erreur 500 arrive souvent si JWT_SECRET est vide
      const payload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      const token = this.jwtService.sign(payload);

      return {
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
        },
        token,
      };

    } catch (error) {
      // Si c'est déjà une UnauthorizedException, on la relance
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Sinon, on log l'erreur réelle pour le développeur et on renvoie du JSON (pas du HTML)
      this.logger.error(`CRITICAL LOGIN ERROR: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        success: false,
        message: 'Une erreur technique est survenue sur le serveur.',
        error: error.message
      });
    }
  }

  async validateToken(token: string) {
    try {
      if (!token) throw new Error('Token manquant');

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return { valid: false, error: 'Utilisateur non trouvé ou inactif' };
      }

      return { valid: true, user };
    } catch (error) {
      return {
        valid: false,
        error: 'Token invalide ou expiré',
      };
    }
  }
}