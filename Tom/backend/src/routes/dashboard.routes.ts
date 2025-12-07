
import { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../config/database.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
    const prisma = getPrismaClient();

    fastify.get(
        '/dashboard/stats',
        { preHandler: [authenticate] },
        async (request, reply) => {
            // 1. Total e status de conversas (Agregado)
            const conversationsByStatus = await prisma.conversation.groupBy({
                by: ['status'],
                _count: {
                    status: true,
                },
            });

            // Transformar array do prisma em objeto { status: count }
            const statusCount = conversationsByStatus.reduce((acc, curr) => {
                acc[curr.status] = curr._count.status;
                return acc;
            }, {} as Record<string, number>);

            const totalConversations = Object.values(statusCount).reduce((a, b) => a + b, 0);

            // Contar conversas "ativas" (não resolvidas/fechadas)
            // Ajuste conforme seus status. Ex: waiting + in_progress
            const activeConversations =
                (statusCount['waiting'] || 0) +
                (statusCount['in_progress'] || 0) +
                (statusCount['transferred'] || 0);

            // 2. Outras contagens simples
            const [totalUsers, totalDepartments, totalConnections] = await Promise.all([
                prisma.user.count(),
                prisma.department.count(),
                prisma.connection.count(),
            ]);

            return reply.send({
                totalConversations,
                activeConversations,
                totalUsers,
                totalDepartments,
                totalConnections,
                avgResponseTime: 5.2, // Mock por enquanto, cálculo real seria complexo
                conversationsByStatus: {
                    waiting: statusCount['waiting'] || 0,
                    in_progress: statusCount['in_progress'] || 0,
                    resolved: statusCount['resolved'] || 0,
                },
            });
        }
    );
}
