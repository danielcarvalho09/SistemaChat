import { randomBytes } from 'crypto';
import { getPrismaClient } from '../config/database.js';
import { PUBLIC_USER_ID, PUBLIC_USER_RESPONSE } from '../constants/public-user.js';

const prisma = getPrismaClient();

type ResolvedRequestUser = {
  userId: string;
  email: string;
  name: string;
  roles: string[];
};

const DEFAULT_PASSWORD = randomBytes(24).toString('hex');
const DEFAULT_ROLE_ID = PUBLIC_USER_RESPONSE.roles[0]?.id ?? 'role-public';
const DEFAULT_ROLE_NAME = PUBLIC_USER_RESPONSE.roles[0]?.name ?? 'admin';

const ensureAdminRole = async () => {
  const role = await prisma.role.upsert({
    where: { name: DEFAULT_ROLE_NAME },
    update: {},
    create: {
      id: DEFAULT_ROLE_ID,
      name: DEFAULT_ROLE_NAME,
      description: 'Default administrator role',
    },
  });

  return role;
};

export const resolveRequestUser = async (
  email?: string,
  name?: string
): Promise<ResolvedRequestUser> => {
  const normalizedEmail = (email ?? PUBLIC_USER_RESPONSE.email).toLowerCase();
  const resolvedName =
    name?.trim() ||
    (email ? email.split('@')[0] : PUBLIC_USER_RESPONSE.name);

  const adminRole = await ensureAdminRole();

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name: resolvedName,
      isActive: true,
    },
    create: {
      id: normalizedEmail === PUBLIC_USER_RESPONSE.email ? PUBLIC_USER_ID : undefined,
      email: normalizedEmail,
      password: DEFAULT_PASSWORD,
      name: resolvedName,
      status: 'online',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: [adminRole.name],
  };
};


