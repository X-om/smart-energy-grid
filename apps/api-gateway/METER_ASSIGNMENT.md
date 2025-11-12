# Meter Assignment System

## Overview

The Smart Energy Grid System now includes automatic meter assignment for users. This ensures that every user has a unique smart meter ID linked to their account, enabling billing, consumption tracking, and analytics.

## Features

### 1. **Auto-Assignment on Registration** ✅
- New users automatically receive a meter ID when they register
- Meters are assigned from the simulator range: `MTR-00000001` to `MTR-10000000`
- Assignment respects user's region preference
- If auto-assignment fails, registration still succeeds (meter can be assigned later)

### 2. **Bulk Assignment for Existing Users** ✅
- Seed script to assign meters to all users without meters
- Run: `pnpm seed:meters` (in api-gateway directory)
- Provides detailed statistics and results

### 3. **Admin Management Endpoints** ✅
Four new admin endpoints for meter management:
- `POST /api/v1/admin/meters/assign` - Manually assign specific meter
- `DELETE /api/v1/admin/meters/unassign/:userId` - Unassign meter from user
- `POST /api/v1/admin/meters/bulk-assign` - Trigger bulk assignment via API
- `GET /api/v1/admin/meters/stats` - Get meter assignment statistics

## How It Works

### Data Flow
```
1. Simulator generates readings → MTR-00000001, MTR-00000002, etc.
2. User registers → Auto-assigned MTR-00000003
3. Ingestion receives reading with meter_id → Stores in TimescaleDB
4. Stream Processor aggregates by meter_id
5. Billing queries user's meter_id → Matches consumption data
```

### Meter Assignment Logic
```typescript
// Service checks for next available meter
1. Query all assigned meters from users table
2. Search simulator range (MTR-00000001 to MTR-10000000)
3. Find first unassigned meter
4. Assign to user with region validation
5. Ensure uniqueness constraint (one meter per user)
```

## Usage

### For New Users (Automatic)
```bash
# Register a new user - meter assigned automatically
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "region": "Mumbai-North"
  }'

# Response includes assigned meter_id
{
  "success": true,
  "data": {
    "user": {
      "user_id": "uuid",
      "email": "john@example.com",
      "name": "John Doe",
      "meter_id": "MTR-00000003",  # Auto-assigned
      "region": "Mumbai-North"
    }
  }
}
```

### For Existing Users (Bulk Assignment)
```bash
# Run seed script
cd apps/api-gateway
pnpm seed:meters

# Output:
# [INFO] Starting bulk meter assignment script...
# [INFO] Found 5 users without meters. Starting assignment...
# [SUCCESS] Successfully assigned meters to 5 users:
#   1. user1@example.com → MTR-00000010 (Delhi-North)
#   2. user2@example.com → MTR-00000011 (Mumbai-South)
#   ...
```

### Admin Manual Assignment
```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@segs.com", "password": "admin123"}'

# Assign specific meter to user
curl -X POST http://localhost:3000/api/v1/admin/meters/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{
    "userId": "user-uuid",
    "meterId": "MTR-00000050",
    "region": "Bangalore-East"
  }'

# Get assignment statistics
curl -X GET http://localhost:3000/api/v1/admin/meters/stats \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# Response:
{
  "success": true,
  "data": {
    "stats": {
      "total_users": 100,
      "users_with_meters": 95,
      "users_without_meters": 5,
      "assignment_percentage": 95.0,
      "meters_by_region": [
        { "region": "Mumbai-North", "count": 25 },
        { "region": "Delhi-South", "count": 20 },
        ...
      ]
    }
  }
}
```

## Database Schema

### Users Table
```sql
-- meter_id column with unique constraint
meter_id VARCHAR(50) UNIQUE,
region VARCHAR(100),

-- Indexes
CREATE INDEX idx_users_meter_id ON users(meter_id);
CREATE INDEX idx_users_region ON users(region);
```

### Constraints
- `users.meter_id` is UNIQUE - one meter per user
- `users.meter_id` can be NULL - allows gradual assignment
- Foreign key relationships maintained for invoices, payments

