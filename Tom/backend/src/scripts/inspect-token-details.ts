import { getPrismaClient } from '../config/database.js';
import { verifyAccessToken, decodeToken } from '../utils/jwt.js';

const prisma = getPrismaClient();

async function inspectToken() {
  try {
    // Pegar token do argumento da linha de comando
    const token = process.argv[2];
    
    if (!token) {
      console.log('❌ Por favor, forneça um token como argumento:');
      console.log('   npx tsx src/scripts/inspect-token-details.ts <seu-token>');
      console.log('\n💡 Para obter o token:');
      console.log('   1. Abra o DevTools do navegador (F12)');
      console.log('   2. Vá em Application > Local Storage');
      console.log('   3. Procure por "accessToken" ou "token"');
      console.log('   4. Copie o valor e cole aqui');
      process.exit(1);
    }

    console.log('🔍 Analisando token...\n');

    // Decodificar sem verificar (para ver o conteúdo)
    const decoded = decodeToken(token);
    if (!decoded) {
      console.log('❌ Não foi possível decodificar o token');
      process.exit(1);
    }

    console.log('📋 Conteúdo do token (decodificado):');
    console.log(JSON.stringify(decoded, null, 2));
    console.log('');

    // Verificar se o token é válido
    try {
      const verified = verifyAccessToken(token);
      console.log('✅ Token é VÁLIDO');
      console.log('📋 Dados verificados:');
      console.log(`   UserId: ${verified.userId}`);
      console.log(`   Email: ${verified.email}`);
      console.log(`   Roles: ${JSON.stringify(verified.roles)}`);
      console.log(`   É Array: ${Array.isArray(verified.roles)}`);
      console.log(`   Tem 'admin': ${verified.roles?.includes('admin') ? '✅ SIM' : '❌ NÃO'}`);
      console.log('');

      // Buscar usuário no banco
      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (user) {
        console.log('👤 Dados do usuário no banco:');
        console.log(`   Nome: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Status: ${user.isActive ? '✅ Ativo' : '❌ Inativo'}`);
        const dbRoles = user.roles.map(ur => ur.role.name);
        console.log(`   Roles no banco: ${dbRoles.join(', ')}`);
        console.log(`   Tem 'admin' no banco: ${dbRoles.includes('admin') ? '✅ SIM' : '❌ NÃO'}`);
        console.log('');

        // Comparar
        const tokenRoles = Array.isArray(verified.roles) ? verified.roles : [];
        const hasAdminInToken = tokenRoles.includes('admin');
        const hasAdminInDb = dbRoles.includes('admin');

        if (hasAdminInDb && !hasAdminInToken) {
          console.log('⚠️ PROBLEMA ENCONTRADO:');
          console.log('   ✅ Usuário TEM role "admin" no banco');
          console.log('   ❌ Token NÃO contém role "admin"');
          console.log('   💡 Solução: Faça logout e login novamente para gerar um novo token');
        } else if (!hasAdminInDb) {
          console.log('⚠️ PROBLEMA ENCONTRADO:');
          console.log('   ❌ Usuário NÃO TEM role "admin" no banco');
          console.log('   💡 Solução: Adicione a role "admin" ao usuário no banco');
        } else if (hasAdminInToken && hasAdminInDb) {
          console.log('✅ Tudo correto: Token e banco têm role "admin"');
        }
      } else {
        console.log('❌ Usuário não encontrado no banco');
      }
    } catch (error: any) {
      console.log('❌ Token INVÁLIDO ou EXPIRADO');
      console.log(`   Erro: ${error.message}`);
      console.log('');
      console.log('💡 Solução: Faça logout e login novamente');
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

inspectToken();

