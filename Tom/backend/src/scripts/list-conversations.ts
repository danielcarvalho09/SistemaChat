import { getPrismaClient } from '../config/database.js';

async function listConversations() {
    const prisma = getPrismaClient();

    console.log('📋 Listing all conversations...\n');

    const conversations = await prisma.conversation.findMany({
        include: {
            contact: true,
            connection: true,
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 20
    });

    console.log(`Found ${conversations.length} conversations:\n`);

    conversations.forEach((conv, index) => {
        console.log(`${index + 1}. ${conv.contact.name || 'No name'}`);
        console.log(`   Phone: ${conv.contact.phoneNumber}`);
        console.log(`   Status: ${conv.status}`);
        console.log(`   Connection: ${conv.connection.name}`);
        console.log(`   Last Message: ${conv.lastMessageAt.toISOString()}`);
        console.log('');
    });

    // Also search for numbers containing '889'
    console.log('\n🔍 Searching for numbers containing "889"...\n');
    const contacts889 = await prisma.contact.findMany({
        where: {
            phoneNumber: { contains: '889' }
        },
        include: {
            conversations: {
                include: { connection: true },
                orderBy: { lastMessageAt: 'desc' },
                take: 1
            }
        }
    });

    if (contacts889.length > 0) {
        console.log(`Found ${contacts889.length} contacts with "889":\n`);
        contacts889.forEach((contact, index) => {
            console.log(`${index + 1}. ${contact.name || 'No name'} - ${contact.phoneNumber}`);
            if (contact.conversations.length > 0) {
                console.log(`   Has conversation (status: ${contact.conversations[0].status})`);
            }
        });
    } else {
        console.log('No contacts found with "889"');
    }
}

listConversations()
    .catch(e => console.error('Error:', e))
    .finally(() => process.exit(0));
