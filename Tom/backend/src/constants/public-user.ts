import { UserResponse } from '../models/types.js';

export const PUBLIC_USER_ID = 'public-user';

export const PUBLIC_USER_RESPONSE: UserResponse = {
  id: PUBLIC_USER_ID,
  email: 'public@example.com',
  name: 'Public User',
  avatar: null,
  status: 'online',
  isActive: true,
  roles: [
    {
      id: 'role-public',
      name: 'admin',
      description: null,
    },
  ],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export const PUBLIC_REQUEST_USER = {
  userId: PUBLIC_USER_ID,
  email: PUBLIC_USER_RESPONSE.email,
  roles: ['admin'],
  permissions: ['*'],
};
