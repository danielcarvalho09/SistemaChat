import { getPrismaClient } from '../src/config/database';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  const prisma = getPrismaClient();

  try {
    // Verificar se já existe um admin
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@admin.com' },
    });

    if (existingAdmin) {
      console.log('✅ Admin já existe!');
      console.log('Email:', existingAdmin.email);
      return;
    }

    // Buscar ou criar role ADMIN
    let adminRole = await prisma.role.findFirst({
      where: { name: 'admin' },
    });

    if (!adminRole) {
      console.log('📝 Criando role ADMIN...');
      adminRole = await prisma.role.create({
        data: {
          name: 'admin',
          description: 'Administrador do sistema',
        },
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Criar usuário admin com role
    const admin = await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@admin.com',
        password: hashedPassword,
        isActive: true,
        roles: {
          create: {
            roleId: adminRole.id,
          },
        },
      },
    });

    console.log('');
    console.log('✅ Usuário admin criado com sucesso!');
    console.log('');
    console.log('📧 Email: admin@admin.com');
    console.log('🔑 Senha: admin123');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    console.log('');
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
