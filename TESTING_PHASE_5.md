# Phase 5: Tariff Routes Testing Guide

## Overview
Phase 5 implements 9 tariff-related endpoints:
- **5 User Routes**: Current tariff, regional tariff lookup, history, cost estimation, forecast
- **2 Operator Routes**: All regional tariffs, analytics
- **2 Admin Routes**: Create override, delete override

All routes require authentication. Operator routes require `operator` or `admin` role. Admin routes require `admin` role.

## Prerequisites

### 1. Services Running
```bash
# Check all services are running:
docker ps --filter "name=segs-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Required services:
# - segs-api-gateway (port 3000)
# - segs-tariff (port 3003)
# - segs-postgres (port 5432)
# - segs-redis (port 6379)
# - segs-kafka (port 9092)
```

### 2. Authentication Tokens
```bash
# Login as regular user (testuser@segs.com - Delhi-South region)
POST http://localhost:3000/api/v1/auth/login
{
  "email": "testuser@segs.com",
  "password": "Test123456"
}
# Copy the "access_token" from response

# For admin/operator tests, you'll need a user with appropriate role
```

### 3. Tariff Service Health Check
```bash
# Verify tariff service is responding:
curl http://localhost:3003/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## 📋 Test Routes

### **User Route 1: Get Current Tariff for User's Region**
**Endpoint**: `GET /api/v1/tariff/current`  
**Auth**: Required (any authenticated user)  
**Description**: Returns current tariff for the authenticated user's region

**Postman Setup**:
```
Method: GET
URL: http://localhost:3000/api/v1/tariff/current
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Current tariff retrieved successfully",
  "data": {
    "region": "Delhi-South",
    "tariff": {
      "id": "uuid",
      "region": "Delhi-South",
      "price": 5.25,
      "effective_from": "2025-01-15T10:30:00.000Z",
      "reason": null,
      "triggered_by": "automatic",
      "load_percentage": 65.5,
      "tier": "normal"
    }
  }
}
```

**Test Cases**:
- ✅ Valid token returns tariff
- ❌ No token returns 401 Unauthorized
- ❌ Invalid token returns 401 Unauthorized
- ❌ User without region returns 404 Not Found

---

### **User Route 2: Get Current Tariff for Specific Region**
**Endpoint**: `GET /api/v1/tariff/current/:region`  
**Auth**: Required (any authenticated user)  
**Description**: Returns current tariff for any specified region

**Postman Setup**:
```
Method: GET
URL: http://localhost:3000/api/v1/tariff/current/Mumbai-North
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Path Parameters**:
- `region` (string, required): One of the valid regions
  - Mumbai-North, Mumbai-South
  - Delhi-North, Delhi-South
  - Bangalore-East, Bangalore-West
  - Pune-East, Pune-West
  - Hyderabad-Central
  - Chennai-North

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Current tariff retrieved successfully",
  "data": {
    "region": "Mumbai-North",
    "tariff": {
      "id": "uuid",
      "region": "Mumbai-North",
      "price": 6.25,
      "effective_from": "2025-01-15T10:30:00.000Z",
      "reason": null,
      "triggered_by": "automatic",
      "load_percentage": 85.2,
      "tier": "high"
    }
  }
}
```

**Test Cases**:
- ✅ Valid region returns tariff
- ❌ Invalid region returns 400 Bad Request
- ❌ Non-existent region returns 404 Not Found (if no tariff data)

---

### **User Route 3: Get Tariff History**
**Endpoint**: `GET /api/v1/tariff/history`  
**Auth**: Required (any authenticated user)  
**Description**: Returns tariff history for user's region with pagination

**Postman Setup**:
```
Method: GET
URL: http://localhost:3000/api/v1/tariff/history?limit=20&offset=0
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters**:
- `limit` (integer, optional): Max records (1-100), default 10
- `offset` (integer, optional): Skip records, default 0

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Tariff history retrieved successfully",
  "data": {
    "region": "Delhi-South",
    "history": [
      {
        "id": "uuid-1",
        "region": "Delhi-South",
        "price": 5.25,
        "effective_from": "2025-01-15T10:30:00.000Z",
        "reason": null,
        "triggered_by": "automatic"
      },
      {
        "id": "uuid-2",
        "region": "Delhi-South",
        "price": 5.00,
        "effective_from": "2025-01-15T10:15:00.000Z",
        "reason": "Load reduction",
        "triggered_by": "automatic"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 20,
      "offset": 0
    }
  }
}
```

**Test Cases**:
- ✅ No parameters returns default 10 records
- ✅ Valid limit/offset returns paginated results
- ❌ limit > 100 returns validation error
- ❌ limit < 1 returns validation error
- ❌ negative offset returns validation error

---

### **User Route 4: Estimate Cost**
**Endpoint**: `GET /api/v1/tariff/estimate`  
**Auth**: Required (any authenticated user)  
**Description**: Estimates cost for given energy consumption

**Postman Setup**:
```
Method: GET
URL: http://localhost:3000/api/v1/tariff/estimate?consumption_kwh=150
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN

