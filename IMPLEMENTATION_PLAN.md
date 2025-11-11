# 🚀 API Gateway Complete Implementation Plan

**Project:** Smart Energy Grid Management System (SEGS)  
**Date:** November 10, 2025  
**Goal:** Implement all 85 API endpoints with complete authentication, authorization, and service integration

---

## 📋 IMPLEMENTATION STRATEGY

### Core Principles
1. **Clean Code:** Consistent formatting, clear naming, functional approach
2. **Security First:** JWT auth, input validation, role-based access control
3. **Maintainability:** Modular structure, reusable components
4. **Testing Ready:** Structure code for easy testing

### File Organization Pattern
```
apps/api-gateway/src/
├── config/
│   ├── env.ts                    # Environment variables
│   └── constants.ts              # App constants (regions, roles, etc.)
├── middleware/
│   ├── auth/
│   │   ├── authenticate.ts       # JWT verification
│   │   ├── authorize.ts          # Role-based authorization
│   │   └── types.ts              # Auth types
│   ├── validation/
│   │   ├── user.validation.ts    # User route validations
│   │   ├── telemetry.validation.ts
│   │   ├── tariff.validation.ts
│   │   ├── alert.validation.ts
│   │   ├── billing.validation.ts
│   │   ├── operator.validation.ts
│   │   └── admin.validation.ts
│   ├── errorHandler.ts           # Global error handler
│   └── requestLogger.ts          # Request logging
├── controllers/
│   ├── auth/                     # Authentication controllers
│   ├── user/                     # User management
│   ├── telemetry/                # Telemetry data
│   ├── tariff/                   # Tariff management
│   ├── alert/                    # Alert management
│   ├── billing/                  # Billing & invoices
│   ├── operator/                 # Operator operations
│   ├── admin/                    # Admin operations
│   └── notification/             # Notification management
├── services/
│   ├── auth/
│   │   ├── jwt.service.ts        # JWT token generation/verification
│   │   ├── password.service.ts   # Password hashing/verification
│   │   └── otp.service.ts        # OTP generation/verification
│   ├── database/
│   │   ├── user.service.ts       # User DB operations
│   │   ├── meter.service.ts      # Meter DB operations
│   │   ├── session.service.ts    # Session management
│   │   ├── tariff.service.ts     # Tariff DB operations
│   │   ├── alert.service.ts      # Alert DB operations
│   │   ├── billing.service.ts    # Billing DB operations
│   │   └── audit.service.ts      # Audit logging
│   ├── external/
│   │   ├── tariffClient.ts       # HTTP client for Tariff service
│   │   ├── alertClient.ts        # HTTP client for Alert service
│   │   └── timescaleClient.ts    # TimescaleDB queries
│   └── utils/
│       ├── email.service.ts      # Email sending (placeholder for now)
│       └── validation.service.ts # Common validation utilities
├── routes/
│   ├── index.ts                  # Route aggregator
│   ├── auth.routes.ts            # Authentication routes
│   ├── user.routes.ts            # User routes
│   ├── telemetry.routes.ts       # Telemetry routes
│   ├── tariff.routes.ts          # Tariff routes
│   ├── alert.routes.ts           # Alert routes
│   ├── billing.routes.ts         # Billing routes
│   ├── operator.routes.ts        # Operator routes
│   ├── admin.routes.ts           # Admin routes
│   ├── notification.routes.ts    # Notification routes
│   └── system.routes.ts          # System health/metrics
├── types/
│   ├── express.d.ts              # Express type extensions
│   ├── auth.types.ts             # Auth-related types
│   ├── api.types.ts              # API request/response types
│   └── database.types.ts         # Database types
└── utils/
    ├── db.ts                     # Database connections (existing)
    ├── response.ts               # Standard API responses
    ├── errors.ts                 # Custom error classes
    └── validators.ts             # Common validators
```

---

## 🗄️ DATABASE MIGRATIONS (Priority Order)

