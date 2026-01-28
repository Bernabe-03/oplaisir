
//seed.ts
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Démarrage du seed...')
  
  // Vérifier si l'admin existe déjà
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'oplaisircreation@gmail.com' }
  })
  
  if (!existingAdmin) {
    // Créer l'admin avec mot de passe hashé
    const hashedPassword = await bcrypt.hash('Demo@123', 10)
    
    await prisma.user.create({
      data: {
        email: 'oplaisircreation@gmail.com',
        password: hashedPassword,
        name: 'Administrateur Oplaisir',
        role: 'ADMIN',
        phone: '+225 XX XX XX XX',
        address: 'Zone 4 Bietry, Marcory, Abidjan',
        isActive: true
      }
    })
    
    console.log('✅ Admin créé avec succès')
  } else {
    console.log('✅ Admin existe déjà')
  }
  
  console.log('✅ Seed terminé avec succès')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })