# Invoice Routes Implementation Plan

## ⚠️ CRITICAL: Data Consistency Checklist

### Database Schema Analysis (FROM \d invoices OUTPUT)
```sql
-- EXACT COLUMN NAMES (MUST MATCH CODE):
invoice_id               UUID PRIMARY KEY
invoice_number           VARCHAR(50) UNIQUE
user_id                  VARCHAR(50) NOT NULL  -- ⚠️ VARCHAR, not UUID!
meter_id                 VARCHAR(50) NOT NULL  -- ⚠️ VARCHAR, not UUID!
region                   VARCHAR(50) NOT NULL
billing_period_start     TIMESTAMPTZ NOT NULL
billing_period_end       TIMESTAMPTZ NOT NULL
total_consumption_kwh    NUMERIC(10,2) NOT NULL
peak_consumption_kwh     NUMERIC(10,2)
off_peak_consumption_kwh NUMERIC(10,2)
avg_tariff_rate          NUMERIC(10,4) NOT NULL
base_cost                NUMERIC(10,2) NOT NULL
tax_amount               NUMERIC(10,2) DEFAULT 0
surcharges               NUMERIC(10,2) DEFAULT 0
discounts                NUMERIC(10,2) DEFAULT 0
total_cost               NUMERIC(10,2) NOT NULL
currency                 VARCHAR(10) DEFAULT 'USD'
status                   VARCHAR(20) DEFAULT 'pending'  -- ✅ Matches constants.ts
due_date                 TIMESTAMPTZ NOT NULL
paid_at                  TIMESTAMPTZ
payment_method           VARCHAR(50)
payment_reference        VARCHAR(100)
is_disputed              BOOLEAN DEFAULT false
disputed_at              TIMESTAMPTZ
dispute_reason           TEXT
dispute_resolved_at      TIMESTAMPTZ
pdf_url                  TEXT
notes                    TEXT
metadata                 JSONB DEFAULT '{}'
created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
updated_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP

-- CONSTRAINTS:
status CHECK: ['pending', 'paid', 'overdue', 'disputed', 'cancelled']
```

### Existing Constants Validation
✅ From `src/config/constants.ts`:
```typescript
INVOICE_STATUSES = ['pending', 'paid', 'overdue', 'disputed', 'cancelled']
```
**MATCHES DATABASE CONSTRAINT** ✅

### Related Tables to Check
1. **invoice_line_items** - Details of consumption breakdown
2. **payment_transactions** - Payment history
3. **users** - user_id reference
4. **meters** - meter_id reference

### Feature Flag
✅ From `src/config/env.ts`:
```typescript
ENABLE_BILLING: process.env.ENABLE_BILLING === 'true'
```

## 📋 Implementation Steps (Iterative with Validation)

### PHASE 1: Type Definitions & Validation (Triple-Check)
**Files to Create:**
1. `src/types/invoice.types.ts`

**Critical Rules:**
- ✅ Use EXACT database column names
- ✅ Match existing alert/tariff patterns
- ✅ user_id and meter_id are VARCHAR(50), not UUID
- ✅ All numeric fields use proper precision
- ✅ Status must use InvoiceStatus from constants

**Validation Steps:**
1. Compare every field name with `\d invoices` output
2. Check existing types in tariff.types.ts and alert (in alert service)
3. Verify no hardcoded strings

### PHASE 2: Database Service (Triple-Check)
**Files to Create:**
1. `src/services/database/billing.service.ts`

**Critical Rules:**
- ✅ Use parameterized queries ($1, $2, etc.)
- ✅ SELECT columns explicitly (no SELECT *)
- ✅ JOIN with users/meters using VARCHAR comparison
- ✅ Map database rows to interface (like alert service mapRowToAlert)
- ✅ Handle NULL values properly

**Validation Steps:**
1. Test query syntax with actual database
2. Verify all column names match schema
3. Check for case sensitivity issues
4. Ensure proper error handling

### PHASE 3: Validation Middleware (Triple-Check)
**Files to Create:**
1. `src/middleware/validation/billing.validation.ts`

