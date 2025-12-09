// Script para configurar setores e conexão matriz
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupDepartments() {
  try {
    console.log('🚀 Iniciando configuração de setores...\n');

    // 1. Marcar conexão existente como Matriz
    console.log('1️⃣ Marcando conexão como Matriz...');
    const updatedConnection = await prisma.$executeRaw`
      UPDATE whatsapp_connections 
      SET "isMatriz" = true 
      WHERE id = 'dfb4ecc9-de67-4f00-96d3-94e22e36c9cc'
    `;
    console.log(`   ✅ Conexão atualizada\n`);

    // 2. Criar setores
    console.log('2️⃣ Criando setores...');
    
    const comercial = await prisma.department.upsert({
      where: { name: 'Comercial' },
      update: {},
      create: {
        name: 'Comercial',
        description: 'Setor comercial e vendas',
        color: '#10B981',
        icon: 'briefcase',
        isActive: true,
      },
    });
    console.log(`   ✅ Setor Comercial: ${comercial.id}`);

    const rh = await prisma.department.upsert({
      where: { name: 'RH' },
      update: {},
      create: {
        name: 'RH',
        description: 'Recursos Humanos',
        color: '#3B82F6',
        icon: 'users',
        isActive: true,
      },
    });
    console.log(`   ✅ Setor RH: ${rh.id}`);

    const recepcao = await prisma.department.upsert({
      where: { name: 'Recepção' },
      update: {},
      create: {
        name: 'Recepção',
        description: 'Atendimento geral e recepção',
        color: '#F59E0B',
        icon: 'phone',
        isActive: true,
      },
    });
    console.log(`   ✅ Setor Recepção: ${recepcao.id}\n`);

    // 3. Buscar usuário Daniel (admin)
    console.log('3️⃣ Adicionando Daniel aos setores...');
    const daniel = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'daniel' } },
          { name: { contains: 'Daniel' } },
        ],
      },
    });

    if (daniel) {
      console.log(`   👤 Usuário encontrado: ${daniel.name} (${daniel.email})`);

      // Adicionar Daniel a todos os setores
      const departments = [comercial, rh, recepcao];
      
      for (const dept of departments) {
        await prisma.userDepartmentAccess.upsert({
          where: {
            userId_departmentId: {
              userId: daniel.id,
              departmentId: dept.id,
            },
          },
          update: {},
          create: {
            userId: daniel.id,
            departmentId: dept.id,
          },
        });
        console.log(`   ✅ Acesso ao setor ${dept.name} concedido`);
      }
    } else {
      console.log('   ⚠️  Usuário Daniel não encontrado');
    }

    // 4. Verificar resultados
    console.log('\n📊 Resumo:');
    
    const connections = await prisma.whatsAppConnection.count();
    const matrizConnections = await prisma.whatsAppConnection.count({
      where: { isMatriz: true },
    });
    console.log(`   Conexões: ${connections} total, ${matrizConnections} matriz`);

    const totalDepts = await prisma.department.count();
    const activeDepts = await prisma.department.count({
      where: { isActive: true },
    });
    console.log(`   Setores: ${totalDepts} total, ${activeDepts} ativos`);

    const userAccess = await prisma.userDepartmentAccess.count();
    const uniqueUsers = await prisma.userDepartmentAccess.groupBy({
      by: ['userId'],
    });
    console.log(`   Usuários com acesso: ${uniqueUsers.length} usuários, ${userAccess} acessos`);

    console.log('\n✅ Configuração concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante configuração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupDepartments()
  .then(() => {
    console.log('\n🎉 Tudo pronto! Reinicie o backend e teste.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha na configuração:', error);
    process.exit(1);
  });