### ⚠️ IMPORTANT: Database Commands Must Run in Docker Container
**DO NOT** run `psql` commands directly on host machine. Always use Docker exec:
```bash
# AVOID -it flag when running non-interactive commands (causes hanging)
# Use this for queries:
docker exec segs-postgres psql -U segs_user -d segs_db -c "SELECT * FROM users LIMIT 1;"

# Use this for running SQL files:
docker exec -i segs-postgres psql -U segs_user -d segs_db < path/to/migration.sql

# Use this for interactive shell (only when needed):
docker exec -it segs-postgres psql -U segs_user -d segs_db

# Check table schema (non-interactive):
docker exec segs-postgres psql -U segs_user -d segs_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';"
```

### 🔍 Current Database State (Checked)
**Existing Tables:**
- ✅ users (with is_active, suspended_at, suspended_reason, last_login_at)
- ✅ otp_verifications (with purpose, verified_at, attempts)
- ✅ meters (basic structure exists)
- ✅ tariffs (exists)
- ✅ alerts (exists)
- ✅ invoices (exists)
- ✅ invoice_line_items (exists)
- ✅ audit_logs (exists)
- ✅ tariff_rules (exists)

**Missing Tables (Need to Create):**
- ❌ sessions
- ❌ token_blacklist
- ❌ user_preferences
- ❌ payment_transactions

**Note:** Database schema is more complete than expected! Skip migrations 1-2, create only missing tables.

### Migration 1: Sessions & Token Blacklist (REQUIRED)
**File:** `004_create_sessions.sql`
- Create sessions table
- Create token_blacklist table
- Add indexes

### Migration 4: Enhance OTP Table
**File:** `005_enhance_otp.sql`
- Add: `purpose`, `verified_at`, `attempts`
- Add indexes

### Migration 5: Invoices & Payments
**File:** `006_create_billing.sql`
- Create invoices table
- Create payment_transactions table
- Add indexes

### Migration 6: User Preferences
**File:** `007_create_preferences.sql`
- Create user_preferences table

### Migration 7: Audit Logs
**File:** `008_create_audit.sql`
- Create audit_logs table
- Add indexes

### Migration 8: Enhance Tariffs (Optional)
**File:** `009_enhance_tariffs.sql`
- Add: `base_price`, `multiplier`, `effective_to`, `is_override`, `override_by`

### Migration 9: Enhance Alerts (Optional)
**File:** `010_enhance_alerts.sql`
- Add foreign key to meters
- Add `resolved_by` UUID field

---

## 📦 PACKAGE DEPENDENCIES

### New Packages to Install
```bash
pnpm add bcrypt jsonwebtoken
pnpm add axios                    # For service-to-service calls
pnpm add -D @types/bcrypt @types/jsonwebtoken
```

### Environment Variables to Add
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Service URLs
TARIFF_SERVICE_URL=http://localhost:3003
ALERT_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005

# Email Configuration (placeholder)
EMAIL_SERVICE_ENABLED=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@segs.com

# Security
BCRYPT_ROUNDS=10
OTP_EXPIRY_MINUTES=10
SESSION_EXPIRY_DAYS=7
MAX_LOGIN_ATTEMPTS=5

