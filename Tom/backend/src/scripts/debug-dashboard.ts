
import { getPrismaClient } from '../config/database.js';

async function debugDashboard() {
    const prisma = getPrismaClient();

    try {
        console.log('🔄 Testando query de conversas por status...');
        const conversationsByStatus = await prisma.conversation.groupBy({
            by: ['status'],
            _count: {
                status: true,
            },
        });
        console.log('✅ Query conversas:', JSON.stringify(conversationsByStatus, null, 2));

        console.log('🔄 Testando counts simples...');
        const users = await prisma.user.count();
        console.log('✅ Users:', users);

        // Verificando se as tabelas existem e são acessíveis
        // As vezes o nome da model no Prisma é diferente
        const depts = await prisma.department.count();
        console.log('✅ Depts:', depts);

        // O erro pode ser aqui se o nome da tabela no schema for diferente
        // Vou checar o schema.prisma se falhar
        // const connections = await prisma.connection.count(); 
        // ^ Se falhar, é WhatsAppConnection ou algo do tipo

    } catch (error) {
        console.error('❌ Erro no debug:', error);
    }
}

debugDashboard();