**Critical Rules:**
- ✅ Use zod schemas like existing validations
- ✅ UUID validation for invoiceId params
- ✅ Date validation for period queries
- ✅ Status enum validation using INVOICE_STATUSES

**Validation Steps:**
1. Check existing validation patterns in alert.validation.ts
2. Ensure error messages are user-friendly
3. Test edge cases (invalid UUIDs, dates, etc.)

### PHASE 4: User Controllers (Triple-Check)
**Files to Create:**
1. `src/controllers/billing/user.controller.ts`

**Routes:**
- GET `/api/v1/billing/invoices` - List with pagination
- GET `/api/v1/billing/invoices/:invoiceId` - Details
- GET `/api/v1/billing/invoices/:invoiceId/pdf` - Download (placeholder)
- GET `/api/v1/billing/current-cycle` - Current billing period
- GET `/api/v1/billing/estimated` - Estimate current bill
- GET `/api/v1/billing/payment-history` - Payment transactions
- POST `/api/v1/billing/invoices/:invoiceId/pay` - Mark paid
- POST `/api/v1/billing/invoices/:invoiceId/dispute` - Dispute

**Critical Rules:**
- ✅ Filter by req.user.userId (from JWT)
- ✅ Verify invoice ownership before updates
- ✅ Use asyncHandler for all controllers
- ✅ Return consistent response format

**Validation Steps:**
1. Check JWT payload structure (userId, not user_id)
2. Verify authorization checks
3. Test with actual user IDs from database

### PHASE 5: Operator Controllers (Triple-Check)
**Files to Create:**
1. `src/controllers/billing/operator.controller.ts`

**Routes:**
- GET `/api/v1/billing/region/:region/overdue` - Regional overdue
- GET `/api/v1/billing/analytics` - System-wide analytics
- POST `/api/v1/billing/generate-invoices` - Monthly generation (complex)
- GET `/api/v1/billing/export` - CSV export

**Critical Rules:**
- ✅ Require 'operator' or 'admin' role
- ✅ Region validation against REGIONS constant
- ✅ Proper aggregation queries
- ✅ CSV generation for export

**Validation Steps:**
1. Test role-based access control
2. Verify region filtering
3. Check aggregation accuracy

### PHASE 6: Routes Setup (Triple-Check)
**Files to Create:**
1. `src/routes/billing.routes.ts`

**Critical Rules:**
- ✅ Feature flag check middleware at router level
- ✅ authenticate middleware on ALL routes
- ✅ requireRole for operator routes
- ✅ Specific routes BEFORE parameterized routes (like alert service)

**Validation Steps:**
1. Check route ordering (stats/analytics before :id)
2. Verify middleware chain
3. Test feature flag enforcement

### PHASE 7: Integration (Triple-Check)
**Files to Modify:**
1. `src/index.ts` - Mount billing routes

**Critical Rules:**
- ✅ Mount at `/api/v1/billing`
- ✅ Add after alert routes, before operator
- ✅ Feature flag check

**Validation Steps:**
1. Verify no route conflicts
2. Check middleware order
3. Test health endpoint still works

## 🔍 Pre-Implementation Checks

### Check 1: Database Schema Consistency
```bash
# Verify invoices table exists and matches schema
docker exec segs-postgres psql -U segs_user -d segs_db -c "\d invoices"
docker exec segs-postgres psql -U segs_user -d segs_db -c "\d invoice_line_items"
docker exec segs-postgres psql -U segs_user -d segs_db -c "\d payment_transactions"

# Count existing records
docker exec segs-postgres psql -U segs_user -d segs_db -c "SELECT COUNT(*) FROM invoices;"
```

### Check 2: User/Meter ID Formats
```bash
# Check actual user_id format in database
docker exec segs-postgres psql -U segs_user -d segs_db -c "SELECT user_id, meter_id FROM users LIMIT 5;"

# Verify they are UUIDs but stored as VARCHAR
```

