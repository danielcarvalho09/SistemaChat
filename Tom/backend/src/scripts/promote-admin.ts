
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promote() {
    try {
        const email = 'admin@admin.com';
        console.log(`🚀 Promoting ${email} to Admin...`);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            console.error('❌ User not found');
            return;
        }

        const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
        if (!adminRole) {
            console.error('❌ Admin role not found');
            return;
        }

        // Check if user already has role
        const existing = await prisma.userRole.findFirst({
            where: { userId: user.id, roleId: adminRole.id }
        });

        if (existing) {
            console.log('⚠️ User is already admin');
        } else {
            await prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: adminRole.id
                }
            });
            console.log('✅ User promoted to Admin successfully!');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

promote();
