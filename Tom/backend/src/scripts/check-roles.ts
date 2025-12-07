
import { getPrismaClient } from '../config/database';

async function checkUserRoles() {
    const prisma = getPrismaClient();

    const user = await prisma.user.findUnique({
        where: { email: 'admin@tom.com' },
        include: {
            roles: {
                include: { role: true }
            }
        }
    });

    if (!user) {
        console.log('❌ User admin@tom.com not found');
        return;
    }

    console.log(`👤 User: ${user.name} (${user.email})`);
    console.log('🔑 Roles:');
    user.roles.forEach(ur => {
        console.log(`   - ${ur.role.name}`);
    });
}

checkUserRoles()
    .catch(e => console.error(e))
    .finally(() => process.exit(0));
