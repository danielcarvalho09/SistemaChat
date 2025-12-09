import { getPrismaClient } from '../../config/database.js';
import { hashPassword } from '../../utils/password.js';

async function ensureAdminUser() {
    const prisma = getPrismaClient();
    const email = 'admin@admin.com';
    const password = '123456';
    const name = 'Admin';

    console.log(`🔍 Checking user ${email}...`);

    let user = await prisma.user.findUnique({
        where: { email },
        include: {
            roles: { include: { role: true } }
        }
    });

    const hashedPassword = await hashPassword(password);

    if (!user) {
        console.log('❌ User not found. Creating...');
        user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                isActive: true,
            },
            include: {
                roles: { include: { role: true } }
            }
        });
        console.log('✅ User created');
    } else {
        console.log('✅ User exists. Updating password...');
        user = await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
            include: {
                roles: { include: { role: true } }
            }
        });
        console.log('✅ Password updated');
    }

    // Ensure admin role exists
    let adminRole = await prisma.role.findUnique({
        where: { name: 'admin' }
    });

    if (!adminRole) {
        console.log('Creating admin role...');
        adminRole = await prisma.role.create({
            data: {
                name: 'admin',
                description: 'Administrator role with full access'
            }
        });
    }

    // Ensure user has admin role
    const existingUserRole = await prisma.userRole.findFirst({
        where: {
            userId: user.id,
            roleId: adminRole.id
        }
    });

    if (!existingUserRole) {
        console.log('Adding admin role to user...');
        await prisma.userRole.create({
            data: {
                userId: user.id,
                roleId: adminRole.id
            }
        });
        console.log('✅ Admin role added');
    } else {
        console.log('✅ User already has admin role');
    }

    // Verify final state
    const finalUser = await prisma.user.findUnique({
        where: { email },
        include: {
            roles: { include: { role: true } }
        }
    });

    console.log('\n📋 Final user state:');
    console.log('  Email:', finalUser?.email);
    console.log('  Name:', finalUser?.name);
    console.log('  Roles:', finalUser?.roles.map((ur: { role: { name: string } }) => ur.role.name).join(', '));
    console.log('\n✅ Admin user is ready!');
}

ensureAdminUser()
    .catch(e => console.error('Error:', e))
    .finally(() => process.exit(0));
