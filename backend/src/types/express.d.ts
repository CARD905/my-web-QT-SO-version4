import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        roleCode?: string;
        roleId?: string;
        teamId?: string | null;
        name: string;
      };
    }
  }
}

export {};