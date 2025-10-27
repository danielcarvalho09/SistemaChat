import { getPrismaClient } from './src/config/database';
import bcrypt from 'bcrypt';

async function createAdmin() {
  const prisma = getPrismaClient();

  try {
    console.log('🔐 Criando usuário admin...');

    // Hash da senha
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Buscar role admin
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });

    if (!adminRole) {
      console.error('❌ Role admin não encontrada! Execute o seed primeiro.');
      process.exit(1);
    }

    // Criar usuário admin
    const admin = await prisma.user.upsert({
      where: { email: 'admin@admin.com' },
      update: {
        password: hashedPassword,
        name: 'Admin',
        isActive: true,
      },
      create: {
        email: 'admin@admin.com',
        password: hashedPassword,
        name: 'Admin',
        status: 'online',
        isActive: true,
      },
    });

    // Associar role admin
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    });

    // Buscar departamento padrão
    const department = await prisma.department.findFirst();

    if (department) {
      // Associar ao departamento
      await prisma.userDepartmentAccess.upsert({
        where: {
          userId_departmentId: {
            userId: admin.id,
            departmentId: department.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          departmentId: department.id,
        },
      });
    }

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('');
    console.log('📧 Email: admin@admin.com');
    console.log('🔑 Senha: admin123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
    process.exit(1);
  }
}

createAdmin();
