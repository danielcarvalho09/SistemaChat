
import { getPrismaClient } from '../config/database';

async function promoteAdmin() {
    const prisma = getPrismaClient();

    const email = 'admin@tom.com';
    console.log(`🔍 Finding user ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.log('❌ User not found');
        return;
    }

    console.log('🔍 Finding admin role...');
    const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
    });

    if (!adminRole) {
        console.log('❌ Admin role not found. Creating...');
        // Create logic if needed, but it should exist
    }

    if (adminRole) {
        console.log(`✅ Adding admin role to user ${user.id}...`);
        // Upsert to avoid duplicates
        await prisma.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: user.id,
                    roleId: adminRole.id
                }
            },
            create: {
                userId: user.id,
                roleId: adminRole.id
            },
            update: {}
        });
        console.log('✅ User promoted to admin successfully.');
    }
}

promoteAdmin()
    .catch(e => console.error(e))
    .finally(() => process.exit(0));
