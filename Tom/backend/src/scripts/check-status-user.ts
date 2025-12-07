
import { getPrismaClient } from '../config/database';

async function checkStatus() {
    const prisma = getPrismaClient();

    console.log('🔍 Checking Connections...');
    const connections = await prisma.whatsAppConnection.findMany();

    if (connections.length === 0) {
        console.log('❌ No connections found!');
    } else {
        connections.forEach(c => {
            console.log(`📱 Connection: ${c.name} (${c.phoneNumber})`);
            console.log(`   Status: ${c.status}`);
            console.log(`   Has AuthData: ${!!c.authData && c.authData.length > 50}`);
            console.log(`   Detailed AuthData check:`);
            if (c.authData) {
                try {
                    const parsed = JSON.parse(c.authData);
                    console.log(`     - Has creds: ${!!parsed.creds}`);
                    console.log(`     - Has me.id: ${!!parsed.creds?.me?.id}`);
                } catch (e) {
                    console.log(`     - AuthData is invalid JSON`);
                }
            }
        });
    }

    console.log('\n🔍 Checking Conversation with 8898131260...');
    const conversation = await prisma.conversation.findFirst({
        where: {
            OR: [
                { contact: { phoneNumber: { contains: '8898131260' } } },
                { contact: { name: { contains: '8898131260' } } } // Just in case
            ]
        },
        include: { contact: true }
    });

    if (conversation) {
        console.log(`✅ Conversation found: ${conversation.id}`);
        console.log(`   Contact: ${conversation.contact.name} (${conversation.contact.phoneNumber})`);
        console.log(`   Status: ${conversation.status}`);
    } else {
        console.log('❌ Conversation not found for 8898131260');
    }
}

checkStatus()
    .catch(e => console.error(e))
    .finally(() => process.exit(0));
