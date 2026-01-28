import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator'

export class RegisterDto {
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string

  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom est requis' })
  name: string

  @IsString({ message: 'Le rôle doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le rôle est requis' })
  role: string

  @IsOptional()
  @IsString({ message: 'Le téléphone doit être une chaîne de caractères' })
  phone?: string

  @IsOptional()
  @IsString({ message: 'L\'adresse doit être une chaîne de caractères' })
  address?: string
}