# With custom region:
URL: http://localhost:3000/api/v1/tariff/estimate?consumption_kwh=150&region=Mumbai-North
```

**Query Parameters**:
- `consumption_kwh` (number, required): Energy consumption in kWh (must be positive)
- `region` (string, optional): Specific region to estimate for (defaults to user's region)

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Cost estimated successfully",
  "data": {
    "region": "Delhi-South",
    "consumption_kwh": 150,
    "current_price_per_kwh": 5.25,
    "estimated_cost": 787.50,
    "tariff_details": {
      "effective_from": "2025-01-15T10:30:00.000Z",
      "tier": "normal",
      "load_percentage": 65.5
    }
  }
}
```

**Test Cases**:
- ✅ Valid consumption returns estimate
- ✅ Decimal consumption (e.g., 125.5 kWh) works
- ✅ Custom region parameter works
- ❌ Missing consumption_kwh returns validation error
- ❌ Negative consumption returns validation error
- ❌ consumption_kwh = 0 returns validation error
- ❌ Invalid region returns validation error

---

### **User Route 5: Forecast Tariff (Placeholder)**
**Endpoint**: `GET /api/v1/tariff/forecast`  
**Auth**: Required (any authenticated user)  
**Description**: Forecasts future tariff prices (placeholder for ML integration)

**Postman Setup**:
```
Method: GET
URL: http://localhost:3000/api/v1/tariff/forecast?hours=24
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters**:
- `hours` (integer, optional): Forecast duration in hours, default 24, max 48

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Tariff forecast generated (placeholder data)",
  "data": {
    "region": "Delhi-South",
    "current_price": 5.25,
    "forecast_hours": 24,
    "forecasts": [
      {
        "timestamp": "2025-01-15T11:00:00.000Z",
        "predicted_price": 5.40,
        "confidence": "low"
      },
      {
        "timestamp": "2025-01-15T12:00:00.000Z",
        "predicted_price": 5.15,
        "confidence": "low"
      }
      // ... 22 more hours
    ],
    "note": "This is placeholder data. ML-based forecasting will be implemented in a future version."
  }
}
```

**Test Cases**:
- ✅ Default (24 hours) returns forecast
- ✅ Custom hours parameter works
- ✅ Max 48 hours enforced
- ⚠️ Data is placeholder (not real predictions)

---

### **Operator Route 1: Get All Regional Tariffs**
**Endpoint**: `GET /api/v1/tariff/regions/all`  
**Auth**: Required (operator or admin role)  
**Description**: Returns current tariffs for all regions

**Postman Setup**:
```
Method: GET
URL: http://localhost:3000/api/v1/tariff/regions/all
Headers:
  Authorization: Bearer YOUR_OPERATOR_ACCESS_TOKEN
```

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Regional tariffs retrieved successfully",
  "data": {
    "total_regions": 10,
    "tariffs": {
      "Delhi-South": {
        "id": "uuid",
        "region": "Delhi-South",
        "price": 5.25,
        "effective_from": "2025-01-15T10:30:00.000Z",
        "reason": null,
        "triggered_by": "automatic",
        "load_percentage": 65.5,
        "tier": "normal"
      },
      "Mumbai-North": {
        "id": "uuid",
        "region": "Mumbai-North",
        "price": 6.25,
        "effective_from": "2025-01-15T10:30:00.000Z",
        "reason": null,
        "triggered_by": "automatic",
        "load_percentage": 85.2,
        "tier": "high"
      }
      // ... 8 more regions
    },
    "raw_data": [
      // Array format of same data
    ]
  }
}
```

**Test Cases**:
- ✅ Operator role can access
- ✅ Admin role can access
- ❌ Regular user (no operator/admin role) returns 403 Forbidden
- ❌ No auth token returns 401 Unauthorized

---

### **Operator Route 2: Get Tariff Analytics**
**Endpoint**: `GET /api/v1/tariff/analytics`  
**Auth**: Required (operator or admin role)  
**Description**: Analytics on tariff pricing across regions

**Postman Setup**:
```
Method: GET
URL: http://localhost:3000/api/v1/tariff/analytics
Headers:
  Authorization: Bearer YOUR_OPERATOR_ACCESS_TOKEN

