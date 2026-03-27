// import { Module } from '@nestjs/common';
// import { JwtModule } from '@nestjs/jwt';
// import { PassportModule } from '@nestjs/passport';
// import { ConfigModule, ConfigService } from '@nestjs/config'; // Importez ConfigService
// import { AuthController } from './auth.controller';
// import { AuthService } from './auth.service';
// import { JwtStrategy } from './strategies/jwt.strategy';
// import { UsersModule } from '../users/users.module';
// import { PrismaModule } from '../shared/prisma/prisma.module';

// @Module({
//   imports: [
//     PrismaModule,
//     UsersModule,
//     PassportModule.register({ defaultStrategy: 'jwt' }),
//     // Utilisation de registerAsync pour garantir que .env est bien chargé
//     JwtModule.registerAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: async (configService: ConfigService) => ({
//         secret: configService.get<string>('JWT_SECRET') || 'fallback-secret-key',
//         signOptions: { 
//           expiresIn: '24h',
//           algorithm: 'HS256' 
//         },
//       }),
//     }),
//   ],
//   controllers: [AuthController],
//   providers: [AuthService, JwtStrategy],
//   exports: [AuthService, JwtStrategy, PassportModule, JwtModule],
// })
// export class AuthModule {}



import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../shared/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('❌ JWT_SECRET is not defined in environment variables');
        }
        console.log('🔐 JWT secret loaded (first 4 chars):', secret.slice(0, 4));
        return {
          secret,
          signOptions: {
            expiresIn: '24h',
            algorithm: 'HS256',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}