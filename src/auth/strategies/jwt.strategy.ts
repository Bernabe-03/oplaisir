// import { Injectable, UnauthorizedException } from '@nestjs/common'
// import { PassportStrategy } from '@nestjs/passport'
// import { ExtractJwt, Strategy } from 'passport-jwt'
// import { PrismaService } from '../../shared/prisma/prisma.service'

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor(private readonly prisma: PrismaService) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
//     })
//   }

//   async validate(payload: any) {
//     const user = await this.prisma.user.findUnique({
//       where: { id: payload.sub },
//       select: {
//         id: true,
//         email: true,
//         name: true,
//         role: true,
//         isActive: true,
//       },
//     })

//     if (!user || !user.isActive) {
//       throw new UnauthorizedException('Utilisateur non trouvé ou inactif')
//     }

//     return user
//   }
// }



import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('❌ JWT_SECRET is not defined in environment variables');
    }
    console.log('🔐 JWT strategy using secret (first 4 chars):', secret.slice(0, 4));
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non trouvé ou inactif');
    }

    return user;
  }
}