### Check 3: Feature Flag
```bash
# Check .env file
grep ENABLE_BILLING /Users/om/Projects/SMART-ENERGY-GRID/apps/api-gateway/.env || echo "NOT SET"
```

### Check 4: Existing Type Patterns
```bash
# Review existing type files
ls -la /Users/om/Projects/SMART-ENERGY-GRID/apps/api-gateway/src/types/
```

## 🎯 Implementation Sequence

1. **READ SCHEMA** (5 min)
   - Execute all database checks
   - Document exact column names
   - Note data types and constraints

2. **CREATE TYPES** (10 min)
   - invoice.types.ts with all interfaces
   - Triple-check against database schema
   - Review against existing patterns

3. **CREATE SERVICE** (20 min)
   - billing.service.ts with all DB operations
   - Test each query independently
   - Verify column name consistency

4. **CREATE VALIDATION** (10 min)
   - billing.validation.ts with zod schemas
   - Test validation logic
   - Check error messages

5. **CREATE CONTROLLERS** (30 min)
   - user.controller.ts (8 routes)
   - operator.controller.ts (4 routes)
   - Test authorization logic

6. **CREATE ROUTES** (10 min)
   - billing.routes.ts
   - Verify route ordering
   - Check middleware chain

7. **INTEGRATE** (10 min)
   - Update index.ts
   - Add feature flag check
   - Verify no conflicts

8. **BUILD & TEST** (15 min)
   - pnpm build
   - Start service
   - Test each endpoint

## 📝 Critical Reminders

### From Previous Issues (Alert Service):
1. ✅ **Column Names**: Use EXACT database names, create mapper if needed
2. ✅ **Case Sensitivity**: Use consistent casing (database is lowercase with underscores)
3. ✅ **Status Mapping**: Map enums to database values properly
4. ✅ **Type Safety**: No inline types with >2 keys
5. ✅ **Authorization**: Always check user ownership
6. ✅ **Route Ordering**: Specific routes before parameterized

### New Patterns to Follow:
1. ✅ **user_id/meter_id**: VARCHAR(50) not UUID type
2. ✅ **Pagination**: limit/offset pattern like alert service
3. ✅ **Filtering**: status/region filters with proper SQL
4. ✅ **Aggregation**: SUM/AVG/COUNT with proper types
5. ✅ **CSV Export**: Generate proper CSV format
6. ✅ **PDF Generation**: Placeholder for now (return URL)

## 🚀 Success Criteria

### Functional
- ✅ All 12 endpoints return 200 OK
- ✅ User can view their invoices
- ✅ Operator can view regional data
- ✅ Invoice generation logic works
- ✅ Payment marking updates database
- ✅ Dispute process captures all fields

### Technical
- ✅ Zero TypeScript errors
- ✅ All queries use parameterized format
- ✅ Proper error handling
- ✅ Consistent response format
- ✅ Feature flag enforcement
- ✅ Role-based access control

### Data Consistency
- ✅ Column names match database exactly
- ✅ No hardcoded topic names
- ✅ No case sensitivity issues
- ✅ Proper NULL handling
- ✅ Correct data type conversions

## 📊 Post-Implementation Validation

1. **Database Queries**
```sql
-- Verify invoice creation
SELECT invoice_id, invoice_number, user_id, status, total_cost FROM invoices LIMIT 10;

-- Check payment updates
SELECT invoice_id, paid_at, payment_method FROM invoices WHERE status = 'paid';

-- Verify disputes
SELECT invoice_id, is_disputed, dispute_reason FROM invoices WHERE is_disputed = true;
```

2. **API Testing**
```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | jq -r '.data.tokens.accessToken')

# Test user invoice list
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/billing/invoices

# Test invoice details
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/billing/invoices/{INVOICE_ID}
```

3. **Service Health**
```bash
# Check API Gateway health
curl http://localhost:3000/health

# Check logs for errors
tail -f apps/api-gateway/logs/error.log
```

---

**READY TO EXECUTE: This plan will be followed step-by-step with validation at each stage**

*Created: November 12, 2025*
*Status: Execution starting after 30-minute break*