# With filters:
URL: http://localhost:3000/api/v1/tariff/analytics?region=Delhi-South&start=2025-01-15T00:00:00Z&end=2025-01-15T23:59:59Z
```

**Query Parameters**:
- `start` (ISO datetime, optional): Start of analytics period
- `end` (ISO datetime, optional): End of analytics period
- `region` (string, optional): Filter to specific region

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Tariff analytics retrieved successfully",
  "data": {
    "filters": {
      "start": null,
      "end": null,
      "region": "all"
    },
    "summary": {
      "total_regions": 10,
      "avg_price": 5.45,
      "max_price": 6.25,
      "min_price": 4.75,
      "price_range": 1.50,
      "override_count": 2,
      "automatic_count": 8,
      "override_percentage": 20.0
    },
    "tier_distribution": {
      "critical": 1,
      "high": 2,
      "normal": 5,
      "low": 2,
      "very_low": 0
    },
    "region_breakdown": [
      {
        "region": "Delhi-South",
        "price": 5.25,
        "tier": "normal",
        "load_percentage": 65.5,
        "triggered_by": "automatic",
        "effective_from": "2025-01-15T10:30:00.000Z",
        "is_override": false
      }
      // ... 9 more regions
    ],
    "note": "Historical analytics not yet implemented. Showing current state only."
  }
}
```

**Test Cases**:
- ✅ No filters returns all regions
- ✅ Region filter returns single region analytics
- ⚠️ start/end parameters noted but historical not implemented yet
- ❌ Regular user returns 403 Forbidden

---

### **Admin Route 1: Create Tariff Override**
**Endpoint**: `POST /api/v1/tariff/override`  
**Auth**: Required (admin role only)  
**Description**: Manually override tariff price for a region

**Postman Setup**:
```
Method: POST
URL: http://localhost:3000/api/v1/tariff/override
Headers:
  Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
  Content-Type: application/json
Body (raw JSON):
```

**Request Body**:
```json
{
  "region": "Delhi-South",
  "newPrice": 7.50,
  "reason": "Emergency demand spike - manual intervention required for grid stability",
  "operatorId": "optional-operator-id"
}
```

**Body Parameters**:
- `region` (string, required): Valid region name
- `newPrice` (number, required): New price per kWh (0-100)
- `reason` (string, required): Justification (10-500 characters)
- `operatorId` (string, optional): ID of operator making change (auto-filled from JWT if not provided)

**Expected Response** (201 Created):
```json
{
  "status": "success",
  "message": "Tariff override created successfully",
  "data": {
    "override": {
      "id": "new-uuid",
      "region": "Delhi-South",
      "price": 7.50,
      "effective_from": "2025-01-15T10:45:00.000Z",
      "reason": "Emergency demand spike - manual intervention required for grid stability",
      "triggered_by": "manual"
    },
    "audit": {
      "operator_id": "admin-user-uuid",
      "operator_email": "admin@segs.com",
      "timestamp": "2025-01-15T10:45:00.000Z"
    }
  }
}
```

**Test Cases**:
- ✅ Valid override with all fields succeeds
- ✅ Operator ID auto-populated from JWT if not provided
- ✅ Audit trail logged with operator info
- ❌ Missing region returns 400 Bad Request
- ❌ Missing newPrice returns 400 Bad Request
- ❌ Missing reason returns 400 Bad Request
- ❌ Reason < 10 characters returns validation error
- ❌ Reason > 500 characters returns validation error
- ❌ newPrice < 0 returns validation error
- ❌ newPrice > 100 returns validation error
- ❌ Invalid region returns validation error
- ❌ Operator role (non-admin) returns 403 Forbidden
- ❌ Regular user returns 403 Forbidden

---

### **Admin Route 2: Remove Tariff Override**
**Endpoint**: `DELETE /api/v1/tariff/override/:tariffId`  
**Auth**: Required (admin role only)  
**Description**: Remove manual override, revert to automatic pricing

**Postman Setup**:
```
Method: DELETE
URL: http://localhost:3000/api/v1/tariff/override/TARGET_TARIFF_UUID
Headers:
  Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
```

