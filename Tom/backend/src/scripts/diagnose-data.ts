
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
    try {
        console.log('🔍 Diagnosing Data...');

        // Check User
        const user = await prisma.user.findUnique({
            where: { email: 'admin@admin.com' },
            include: { roles: { include: { role: true } } }
        });
        console.log('User:', JSON.stringify(user, null, 2));

        // Check Conversations
        const convCount = await prisma.conversation.count();
        console.log('Total Conversations in DB:', convCount);

        if (convCount > 0) {
            const firstConv = await prisma.conversation.findFirst();
            console.log('Sample Conversation:', JSON.stringify(firstConv, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();
