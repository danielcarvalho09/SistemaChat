import { getPrismaClient } from '../config/database.js';

async function findConversation() {
    const prisma = getPrismaClient();
    const phoneNumber = '88998131260';

    console.log(`🔍 Searching for conversation with number ${phoneNumber}...`);

    // Find contact first
    const contact = await prisma.contact.findFirst({
        where: {
            OR: [
                { phoneNumber: { contains: phoneNumber } },
                { phoneNumber: { contains: phoneNumber.replace(/^55/, '') } },
                { phoneNumber: { endsWith: phoneNumber.slice(-10) } }
            ]
        }
    });

    if (!contact) {
        console.log('❌ Contact not found');
        return;
    }

    console.log(`✅ Contact found: ${contact.name || 'No name'} (${contact.phoneNumber})`);

    // Find conversation
    const conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id },
        include: {
            contact: true,
            connection: true,
            assignedUser: true,
            department: true
        },
        orderBy: { lastMessageAt: 'desc' }
    });

    if (!conversation) {
        console.log('❌ No conversation found for this contact');
        return;
    }

    console.log('\n📋 Conversation Details:');
    console.log('  ID:', conversation.id);
    console.log('  Status:', conversation.status);
    console.log('  Assigned User:', conversation.assignedUser?.name || 'None');
    console.log('  Department:', conversation.department?.name || 'None');
    console.log('  Connection:', conversation.connection.name);
    console.log('  Last Message:', conversation.lastMessageAt);
    console.log('  Unread Count:', conversation.unreadCount);
}

findConversation()
    .catch(e => console.error('Error:', e))
    .finally(() => process.exit(0));
