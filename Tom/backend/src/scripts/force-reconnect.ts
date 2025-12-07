
import { getPrismaClient } from '../config/database';
import { baileysManager } from '../whatsapp/baileys.manager';
import { logger } from '../config/logger';

async function forceReconnect() {
    const prisma = getPrismaClient();

    // Pegar a primeira conexão
    const connection = await prisma.whatsAppConnection.findFirst();

    if (!connection) {
        console.log('❌ No connection found to reconnect');
        return;
    }

    console.log(`🔄 Attempting to reconnect: ${connection.name} (${connection.id})`);

    try {
        // Forçar status connecting no banco primeiro
        await prisma.whatsAppConnection.update({
            where: { id: connection.id },
            data: { status: 'connecting' }
        });

        const result = await baileysManager.createClient(connection.id);
        console.log(`✅ CreateClient result:`, result.status);
        console.log(`✅ System should be connecting now...`);
    } catch (error) {
        console.error('❌ Reconnection failed:', error);
    }
}

forceReconnect()
    .catch(e => console.error(e))
    .finally(() => setTimeout(() => process.exit(0), 5000)); // Wait a bit for logs
