import { getPrismaClient } from '../config/database.js';

async function findUserConversation() {
    const prisma = getPrismaClient();

    // Try different formats
    const searchTerms = [
        '5588981312',
        '88981312',
        '9813-1260',
        '98131260',
        '5588',
        '889813'
    ];

    console.log('🔍 Searching for conversation with number variations...\n');

    for (const term of searchTerms) {
        const contacts = await prisma.contact.findMany({
            where: {
                phoneNumber: { contains: term }
            },
            include: {
                conversations: {
                    include: {
                        connection: true,
                        assignedUser: true
                    },
                    orderBy: { lastMessageAt: 'desc' },
                    take: 1
                }
            }
        });

        if (contacts.length > 0) {
            console.log(`✅ Found ${contacts.length} contact(s) with "${term}":\n`);
            contacts.forEach((contact, i) => {
                console.log(`${i + 1}. ${contact.name || 'No name'}`);
                console.log(`   Phone: ${contact.phoneNumber}`);
                if (contact.conversations.length > 0) {
                    const conv = contact.conversations[0];
                    console.log(`   Conversation ID: ${conv.id}`);
                    console.log(`   Status: ${conv.status}`);
                    console.log(`   Assigned to: ${conv.assignedUser?.name || 'None'}`);
                    console.log(`   Connection: ${conv.connection.name}`);
                }
                console.log('');
            });
            break;
        }
    }
}

findUserConversation()
    .catch(e => console.error('Error:', e))
    .finally(() => process.exit(0));
