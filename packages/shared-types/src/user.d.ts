/**
 * User and meter metadata models.
 * Used by API gateway, auth service, and user management.
 */
/**
 * User roles in the system.
 */
export type UserRole = 'USER' | 'OPERATOR' | 'ADMIN';
/**
 * Represents a user account in the system.
 */
export interface User {
    /** Unique identifier for the user (UUID v4) */
    userId: string;
    /** Full name of the user */
    name: string;
    /** Email address (unique) */
    email: string;
    /** Geographic region where the user is located */
    region: string;
    /** User's role determining access permissions */
    role: UserRole;
    /** ISO 8601 timestamp when the account was created */
    createdAt: string;
    /** ISO 8601 timestamp when the account was last updated */
    updatedAt?: string;
    /** Whether the account is active */
    active?: boolean;
    /** Optional phone number for notifications */
    phone?: string;
}
/**
 * Meter installation status.
 */
export type MeterStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED';
/**
 * Represents a smart meter device.
 */
export interface Meter {
    /** Unique identifier for the meter (UUID v4 or device serial) */
    meterId: string;
    /** User ID of the meter owner */
    userId: string;
    /** Geographic region where the meter is installed */
    region: string;
    /** ISO 8601 timestamp when the meter was installed */
    installedAt: string;
    /** Current operational status of the meter */
    status: MeterStatus;
    /** Optional meter model/type */
    model?: string;
    /** Optional firmware version */
    firmwareVersion?: string;
    /** Optional physical address */
    address?: string;
    /** Optional last communication timestamp */
    lastSeenAt?: string;
}
/**
 * User authentication credentials (for login).
 */
export interface UserCredentials {
    /** User email */
    email: string;
    /** User password (hashed in storage) */
    password: string;
}
/**
 * JWT authentication token payload.
 */
export interface TokenPayload {
    /** User ID */
    userId: string;
    /** User email */
    email: string;
    /** User role */
    role: UserRole;
    /** Token issued at (Unix timestamp) */
    iat: number;
    /** Token expires at (Unix timestamp) */
    exp: number;
}
/**
 * Type guard to check if an object is a valid User
 */
export declare function isUser(obj: unknown): obj is User;
/**
 * Type guard to check if a role is valid
 */
export declare function isUserRole(value: string): value is UserRole;
/**
 * Type guard to check if an object is a valid Meter
 */
export declare function isMeter(obj: unknown): obj is Meter;
//# sourceMappingURL=user.d.ts.map