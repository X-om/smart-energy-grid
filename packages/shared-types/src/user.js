"use strict";
/**
 * User and meter metadata models.
 * Used by API gateway, auth service, and user management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUser = isUser;
exports.isUserRole = isUserRole;
exports.isMeter = isMeter;
/**
 * Type guard to check if an object is a valid User
 */
function isUser(obj) {
    const user = obj;
    return (typeof user === 'object' &&
        user !== null &&
        typeof user.userId === 'string' &&
        typeof user.name === 'string' &&
        typeof user.email === 'string' &&
        typeof user.region === 'string' &&
        typeof user.role === 'string');
}
/**
 * Type guard to check if a role is valid
 */
function isUserRole(value) {
    return ['USER', 'OPERATOR', 'ADMIN'].includes(value);
}
/**
 * Type guard to check if an object is a valid Meter
 */
function isMeter(obj) {
    const meter = obj;
    return (typeof meter === 'object' &&
        meter !== null &&
        typeof meter.meterId === 'string' &&
        typeof meter.userId === 'string' &&
        typeof meter.region === 'string' &&
        typeof meter.status === 'string');
}
//# sourceMappingURL=user.js.map