**Path Parameters**:
- `tariffId` (UUID, required): ID of the tariff override to remove

**Expected Response** (200 OK):
```json
{
  "status": "success",
  "message": "Tariff override removed successfully",
  "data": {
    "tariff_id": "TARGET_TARIFF_UUID",
    "reverted_to_automatic": true,
    "audit": {
      "operator_id": "admin-user-uuid",
      "operator_email": "admin@segs.com",
      "timestamp": "2025-01-15T10:50:00.000Z"
    }
  }
}
```

**Test Cases**:
- ✅ Valid tariff ID removes override
- ✅ Audit trail logged
- ❌ Invalid UUID format returns 400 Bad Request
- ❌ Non-existent tariff ID returns 404 Not Found (or similar error from tariff service)
- ❌ Operator role (non-admin) returns 403 Forbidden
- ❌ Regular user returns 403 Forbidden

---

## 🧪 Testing Workflow

### Step 1: User Routes (testuser@segs.com)
1. Login and get access token
2. Test GET /current (should return Delhi-South tariff)
3. Test GET /current/Mumbai-North (different region)
4. Test GET /history?limit=5
5. Test GET /estimate?consumption_kwh=100
6. Test GET /forecast?hours=12

### Step 2: Operator Routes (requires operator/admin account)
1. Login as operator/admin
2. Test GET /regions/all
3. Test GET /analytics
4. Test GET /analytics?region=Delhi-South

### Step 3: Admin Routes (requires admin account)
1. Login as admin
2. Test POST /override with valid payload
3. Copy the tariff ID from response
4. Test DELETE /override/:tariffId
5. Verify tariff reverted with GET /current/:region

### Step 4: Error Cases
1. Test all routes without auth token (expect 401)
2. Test operator/admin routes as regular user (expect 403)
3. Test validation errors (invalid regions, negative consumption, etc.)

---

## 📊 Success Criteria

**Phase 5 Complete When:**
- ✅ All 9 routes return proper responses
- ✅ Authentication enforced on all routes
- ✅ Role-based authorization working (operator, admin)
- ✅ Validation schemas rejecting invalid input
- ✅ Tariff service integration functional
- ✅ Error handling returns clear messages
- ✅ Audit logging for admin actions
- ✅ Cost estimation calculations correct

**Expected Results:**
- 5/5 user routes working
- 2/2 operator routes working
- 2/2 admin routes working
- **Total: 9/9 routes functional**

---

## 🐛 Troubleshooting

### Tariff Service Not Responding
```bash
# Check service health:
docker logs segs-tariff --tail 50

# Restart if needed:
docker-compose restart tariff
```

### 404 Not Found on Tariff Routes
```bash
# Verify API Gateway has tariff routes:
docker logs segs-api-gateway --tail 50 | grep -i tariff

# Rebuild if needed:
docker-compose up -d --build api-gateway
```

### No Tariff Data Available
The tariff service auto-populates tariffs based on Kafka consumption of 1m aggregates.
If no data exists:
```bash
# Ensure stream processor is running and producing aggregates
docker logs segs-stream-processor --tail 20

# Check Kafka topics:
docker exec segs-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Admin/Operator Account Needed
If you don't have an admin account, create one via database:
```bash
# Connect to PostgreSQL:
docker exec -it segs-postgres psql -U segs_user -d segs_db

# Update user role:
UPDATE users SET role = 'admin' WHERE email = 'testuser@segs.com';
```

---

## 📝 Notes

- **Forecast endpoint** returns placeholder data until ML model is integrated
- **Historical analytics** (start/end date filters) show current state only - time-series analytics not yet implemented
- **Tariff service** uses dynamic pricing based on regional load (5 tiers: Very Low, Low, Normal, High, Critical)
- **Base price**: ₹5.00/kWh with multipliers ranging from -20% to +25%
- **Audit logging**: All admin override actions are logged with operator ID, email, and timestamp

---

## ✅ Checklist

- [ ] Login as regular user, get access token
- [ ] Test all 5 user routes
- [ ] Login as operator/admin, get access token
- [ ] Test 2 operator routes
- [ ] Test 2 admin routes (create & delete override)
- [ ] Verify error cases (401, 403, 400)
- [ ] Confirm tariff service responding correctly
- [ ] Document any issues or discrepancies

**Phase 5 Testing Complete:** ___/9 routes working