## Files Created/Modified

### New Files
1. **`src/services/database/meter-assignment.service.ts`**
   - Core meter assignment logic
   - Functions: `getNextAvailableMeter()`, `assignMeterToUser()`, `bulkAssignMeters()`, `unassignMeterFromUser()`, `getMeterAssignmentStats()`

2. **`src/controllers/admin/meter-management.controller.ts`**
   - Admin API controllers for meter operations
   - 4 endpoints: assign, unassign, bulk-assign, stats

3. **`scripts/assign-meters-to-users.ts`**
   - Seed script for bulk assignment
   - Run via `pnpm seed:meters`

### Modified Files
1. **`src/controllers/auth/register.controller.ts`**
   - Added auto-assignment on registration
   - Graceful fallback if assignment fails

2. **`src/routes/adminRouter.ts`**
   - Mounted 4 new meter management endpoints
   - Kept legacy `/assign-meter` for backward compatibility

3. **`src/index.ts`**
   - Removed non-existent `operatorRouter` import

4. **`package.json`**
   - Added `seed:meters` script

## Testing

### Test Auto-Assignment
```bash
# 1. Register new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "region": "Delhi-North"
  }'

# 2. Verify meter was assigned
# Check response includes meter_id field
```

### Test Bulk Assignment
```bash
# 1. Create users without meters (temporarily disable auto-assign in code)
# 2. Run seed script
cd apps/api-gateway && pnpm seed:meters

# 3. Verify all users have meters
docker exec -i segs-postgres psql -U segs_user -d segs_db \
  -c "SELECT COUNT(*) FROM users WHERE meter_id IS NULL;"
# Should return 0
```

### Current Status
```bash
# Check current assignments
docker exec -i segs-postgres psql -U segs_user -d segs_db \
  -c "SELECT user_id, email, meter_id, region FROM users;"

# Output:
#                user_id                |        email         |   meter_id   |    region
# --------------------------------------+----------------------+--------------+--------------
#  3e95a66c-0a47-4fe7-b3d5-eb62e9a6d8c5 | omargade@gmail.com   | MTR-00000001 | Mumbai-North
#  93d38c1f-7b17-419e-9536-772392d23664 | omargade22@gmail.com | MTR-00000044 | Pune-West
```

## Benefits

✅ **Seamless User Experience**: Users get meters automatically on registration  
✅ **Admin Control**: Full management via API endpoints  
✅ **Bulk Operations**: Seed script for mass assignment  
✅ **Statistics & Monitoring**: Real-time assignment stats  
✅ **Region Awareness**: Assigns meters respecting user's region  
✅ **Data Integrity**: Unique constraints prevent duplicate assignments  
✅ **Backward Compatible**: Legacy endpoint still works  

## Integration with Billing

Now that all users have meters assigned:

1. **Simulator** generates readings for meters (MTR-00000001, MTR-00000044, etc.)
2. **Raw readings** stored in TimescaleDB with meter_id
3. **Billing queries** user's meter_id to calculate consumption
4. **Invoice endpoints** work seamlessly:
   - `GET /api/v1/billing/current-cycle` - Gets cycle info for user's meter
   - `GET /api/v1/billing/estimated` - Estimates bill based on meter consumption
   - `GET /api/v1/billing/invoices` - Lists invoices linked to user's meter

## Next Steps

1. **Start API Gateway**: `cd apps/api-gateway && pnpm start`
2. **Test Billing Endpoints**: All 12 invoice endpoints ready
3. **Optional**: Run simulator to generate readings for assigned meters
4. **Monitor**: Use admin stats endpoint to track assignments

## Troubleshooting

### User has no meter after registration
- Check registration logs for assignment errors
- Manually assign via admin endpoint
- Run bulk assignment script

### Meter already assigned error
- Verify meter_id uniqueness in database
- Check for duplicate assignments
- Use unassign endpoint if needed

### No available meters
- Extend simulator meter range in config
- Check database for actual availability
- Clean up unused meter assignments
