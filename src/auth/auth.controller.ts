import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  HttpCode, 
  HttpStatus, 
  Req, 
  UnauthorizedException,
  InternalServerErrorException 
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      // Garantit que même si le service crash, on renvoie du JSON
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException({
        success: false,
        message: 'Erreur interne du serveur lors de la connexion'
      });
    }
  }

  /**
   * AJOUT : Route pour vérifier l'état de l'authentification
   * Appelé par le useEffect du AuthContext.jsx
   */
  @Get('check')
  @HttpCode(HttpStatus.OK)
  async checkAuth(@Req() req) {
    // Si vous utilisez des cookies, vérifiez ici. 
    // Si vous utilisez des tokens localStorage, cette route renvoie 
    // simplement un indicateur ou est remplacée par 'validate'.
    return { 
      authenticated: false, 
      message: 'Utilisez la route /validate avec le token du localStorage' 
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { 
      success: true,
      message: 'Déconnexion réussie' 
    };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateToken(@Body() body: { token: string }) {
    if (!body.token) {
      throw new UnauthorizedException({
        valid: false,
        message: 'Token manquant'
      });
    }
    return this.authService.validateToken(body.token);
  }
}