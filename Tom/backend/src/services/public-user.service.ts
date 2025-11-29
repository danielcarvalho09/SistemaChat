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

  // Buscar ou criar usuário
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
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  // ✅ Buscar roles reais do usuário do banco de dados
  let userRoles: string[] = [];
  
  if (user.roles && user.roles.length > 0) {
    // Usuário já tem roles atribuídas - usar essas
    userRoles = user.roles.map(ur => ur.role.name);
  } else {
    // ✅ Usuário novo ou sem roles - atribuir role "user" como padrão (NÃO admin)
    const userRole = await prisma.role.findUnique({
      where: { name: 'user' },
    });

    if (userRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: userRole.id,
        },
      });
      userRoles = ['user'];
    } else {
      // Fallback: se role "user" não existir, usar admin (mas isso não deveria acontecer)
      const adminRole = await ensureAdminRole();
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });
      userRoles = [adminRole.name];
    }
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: userRoles,
  };
};


