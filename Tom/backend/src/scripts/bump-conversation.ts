
import { getPrismaClient } from '../config/database';

async function bumpConversation() {
    const prisma = getPrismaClient();

    console.log('🔍 Finding conversation...');
    const conversation = await prisma.conversation.findFirst({
        where: {
            contact: { phoneNumber: { contains: '8898131260' } }
        }
    });

    if (!conversation) {
        console.log('❌ Conversation not found');
        return;
    }

    console.log(`✅ Found conversation ${conversation.id}. Bumping timestamp...`);

    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
    });

    console.log('✅ Timestamp updated. Refresh dashboard now.');
}

bumpConversation()
    .catch(e => console.error(e))
    .finally(() => process.exit(0));
