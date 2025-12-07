
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMessages() {
    try {
        console.log('🔍 Checking recent messages in database...');

        // Buscar últimas 5 mensagens
        const messages = await prisma.message.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                conversation: {
                    select: {
                        id: true,
                        contactId: true,
                        status: true
                    }
                }
            }
        });

        console.log(`✅ Found ${messages.length} messages:`);
        messages.forEach(msg => {
            console.log(`- [${msg.createdAt.toISOString()}] ${msg.messageType}: ${msg.content.substring(0, 50)} (Status: ${msg.status})`);
        });

        // Buscar conexões ativas
        const connections = await prisma.whatsAppConnection.findMany();
        console.log(`\n🔍 Active Connections: ${connections.length}`);
        connections.forEach(conn => {
            console.log(`- ${conn.name}: ${conn.status} (Last seen: ${conn.lastSeenAt})`);
        });

    } catch (error) {
        console.error('❌ Error checking messages:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMessages();
