export type UserRole = 'USER' | 'OPERATOR' | 'ADMIN';

export interface User {
  userId: string;
  name: string;
  email: string;
  region: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
  active?: boolean;
  phone?: string;
}

export type MeterStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';

export interface Meter {
  meterId: string;
  userId: string;
  region: string;
  installedAt: string;
  status: MeterStatus;
  model?: string;
  firmwareVersion?: string;
  address?: string;
  lastSeenAt?: string;
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export function isUser(obj: unknown): obj is User {
  const user = obj as User;
  return (
    typeof user === 'object' &&
    user !== null &&
    typeof user.userId === 'string' &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    typeof user.region === 'string' &&
    typeof user.role === 'string'
  );
}


export function isUserRole(value: string): value is UserRole {
  return ['USER', 'OPERATOR', 'ADMIN'].includes(value);
}


export function isMeter(obj: unknown): obj is Meter {
  const meter = obj as Meter;
  return (
    typeof meter === 'object' &&
    meter !== null &&
    typeof meter.meterId === 'string' &&
    typeof meter.userId === 'string' &&
    typeof meter.region === 'string' &&
    typeof meter.status === 'string'
  );
}