# Features
ENABLE_BILLING=false              # Feature flag for billing routes
ENABLE_AUDIT_LOGS=true
```

---

## 🎯 IMPLEMENTATION PHASES

### PHASE 1: Foundation (Core Infrastructure)
**Estimated Time:** 3-4 hours  
**Status:** ✅ Complete

#### Step 1.1: Database Migrations ✅
- [x] Created migration 002: Sessions table
- [x] Created migration 003: Token blacklist table
- [x] Created migration 004: User preferences table
- [x] Created migration 005: Payment transactions table
- [x] Ran all migrations on PostgreSQL successfully

#### Step 1.2: Install Dependencies ✅
- [x] Installed bcrypt, jsonwebtoken, axios
- [x] Updated .env with new variables
- [x] Created config/constants.ts for app constants
- [x] Updated config/env.ts with all new environment variables

#### Step 1.3: Core Services ✅
- [x] `services/auth/password.service.ts` - bcrypt wrapper
- [x] `services/auth/jwt.service.ts` - JWT token management
- [x] `services/auth/otp.service.ts` - OTP generation/verification
- [x] `services/database/user.service.ts` - Enhanced user operations
- [x] `services/database/session.service.ts` - Session management
- [x] `services/database/tokenBlacklist.service.ts` - Token blacklist

#### Step 1.4: Authentication Middleware ✅
- [x] `middleware/auth/authenticate.ts` - JWT verification
- [x] `middleware/auth/authorize.ts` - Role-based access control
- [x] `types/express.d.ts` - Extend Express Request with user

#### Step 1.5: Utility Functions ✅
- [x] `utils/response.ts` - Standard API responses
- [x] `utils/errors.ts` - Custom error classes
- [x] `utils/validators.ts` - Common validation functions
- [x] `utils/asyncHandler.ts` - Async error handler wrapper

---

### PHASE 2: Authentication Routes (9 Routes)
**Estimated Time:** 2-3 hours  
**Status:** ✅ Complete

#### Routes to Implement
1. ✅ `POST /api/v1/auth/register` - User registration
2. ✅ `POST /api/v1/auth/verify-otp` - Email verification
3. ✅ `POST /api/v1/auth/login` - Login with email/password
4. ✅ `POST /api/v1/auth/logout` - Logout (blacklist token)
5. ✅ `POST /api/v1/auth/refresh-token` - Refresh JWT
6. ✅ `POST /api/v1/auth/set-password` - Set password after verification
7. ✅ `POST /api/v1/auth/change-password` - Change password (authenticated)
8. ✅ `POST /api/v1/auth/forgot-password` - Request password reset
9. ✅ `POST /api/v1/auth/reset-password` - Reset password with OTP
10. ✅ `POST /api/v1/auth/logout-all` - Logout from all devices
11. ✅ `POST /api/v1/auth/resend-otp` - Resend OTP

#### Implementation Checklist
- [x] Create `routes/auth.routes.ts`
- [x] Create `controllers/auth/register.controller.ts`
- [x] Create `controllers/auth/login.controller.ts`
- [x] Create `controllers/auth/password.controller.ts`
- [x] Create `controllers/auth/token.controller.ts`
- [x] Create `middleware/validation/auth.validation.ts`
- [x] Update `routes/index.ts` to mount auth routes
- [x] Update existing routes (user, operator, admin) with auth middleware
- [x] Update error handler to use new error classes
- [ ] Test all authentication flows

---

### PHASE 3: User Management Routes (Enhanced)
**Estimated Time:** 1-2 hours  
**Status:** ✅ Complete

#### Routes to Implement
1. ✅ `GET /api/v1/user/profile` - Get current user profile (protected)
2. ✅ `PUT /api/v1/user/profile` - Update profile (protected)
3. ✅ `GET /api/v1/user/notifications/settings` - Get preferences
4. ✅ `PUT /api/v1/user/notifications/settings` - Update preferences

#### Implementation Checklist
- [x] Refactor existing `routes/user.routes.ts`
- [x] Move register/verify to auth routes
- [x] Add authentication middleware to all routes
- [x] Create `controllers/user/profile.controller.ts`
- [x] Create `controllers/user/preferences.controller.ts`
- [x] Create `services/database/preferences.service.ts`
- [x] Create `middleware/validation/user.validation.ts`

#### ⚠️ Known Issues
- [ ] **Data Inconsistency Check Needed:** Verify data consistency between API Gateway and other microservices (Tariff, Alert, Notification). Address during integration testing phase.
- [ ] **Stream Processor Missing Calculations:** The stream processor currently does NOT calculate `min_power_kw`, `voltage_avg`, and `current_avg`. These fields are in the TimescaleDB schema with DEFAULT 0 but are not populated. This affects:
  - `getMeterStats()` - min_power_kw will always return 0
  - Future analytics that depend on voltage/current data
  - **Action Required:** Update `apps/stream-processor/src/services/aggregator.ts` to track min_power, voltage, and current values during aggregation and update `apps/stream-processor/src/db/timescale.ts` INSERT statements to include these fields.

---

### PHASE 4: Telemetry Routes (11 Routes)
**Estimated Time:** 3-4 hours  
**Status:** 🚧 In Progress

#### User Routes (6)
1. `GET /api/v1/telemetry/my-meter` - Current user's latest reading
2. `GET /api/v1/telemetry/my-meter/history` - Historical aggregates
3. `GET /api/v1/telemetry/my-meter/stats` - Consumption statistics
4. `GET /api/v1/telemetry/my-meter/daily` - Daily breakdown
5. `GET /api/v1/telemetry/my-meter/monthly` - Monthly breakdown
6. `GET /api/v1/telemetry/my-meter/compare` - Period comparison

#### Operator Routes (5)
7. `GET /api/v1/telemetry/meters/:meterId` - Specific meter reading (operator/admin)
8. `GET /api/v1/telemetry/meters/:meterId/history` - Meter history (operator/admin)
9. `GET /api/v1/telemetry/region/:region/stats` - Regional stats (operator/admin)
10. `GET /api/v1/telemetry/region/:region/top-consumers` - Top consumers (operator/admin)
11. `GET /api/v1/telemetry/region/:region/realtime` - Real-time load (operator/admin)

#### Implementation Checklist
- [ ] Create `routes/telemetry.routes.ts`
- [ ] Create `services/external/timescaleClient.ts` - Query TimescaleDB
- [ ] Create `controllers/telemetry/user.controller.ts`
- [ ] Create `controllers/telemetry/operator.controller.ts`
- [ ] Create `middleware/validation/telemetry.validation.ts`
- [ ] Implement aggregation logic (daily, monthly, stats)
- [ ] Add caching for frequent queries (Redis)

#### Technical Notes
- **TimescaleDB Port:** 5433 (different from PostgreSQL 5432)
- **Connection:** Use separate pool for TimescaleDB in `utils/db.ts`
- **Aggregation:** Query from `energy_aggregates` table created by stream-processor
- **Caching Strategy:** Cache current readings (5min TTL), aggregate data (15min TTL)
- **Query Optimization:** Use time-bucket functions for efficient time-series queries

---

### PHASE 5: Tariff Routes (9 Routes)
**Estimated Time:** 2-3 hours  
**Status:** 📝 Planned

#### User Routes (5)
1. `GET /api/v1/tariffs/current` - Current tariff for user's region
2. `GET /api/v1/tariffs/current/:region` - Tariff for specific region
3. `GET /api/v1/tariffs/history` - Historical tariffs (user's region)
4. `GET /api/v1/tariffs/estimate` - Cost estimate
5. `GET /api/v1/tariffs/forecast` - Predicted changes (future feature)

#### Operator Routes (2)
6. `GET /api/v1/tariffs/regions/all` - All regions' tariffs (operator/admin)
7. `GET /api/v1/tariffs/analytics` - Tariff analytics (operator/admin)

#### Admin Routes (2)
8. `POST /api/v1/tariffs/override` - Manual override (admin)
9. `DELETE /api/v1/tariffs/override/:tariffId` - Remove override (admin)

#### Implementation Checklist
- [ ] Create `routes/tariff.routes.ts`
- [ ] Create `services/external/tariffClient.ts` - Proxy to Tariff service
- [ ] Create `controllers/tariff/user.controller.ts`
- [ ] Create `controllers/tariff/operator.controller.ts`
- [ ] Create `controllers/tariff/admin.controller.ts`
- [ ] Create `middleware/validation/tariff.validation.ts`
- [ ] Implement cost estimation logic
- [ ] Add Redis caching for current tariffs

---

### PHASE 6: Alert Routes (11 Routes)
**Estimated Time:** 2-3 hours  
**Status:** 📝 Planned

#### User Routes (6)
1. `GET /api/v1/alerts` - User's alerts (filterable)
2. `GET /api/v1/alerts/:alertId` - Specific alert
3. `PATCH /api/v1/alerts/:alertId/acknowledge` - Acknowledge alert
4. `PATCH /api/v1/alerts/:alertId/resolve` - Resolve alert
5. `GET /api/v1/alerts/summary` - Alert summary
6. `GET /api/v1/alerts/stats` - Alert statistics

#### Operator Routes (5)
7. `GET /api/v1/alerts/region/:region` - Regional alerts (operator/admin)
8. `GET /api/v1/alerts/meter/:meterId` - Meter alerts (operator/admin)
9. `PATCH /api/v1/alerts/bulk/acknowledge` - Bulk acknowledge (operator/admin)
10. `GET /api/v1/alerts/analytics` - Alert analytics (operator/admin)
11. `GET /api/v1/alerts/unresolved` - All unresolved alerts (operator/admin)

#### Implementation Checklist
- [ ] Create `routes/alert.routes.ts`
- [ ] Create `services/external/alertClient.ts` - Proxy to Alert service
- [ ] Create `controllers/alert/user.controller.ts`
- [ ] Create `controllers/alert/operator.controller.ts`
- [ ] Create `middleware/validation/alert.validation.ts`
- [ ] Implement filtering and pagination
- [ ] Add audit logging for acknowledge/resolve actions

---

### PHASE 7: Billing Routes (12 Routes - Feature Flag)
**Estimated Time:** 4-5 hours  
**Status:** 📝 Planned

#### User Routes (8)
1. `GET /api/v1/billing/invoices` - User's invoices
2. `GET /api/v1/billing/invoices/:invoiceId` - Specific invoice
3. `GET /api/v1/billing/invoices/:invoiceId/pdf` - Download PDF
4. `GET /api/v1/billing/current-cycle` - Current billing cycle
5. `GET /api/v1/billing/estimated` - Estimated current bill
6. `GET /api/v1/billing/payment-history` - Payment history
7. `POST /api/v1/billing/invoices/:invoiceId/pay` - Mark as paid
8. `POST /api/v1/billing/invoices/:invoiceId/dispute` - Dispute invoice

#### Operator Routes (4)
9. `GET /api/v1/billing/region/:region/overdue` - Overdue invoices (operator/admin)
10. `GET /api/v1/billing/analytics` - Billing analytics (operator/admin)
11. `POST /api/v1/billing/generate-invoices` - Generate monthly invoices (operator/admin)
12. `GET /api/v1/billing/export` - Export billing data (operator/admin)

#### Implementation Checklist
- [ ] Create migration 006: Billing tables
- [ ] Create `routes/billing.routes.ts`
- [ ] Create `services/database/billing.service.ts`
- [ ] Create `controllers/billing/user.controller.ts`
- [ ] Create `controllers/billing/operator.controller.ts`
- [ ] Create `middleware/validation/billing.validation.ts`
- [ ] Implement invoice generation logic
- [ ] Implement estimation algorithm
- [ ] Add feature flag check middleware

---

### PHASE 8: Operator Routes (Enhanced 10 Routes)
**Estimated Time:** 2 hours  
**Status:** 📝 Planned

#### Routes to Implement
1. `GET /api/v1/operator/users` - ✅ Already exists (enhance)
2. `GET /api/v1/operator/users/region/:region` - ✅ Already exists
3. `GET /api/v1/operator/users/:userId` - User details
4. `GET /api/v1/operator/meters` - All meters
5. `GET /api/v1/operator/meters/:meterId` - Meter details
6. `PUT /api/v1/operator/meters/:meterId/status` - Update meter status
7. `GET /api/v1/operator/dashboard/stats` - Dashboard stats
8. `GET /api/v1/operator/reports/consumption` - Consumption report
9. `GET /api/v1/operator/reports/revenue` - Revenue report
10. `GET /api/v1/operator/export/users` - Export users to CSV

#### Implementation Checklist
- [ ] Refactor existing `routes/operator.routes.ts`
- [ ] Add authentication/authorization to all routes
- [ ] Create `controllers/operator/meters.controller.ts`
- [ ] Create `controllers/operator/dashboard.controller.ts`
- [ ] Create `controllers/operator/reports.controller.ts`
- [ ] Implement CSV export functionality

---

### PHASE 9: Admin Routes (Enhanced 15 Routes)
**Estimated Time:** 3 hours  
**Status:** 📝 Planned

#### User Management (5)
1. `POST /api/v1/admin/assign-meter` - ✅ Already exists
2. `PUT /api/v1/admin/users/:userId/role` - ✅ Already exists
3. `DELETE /api/v1/admin/users/:userId` - ✅ Already exists
4. `PUT /api/v1/admin/users/:userId/suspend` - Suspend user
5. `PUT /api/v1/admin/users/:userId/activate` - Activate user

#### Meter Management (4)
6. `POST /api/v1/admin/meters` - Create meter
7. `PUT /api/v1/admin/meters/:meterId` - Update meter
8. `DELETE /api/v1/admin/meters/:meterId` - Delete meter
9. `POST /api/v1/admin/meters/:meterId/unassign` - Unassign meter

#### System Management (6)
10. `GET /api/v1/admin/stats` - ✅ Already exists (enhance)
11. `GET /api/v1/admin/audit-logs` - Audit trail
12. `GET /api/v1/admin/health` - Detailed health check
13. `POST /api/v1/admin/config` - Update configuration
14. `GET /api/v1/admin/users/export` - Export all users
15. `POST /api/v1/admin/data/seed` - Seed test data (dev only)

#### Implementation Checklist
- [ ] Refactor existing `routes/admin.routes.ts`
- [ ] Add authentication/authorization to all routes
- [ ] Create `controllers/admin/users.controller.ts`
- [ ] Create `controllers/admin/meters.controller.ts`
- [ ] Create `controllers/admin/system.controller.ts`
- [ ] Create `services/database/audit.service.ts`
- [ ] Implement audit logging for all admin actions
- [ ] Add environment check for dangerous operations (seed, delete)

---

### PHASE 10: Notification & System Routes (8 Routes)
**Estimated Time:** 1-2 hours  
**Status:** 📝 Planned

#### Notification Routes (4)
1. `GET /api/v1/notifications/history` - Notification history
2. `PUT /api/v1/notifications/preferences` - Update preferences
3. `POST /api/v1/notifications/test` - Send test notification
4. `GET /api/v1/notifications/unread-count` - Unread count

#### System Routes (4)
1. `GET /health` - ✅ Already exists
2. `GET /metrics` - ✅ Already exists
3. `GET /api/v1/system/health/detailed` - Detailed health (admin)
4. `GET /api/v1/system/info` - System information (admin)

#### Implementation Checklist
- [ ] Create `routes/notification.routes.ts`
- [ ] Create `routes/system.routes.ts`
- [ ] Create `controllers/notification/user.controller.ts`
- [ ] Create `controllers/system/health.controller.ts`
- [ ] Enhance existing health check with service status
- [ ] Add Prometheus metrics integration

---

## 🧪 TESTING STRATEGY

### Unit Tests (Jest)
- [ ] Auth services (JWT, password, OTP)
- [ ] Database services
- [ ] Validation middleware
- [ ] Utility functions

### Integration Tests
- [ ] Authentication flow (register → verify → login)
- [ ] Protected route access with JWT
- [ ] Role-based authorization
- [ ] Service-to-service communication

### E2E Tests
- [ ] Complete user journey
- [ ] Operator dashboard access
- [ ] Admin operations

---

## 📝 CODE STANDARDS & PATTERNS

### Naming Conventions
- **Files:** `camelCase.ts` or `kebab-case.ts` (consistent)
- **Functions:** `camelCase` (verbs: `getUser`, `createInvoice`)
- **Types/Interfaces:** `PascalCase` (`User`, `Invoice`, `JWTPayload`)
- **Constants:** `UPPER_SNAKE_CASE` (`JWT_SECRET`, `BCRYPT_ROUNDS`)
- **Database tables:** `snake_case` (`users`, `payment_transactions`)

### Controller Pattern
```typescript
// controllers/auth/login.controller.ts
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { loginUser } from '../../services/auth/login.service.js';

