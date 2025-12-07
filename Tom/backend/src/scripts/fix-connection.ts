
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixConnection() {
    try {
        console.log('🔧 Fixing connection status...');

        // Buscar a conexão desconectada
        const conn = await prisma.whatsAppConnection.findFirst();

        if (conn) {
            console.log(`Found connection: ${conn.name} (${conn.id}) - Status: ${conn.status}`);

            await prisma.whatsAppConnection.update({
                where: { id: conn.id },
                data: { status: 'connected', lastConnected: new Date() }
            });

            console.log('✅ Updated status to CONNECTED');
        } else {
            console.log('❌ No connections found');
        }

    } catch (error) {
        console.error('❌ Error fixing connection:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixConnection();
