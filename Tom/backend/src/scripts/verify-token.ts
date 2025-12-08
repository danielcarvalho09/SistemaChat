import { PrismaClient } from '@prisma/client';
import { verifyAccessToken, decodeToken } from '../utils/jwt.js';

const prisma = new PrismaClient();

async function verifyToken() {
  const token = process.argv[2];

  if (!token) {
    console.error('❌ Uso: npm run verify-token <token>');
    console.error('   Ou: node dist/scripts/verify-token.js <token>');
    process.exit(1);
  }

  try {
    console.log('🔍 Verificando token...\n');

    // Decodificar sem verificar (para ver conteúdo mesmo se expirado)
    const decoded = decodeToken(token);
    console.log('📋 Conteúdo do token (decodificado):');
    console.log(JSON.stringify(decoded, null, 2));
    console.log('\n');

    // Verificar se é válido
    try {
      const verified = verifyAccessToken(token);
      console.log('✅ Token é válido!');
      console.log('📋 Dados verificados:');
      console.log(`   UserId: ${verified.userId}`);
      console.log(`   Email: ${verified.email}`);
      console.log(`   Roles: ${JSON.stringify(verified.roles)}`);
      console.log(`   Roles é array: ${Array.isArray(verified.roles)}`);
      console.log(`   Tem admin: ${Array.isArray(verified.roles) ? verified.roles.includes('admin') : false}`);
      console.log('\n');

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
        console.log('👤 Usuário no banco:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Nome: ${user.name}`);
        console.log(`   Ativo: ${user.isActive}`);
        console.log(`   Roles no banco: ${user.roles.map(ur => ur.role.name).join(', ')}`);
        console.log(`   Tem admin no banco: ${user.roles.some(ur => ur.role.name === 'admin')}`);
      } else {
        console.log('❌ Usuário não encontrado no banco!');
      }
    } catch (verifyError: any) {
      console.log('❌ Token inválido ou expirado:');
      console.log(`   Erro: ${verifyError.message}`);
    }
  } catch (error: any) {
    console.error('❌ Erro ao processar token:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyToken();

