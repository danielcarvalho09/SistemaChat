
import { getPrismaClient } from '../config/database';

async function checkNewAdmin() {
    const prisma = getPrismaClient();
    const email = 'admin@admin.com';

    console.log(`🔍 Checking user ${email}...`);
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            roles: { include: { role: true } }
        }
    });

    if (!user) {
        console.log('❌ User not found!');
    } else {
        console.log(`✅ User found: ${user.name}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Password hash starts with: ${user.password.substring(0, 10)}...`);
        console.log('   Roles:');
        user.roles.forEach(ur => console.log(`     - ${ur.role.name}`));
    }
}

checkNewAdmin()
    .catch(e => console.error(e))
    .finally(() => process.exit(0));