export const loginController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email, password } = req.body;
    
    const result = await loginUser(email, password);
    
    successResponse(res, 200, 'Login successful', result);
  }
);
```

### Service Pattern
```typescript
// services/auth/login.service.ts
import { verifyPassword } from './password.service.js';
import { generateTokens } from './jwt.service.js';
import { getUserByEmail } from '../database/user.service.js';
import { createSession } from '../database/session.service.js';
import { UnauthorizedError } from '../../utils/errors.js';

export const loginUser = async (email: string, password: string) => {
  const user = await getUserByEmail(email);
  
  if (!user || !user.password_hash) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  const isValid = await verifyPassword(password, user.password_hash);
  
  if (!isValid) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  if (!user.email_verified) {
    throw new UnauthorizedError('Email not verified');
  }
  
  if (!user.is_active) {
    throw new UnauthorizedError('Account suspended');
  }
  
  const tokens = await generateTokens(user);
  await createSession(user.user_id, tokens.refreshToken);
  
  return {
    user: {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      meter_id: user.meter_id,
      region: user.region
    },
    tokens
  };
};
```

### Validation Pattern
```typescript
// middleware/validation/auth.validation.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../utils/validators.js';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const validateLogin = validateRequest(loginSchema);
```

### Route Pattern
```typescript
// routes/auth.routes.ts
import { Router } from 'express';
import { loginController } from '../controllers/auth/login.controller.js';
import { validateLogin } from '../middleware/validation/auth.validation.js';

const router = Router();

router.post('/login', validateLogin, loginController);

export default router;
```

### Response Format
```typescript
// Success
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "details": { ... }
  }
}
```

---

## 🔒 SECURITY CHECKLIST

- [ ] JWT secret in environment variable (min 32 chars)
- [ ] Password hashing with bcrypt (10+ rounds)
- [ ] Input validation on all routes
- [ ] SQL injection prevention (parameterized queries)
- [ ] Rate limiting on auth routes
- [ ] CORS configuration (specific origins)
- [ ] Helmet.js security headers
- [ ] Request size limits
- [ ] Token expiry and refresh mechanism
- [ ] Audit logging for sensitive operations
- [ ] Role-based access control on all protected routes
- [ ] Token blacklisting on logout

---

## 📊 PROGRESS TRACKING

### Overall Progress
- [x] Phase 1: Foundation (6/6 steps) ✅
- [x] Phase 2: Authentication (11/11 routes) ✅
- [x] Phase 3: User Management (4/4 routes) ✅
- [ ] Phase 4: Telemetry (0/11 routes) 🚧
- [ ] Phase 5: Tariffs (0/9 routes)
- [ ] Phase 6: Alerts (0/11 routes)
- [ ] Phase 7: Billing (0/12 routes)
- [ ] Phase 8: Operator (0/10 routes)
- [ ] Phase 9: Admin (0/15 routes)
- [ ] Phase 10: Notifications & System (0/8 routes)

### Total Routes: 15/85 Complete (17.6%)

---

## 🚀 EXECUTION ORDER

1. **Start:** Phase 1 (Foundation) - Required for everything else
2. **Next:** Phase 2 (Authentication) - Core functionality
3. **Then:** Phase 3 (User Management) - Build on auth
4. **Parallel Track:**
   - Phase 4 (Telemetry) - Independent
   - Phase 5 (Tariffs) - Independent
   - Phase 6 (Alerts) - Independent
5. **Later:** Phase 7 (Billing) - Can be feature-flagged
6. **Enhancement:** Phase 8-9 (Operator/Admin) - Build on existing
7. **Final:** Phase 10 (Notifications/System) - Polish

---

## 📖 REFERENCE LINKS

### Existing Code
- Current user routes: `apps/api-gateway/src/routes/userRouter.ts`
- Current operator routes: `apps/api-gateway/src/routes/operatorRouter.ts`
- Current admin routes: `apps/api-gateway/src/routes/adminRouter.ts`
- Database connection: `apps/api-gateway/src/utils/db.ts`
- Environment config: `apps/api-gateway/src/config/env.ts`

### External Services
- Tariff Service: `apps/tariff/src/routes/tariffRouter.ts`
- Alert Service: `apps/alert/src/routes/alertRouter.ts`
- Notification Service: `apps/notification/src/services/websocketManager.ts`

### Database Schemas
- Users: `apps/api-gateway/src/db/migrations/001_create_users.sql`
- Tariffs: `apps/tariff/src/db/migrations/001_create_tariffs.sql`
- Alerts: `apps/alert/src/db/migrations/001_create_alerts.sql`
- Aggregates: `apps/stream-processor/src/db/migrations/001_create_aggregates.sql`

---

**Ready to start implementation! Begin with Phase 1.**
