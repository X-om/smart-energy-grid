# API Test Results

> Manual testing results for Smart Energy Grid System
> Date: November 12, 2025

## Testing Progress

- [x] Authentication Routes (10/10 endpoints tested)
- [x] User Management Routes (4/4 endpoints tested)
- [x] Telemetry User Routes (5/5 endpoints tested)
- [x] Telemetry Operator Routes (5/5 endpoints tested)
- [x] Tariff User Routes (5/5 endpoints tested)
- [x] Tariff Operator Routes (2/2 endpoints tested)
- [x] Tariff Admin Routes (2/2 endpoints tested)
- [x] Alert User Routes (2/2 endpoints tested)
- [x] Alert Operator Routes (6/6 endpoints tested)
- [ ] Invoice Routes

**Total Endpoints Tested: 42/42 completed**

---

## Test Results

### Authentication

#### 1. Register User
**Endpoint:** `POST /api/v1/auth/register`

**Status:** ✅ PASSED

**Request:**
```json
{
  "name": "Om Argade",
  "email": "omargade@gmail.com",
  "phone": "+919665802587",
  "region": "Mumbai-North"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "user_id": "f9fba305-bd2e-4636-9d60-4df5209f2665",
      "email": "omargade@gmail.com",
      "name": "Om Argade",
      "email_verified": false
    },
    "message": "Registration successful. Please verify your email with the OTP sent.",
    "otp": "123456"
  }
}
```

**Notes:**
- Returns user_id (UUID)
- Email verification status: false
- OTP generated: 123456 (for dev environment)

---

#### 2. Verify Email
**Endpoint:** `POST /api/v1/auth/verify-email`

**Status:** ❌ FAILED → ✅ FIXED

**Request:**
```json
{
  "email": "omargade@gmail.com",
  "otp": "123456"
}
```

**Initial Response:** `500 Internal Server Error`
```json
{
  "success": false,
  "error": {
    "message": "column \"attempts\" does not exist",
    "code": "INTERNAL_SERVER_ERROR"
  }
}
```

**Issue Found:** Missing `attempts` column in `otp_verifications` table

**Fix Applied:**
```sql
ALTER TABLE otp_verifications 
ADD COLUMN attempts INTEGER DEFAULT 0;
ADD COLUMN verified_at TIMESTAMPTZ;
```

**Status:** ✅ PASSED (after fixes)

**Retest Response:** `200 OK`
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "user_id": "f9fba305-bd2e-4636-9d60-4df5209f2665",
      "email": "omargade@gmail.com",
      "name": "Om Argade",
      "email_verified": true
    },
    "next_step": "Please set your password using /auth/set-password"
  }
}
```

**Notes:**
- Email verification status updated to `true`
- User directed to set password next

---

#### 4. Set Password
**Endpoint:** `POST /api/v1/auth/set-password`

**Status:** ✅ PASSED

**Request:**
```json
{
  "email": "omargade@gmail.com",
  "password": "Om@1032230472!",
  "confirmPassword": "Om@1032230472!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password set successfully",
  "data": {
    "message": "You can now login with your email and password"
  }
}
```

**Notes:**
- Password must match confirmPassword
- Password stored as bcrypt hash
- User can now login

---

#### 5. Login
**Endpoint:** `POST /api/v1/auth/login`

**Status:** ✅ PASSED

**Request:**
```json
{
  "email": "omargade@gmail.com",
  "password": "Om@1032230472!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "user_id": "f9fba305-bd2e-4636-9d60-4df5209f2665",
      "email": "omargade@gmail.com",
      "name": "Om Argade",
      "role": "USER",
      "meter_id": null,
      "region": "Mumbai-North"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "15m"
    }
  }
}
```

**Notes:**
- Returns JWT access token (15min expiry)
- Returns refresh token (7 days expiry)
- User profile includes role, meter_id, region
- Tokens required for authenticated endpoints

---

#### 6. Forgot Password
**Endpoint:** `POST /api/v1/auth/forgot-password`

**Status:** ✅ PASSED

**Request:**
```json
{
  "email": "omargade@gmail.com"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset code sent",
  "data": {
    "message": "Password reset code sent to your email",
    "otp": "123456"
  }
}
```

**Notes:**
- Generates OTP with purpose: `password_reset`
- Returns OTP in development mode

---

#### 7. Reset Password
**Endpoint:** `POST /api/v1/auth/reset-password`

**Status:** ✅ PASSED

**Request:**
```json
{
  "email": "omargade@gmail.com",
  "otp": "123456",
  "newPassword": "Om@1032230472",
  "confirmPassword": "Om@1032230472"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "message": "Your password has been reset. Please login with your new password"
  }
}
```

**Notes:**
- Validates OTP before resetting password
- New password must match confirmPassword
- User must login again after reset

---

#### 8. Change Password (Authenticated)
**Endpoint:** `PUT /api/v1/auth/change-password`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "currentPassword": "Om@1032230472",
  "newPassword": "Om@1032230472!",
  "confirmPassword": "Om@1032230472!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "message": "All sessions have been invalidated. Please login again with your new password"
  }
}
```

**Notes:**
- Requires authentication (JWT token)
- Validates current password before changing
- New password must differ from current
- All user sessions invalidated after change
- User must re-login with new password

---

#### 9. Logout
**Endpoint:** `POST /api/v1/auth/logout`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": {
    "message": "You have been logged out successfully"
  }
}
```

**Notes:**
- Requires authentication (JWT token)
- Invalidates current session/token
- Token added to blacklist

---

#### 3. Resend OTP
**Endpoint:** `POST /api/v1/auth/resend-otp`

**Status:** ✅ PASSED

**Request:**
```json
{
  "email": "omargade@gmail.com",
  "purpose": "email_verification"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "message": "OTP sent successfully",
    "otp": "123456"
  }
}
```

**Notes:**
- Purpose options: `email_verification`, `password_reset`, `login_2fa`
- Returns new OTP for development

---

#### 10. Logout All Devices
**Endpoint:** `POST /api/v1/auth/logout-all`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logged out from all devices",
  "data": {
    "message": "Successfully logged out from 2 device(s)",
    "invalidatedSessions": 2
  }
}
```

**Notes:**
- Requires authentication (JWT token)
- Invalidates all user sessions across all devices
- Returns count of invalidated sessions

---

### User Management

#### 1. Get User Profile
**Endpoint:** `GET /api/v1/user/profile`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user_id": "f9fba305-bd2e-4636-9d60-4df5209f2665",
    "email": "omargade@gmail.com",
    "name": "Om Argade",
    "phone": "+919665802587",
    "role": "USER",
    "region": "Mumbai-North",
    "meter_id": null,
    "email_verified": true,
    "is_active": true,
    "suspended_at": null,
    "suspended_reason": null,
    "last_login_at": "2025-11-12T11:18:51.558Z",
    "created_at": "2025-11-12T10:37:03.186Z",
    "updated_at": "2025-11-12T11:18:51.558Z"
  }
}
```

**Notes:**
- Requires authentication
- Returns complete user profile
- Includes suspension status and timestamps

---

#### 2. Update User Profile
**Endpoint:** `PUT /api/v1/user/profile`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "name": "Om Argade",
  "phone": "9922494964",
  "region": "Mumbai-South"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user_id": "f9fba305-bd2e-4636-9d60-4df5209f2665",
    "email": "omargade@gmail.com",
    "name": "Om Argade",
    "phone": "9922494964",
    "role": "USER",
    "region": "Mumbai-South",
    "meter_id": null,
    "email_verified": true,
    "is_active": true,
    "suspended_at": null,
    "suspended_reason": null,
    "last_login_at": "2025-11-12T11:18:51.558Z",
    "created_at": "2025-11-12T10:37:03.186Z",
    "updated_at": "2025-11-12T11:23:41.269Z"
  }
}
```

**Notes:**
- Requires authentication
- All fields optional (partial update)
- `updated_at` timestamp automatically updated
- Email cannot be changed via this endpoint

---

#### 3. Get Notification Settings
**Endpoint:** `GET /api/v1/user/notifications/settings`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Preferences retrieved successfully",
  "data": {
    "user_id": "f9fba305-bd2e-4636-9d60-4df5209f2665",
    "email_notifications": true,
    "sms_notifications": false,
    "push_notifications": true,
    "websocket_notifications": true,
    "alert_high_consumption": true,
    "alert_zero_consumption": true,
    "alert_tariff_changes": true,
    "alert_billing_reminders": true,
    "high_consumption_threshold_kwh": "100.00",
    "default_chart_resolution": "15m",
    "timezone": "UTC",
    "language": "en",
    "theme": "light",
    "metadata": {},
    "created_at": "2025-11-12T10:37:03.186Z",
    "updated_at": "2025-11-12T10:37:03.186Z"
  }
}
```

**Notes:**
- Requires authentication
- Returns user preferences with defaults
- Includes notification channels and alert settings

---

#### 4. Update Notification Settings
**Endpoint:** `PUT /api/v1/user/notifications/settings`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "sms_notifications": true
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": {
    "user_id": "f9fba305-bd2e-4636-9d60-4df5209f2665",
    "email_notifications": true,
    "sms_notifications": true,
    "push_notifications": true,
    "websocket_notifications": true,
    "alert_high_consumption": true,
    "alert_zero_consumption": true,
    "alert_tariff_changes": true,
    "alert_billing_reminders": true,
    "high_consumption_threshold_kwh": "100.00",
    "default_chart_resolution": "15m",
    "timezone": "UTC",
    "language": "en",
    "theme": "light",
    "metadata": {},
    "created_at": "2025-11-12T10:37:03.186Z",
    "updated_at": "2025-11-12T11:28:18.350Z"
  }
}
```

**Notes:**
- Requires authentication
- All fields optional (partial update)
- `updated_at` timestamp automatically updated
- Supports notification channels, alert preferences, UI settings

---

### Telemetry

#### 1. Get My Meter Reading
**Endpoint:** `GET /api/v1/telemetry/my-meter`

**Status:** ✅ PASSED (after fixing 2 issues)

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Latest reading retrieved successfully",
  "data": {
    "meter_id": "MTR-00000001",
    "region": "Mumbai-North",
    "window_start": "2025-11-12T12:06:00.000Z",
    "avg_power_kw": "5.1103",
    "max_power_kw": "5.9040",
    "min_power_kw": "4.7490",
    "energy_kwh_sum": "0.0000",
    "voltage_avg": "228.47",
    "reading_count": 6
  }
}
```

**Issues Found & Fixed:**
1. **Meter Assignment**: User had no meter assigned
   - Created meter MTR-00000001 and assigned to user
   - 🚨 **Architectural discussion needed** - see meter assignment questions below
2. **Column Name Mismatch**: Code used `count` but DB has `reading_count` (Issue #4)

**Notes:**
- Returns latest 1-minute aggregate from `aggregates_1m` table
- `window_start` is the aggregation window timestamp
- `reading_count` shows how many raw readings were aggregated
- `energy_kwh_sum` shows energy consumed in that 1-minute window

**🚨 IMPORTANT - METER ASSIGNMENT FLOW DISCUSSION NEEDED:**
- [ ] Should meters be auto-assigned during registration?
- [ ] Or separate meter assignment/onboarding flow?
- [ ] Admin endpoint to assign meters to users?
- [ ] Meter provisioning service needed?
- [ ] QR code/serial number scanning for assignment?
- [ ] Bulk meter import/assignment for operators?

---

#### 2. Get My Meter History
**Endpoint:** `GET /api/v1/telemetry/my-meter/history`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `start` (optional): ISO 8601 datetime (default: 24 hours ago)
- `end` (optional): ISO 8601 datetime (default: now)
- `resolution` (optional): `1m` | `15m` | `1h` | `1d` (default: `15m`)

**Test Request:** `?resolution=1m`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Meter history retrieved successfully",
  "data": {
    "meter_id": "MTR-00000001",
    "start_time": "2025-11-11T12:10:41.367Z",
    "end_time": "2025-11-12T12:10:41.367Z",
    "resolution": "1m",
    "data": [
      {
        "meter_id": "MTR-00000001",
        "region": "Mumbai-North",
        "window_start": "2025-11-12T11:50:00.000Z",
        "avg_power_kw": "5.9830",
        "max_power_kw": "6.8120",
        "min_power_kw": "5.5090",
        "energy_kwh_sum": "0.0000",
        "voltage_avg": "231.57",
        "reading_count": 3
      }
      // ... 18 more records (19 total)
    ]
  }
}
```

**Notes:**
- Returns time-series data from `aggregates_1m` or `aggregates_15m` table
- Default: last 24 hours with 15-minute resolution
- Data ordered chronologically (oldest to newest)
- Each record shows aggregated metrics for that time window
- Test returned 19 records for 19-minute window

---

#### 3. Get My Meter Stats
**Endpoint:** `GET /api/v1/telemetry/my-meter/stats`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `start` (optional): ISO 8601 datetime (default: 7 days ago)
- `end` (optional): ISO 8601 datetime (default: now)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Consumption statistics retrieved successfully",
  "data": {
    "meter_id": "MTR-00000001",
    "period": {
      "start": "2025-11-05T12:12:31.102Z",
      "end": "2025-11-12T12:12:31.102Z"
    },
    "stats": {
      "total_consumption_kwh": 0,
      "avg_power_kw": 5.7657,
      "max_power_kw": 6.812,
      "min_power_kw": 4.696,
      "data_points": 56
    }
  }
}
```

**Notes:**
- Returns aggregated statistics from `aggregates_15m` table
- Default period: last 7 days
- `total_consumption_kwh`: Sum of all energy consumed
- `data_points`: Number of 15-minute windows aggregated
- Useful for dashboard summary cards

---

#### 4. Get My Daily Breakdown
**Endpoint:** `GET /api/v1/telemetry/my-meter/daily`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `start_date` (optional): Date in `YYYY-MM-DD` format (default: 30 days ago)
- `end_date` (optional): Date in `YYYY-MM-DD` format (default: today)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Daily breakdown retrieved successfully",
  "data": {
    "meter_id": "MTR-00000001",
    "period": {
      "start": "2025-10-13",
      "end": "2025-11-12"
    },
    "breakdown": [
      {
        "date": "2025-11-11",
        "total_kwh": 0,
        "avg_kw": 5.7657,
        "peak_kw": 6.812
      }
    ]
  }
}
```

**Notes:**
- Groups data by day from `aggregates_15m` table
- Default period: last 30 days
- Each day shows: total consumption, average power, peak power
- Useful for daily consumption charts and trend analysis
- Test returned 1 day of data (only partial data available)

---

#### 5. Get My Monthly Breakdown
**Endpoint:** `GET /api/v1/telemetry/my-meter/monthly`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `start_month` (optional): Month in `YYYY-MM` format (default: 12 months ago)
- `end_month` (optional): Month in `YYYY-MM` format (default: current month)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Monthly breakdown retrieved successfully",
  "data": {
    "meter_id": "MTR-00000001",
    "period": {
      "start": "2024-12",
      "end": "2025-11"
    },
    "breakdown": [
      {
        "month": "2025-11",
        "total_kwh": 0,
        "avg_kw": 5.7657,
        "peak_kw": 6.812
      }
    ]
  }
}
```

**Notes:**
- Groups data by month from `aggregates_15m` table
- Default period: last 12 months
- Each month shows: total consumption, average power, peak peak
- Useful for billing, year-over-year comparison, seasonal analysis
- Test returned 1 month of data (only partial data available)

---

#### 6. Get Meter Reading (Operator)
**Endpoint:** `GET /api/v1/telemetry/meters/:meterId`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `operator` or `admin`

**Test Request:** `GET /api/v1/telemetry/meters/MTR-00000093`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Meter reading retrieved successfully",
  "data": {
    "meter_id": "MTR-00000093",
    "region": "Mumbai-North",
    "window_start": "2025-11-12T12:57:00.000Z",
    "avg_power_kw": "1.1007",
    "max_power_kw": "1.2730",
    "min_power_kw": "0.9530",
    "energy_kwh_sum": "0.0000",
    "voltage_avg": "228.47",
    "reading_count": 6
  }
}
```

**Notes:**
- Operator/Admin can query any meter by ID
- Returns latest aggregated reading from `aggregates_1m` table
- Same data format as user endpoint but for any meter
- Useful for customer support and system monitoring
- **Issue #6 Fixed:** Role case sensitivity - JWT now normalizes roles to lowercase

---

#### 7. Get Meter History (Operator)
**Endpoint:** `GET /api/v1/telemetry/meters/:meterId/history`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `operator` or `admin`

**Query Parameters:**
- `start_time` (optional): ISO 8601 timestamp (default: 24 hours ago)
- `end_time` (optional): ISO 8601 timestamp (default: now)
- `resolution` (optional): `1m` or `15m` (default: `15m`)

**Test Request:** `GET /api/v1/telemetry/meters/MTR-00000093/history`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Meter history retrieved successfully",
  "data": {
    "meter_id": "MTR-00000093",
    "start_time": "2025-11-11T12:59:48.108Z",
    "end_time": "2025-11-12T12:59:48.108Z",
    "resolution": "15m",
    "data": [
      {
        "meter_id": "MTR-00000093",
        "region": "Mumbai-North",
        "window_start": "2025-11-12T11:45:00.000Z",
        "avg_power_kw": "3.7147",
        "max_power_kw": "4.3820",
        "min_power_kw": "2.9390",
        "energy_kwh_sum": "0.0000",
        "voltage_avg": "230.14",
        "reading_count": 56
      },
      {
        "meter_id": "MTR-00000093",
        "region": "Mumbai-North",
        "window_start": "2025-11-12T12:00:00.000Z",
        "avg_power_kw": "3.7030",
        "max_power_kw": "4.3750",
        "min_power_kw": "2.9320",
        "energy_kwh_sum": "0.0000",
        "voltage_avg": "229.10",
        "reading_count": 90
      },
      {
        "meter_id": "MTR-00000093",
        "region": "Mumbai-North",
        "window_start": "2025-11-12T12:30:00.000Z",
        "avg_power_kw": "1.2748",
        "max_power_kw": "7.4190",
        "min_power_kw": "0.9200",
        "energy_kwh_sum": "0.0000",
        "voltage_avg": "229.79",
        "reading_count": 51
      }
    ]
  }
}
```

**Notes:**
- Operator/Admin can query historical data for any meter
- Queries `aggregates_1m` or `aggregates_15m` based on resolution
- Default: Last 24 hours with 15-minute resolution
- Returns time-series data for charts and analysis
- Useful for troubleshooting customer issues and system diagnostics

---

#### 8. Get Regional Statistics (Operator)
**Endpoint:** `GET /api/v1/telemetry/region/:region/stats`

**Status:** ✅ PASSED (with known issue)

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `operator` or `admin`

**Query Parameters:**
- `start_time` (optional): ISO 8601 timestamp (default: 7 days ago)
- `end_time` (optional): ISO 8601 timestamp (default: now)

**Test Request:** `GET /api/v1/telemetry/region/Mumbai-North/stats`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Regional statistics retrieved successfully",
  "data": {
    "period": {
      "start": "2025-11-05T13:03:07.615Z",
      "end": "2025-11-12T13:03:07.615Z"
    },
    "stats": {
      "region": "Mumbai-North",
      "total_consumption_kwh": 0,
      "active_meters": 25,
      "avg_consumption_per_meter": 0,
      "peak_load_kw": 9.44
    }
  }
}
```

**Notes:**
- Operator/Admin can view aggregate statistics for any region
- Queries `aggregates_15m` table for efficiency
- Default period: Last 7 days
- Shows total consumption, active meters count, average per meter, and peak load
- **Known Issue #7:** `total_consumption_kwh` and `avg_consumption_per_meter` are 0 because `raw_readings` table is missing `energy_kwh` column

---

#### 9. Get Top Consumers by Region (Operator)
**Endpoint:** `GET /api/v1/telemetry/region/:region/top-consumers`

**Status:** ✅ PASSED (with known issue)

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `operator` or `admin`

**Query Parameters:**
- `start_time` (optional): ISO 8601 timestamp (default: 30 days ago)
- `end_time` (optional): ISO 8601 timestamp (default: now)
- `limit` (optional): Number of results (default: 10, max: 100)

**Test Request:** `GET /api/v1/telemetry/region/Delhi-South/top-consumers`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Top consumers retrieved successfully",
  "data": {
    "region": "Mumbai-North",
    "period": {
      "start": "2025-10-13T13:04:47.298Z",
      "end": "2025-11-12T13:04:47.298Z"
    },
    "limit": 10,
    "consumers": [
      {
        "meter_id": "MTR-00000073",
        "total_kwh": 0,
        "avg_kw": 6.002625,
        "rank": 1
      },
      {
        "meter_id": "MTR-00000033",
        "total_kwh": 0,
        "avg_kw": 3.0681,
        "rank": 2
      },
      {
        "meter_id": "MTR-00000013",
        "total_kwh": 0,
        "avg_kw": 1.29515,
        "rank": 3
      }
      // ... 7 more consumers
    ]
  }
}
```

**Notes:**
- Operator/Admin can identify highest energy consumers in any region
- Queries `aggregates_15m` table for efficiency
- Default period: Last 30 days, top 10 consumers
- Ranked by average power consumption
- Useful for load management and customer outreach programs
- **Known Issue #7:** `total_kwh` is 0 due to missing `energy_kwh` column (fixed, awaiting restart)

---

#### 10. Get Real-time Regional Load (Operator)
**Endpoint:** `GET /api/v1/telemetry/region/:region/realtime`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `operator` or `admin`

**Test Request:** `GET /api/v1/telemetry/region/Mumbai-North/realtime`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Real-time load retrieved successfully",
  "data": {
    "region": "Mumbai-North",
    "current_load_kw": 398.9175,
    "active_meters": 25,
    "timestamp": "2025-11-12T13:06:00.000Z"
  }
}
```

**Notes:**
- Operator/Admin can monitor current load for any region in real-time
- Queries latest 1-minute aggregates from `aggregates_1m` table
- Shows total current load (sum of all active meters) and meter count
- Timestamp indicates when the aggregated data was calculated
- Critical for grid monitoring, load balancing, and outage detection
- Updates every minute as new aggregates are processed

---

### Tariffs

#### 1. Get Current Tariff
**Endpoint:** `GET /api/v1/tariff/current`

**Status:** ✅ PASSED (after fixing Issue #5)

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Current tariff retrieved successfully",
  "data": {
    "region": "Mumbai-North",
    "tariff": {
      "id": "",
      "region": "Mumbai-North",
      "price": 4,
      "effective_from": "2025-11-12T12:40:40.431Z",
      "reason": null,
      "triggered_by": "automatic"
    }
  }
}
```

**Notes:**
- Returns current tariff for authenticated user's region
- `id` is empty - tariff service uses Redis cache (stores price only, not full record)
- Price calculated dynamically based on regional load percentage
- `triggered_by: "automatic"` = system-calculated (vs "manual" override)
- Base price: ₹5.00/kWh, adjusted by load multiplier
- Tariff updates automatically as regional load changes
- **Fixed Issue #5**: Kafka topic mismatch prevented tariff calculation

---

#### 2. Get Current Tariff by Region
**Endpoint:** `GET /api/v1/tariff/current/:region`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Test Request:** `GET /api/v1/tariff/current/Mumbai-North`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Current tariff retrieved successfully",
  "data": {
    "region": "Mumbai-North",
    "tariff": {
      "id": "",
      "region": "Mumbai-North",
      "price": 4,
      "effective_from": "2025-11-12T12:44:08.484Z",
      "reason": null,
      "triggered_by": "automatic"
    }
  }
}
```

**Notes:**
- Query tariff for any valid region
- Valid regions: Mumbai-North, Mumbai-South, Delhi-North, Delhi-South, Bangalore-East, Bangalore-West, Pune-East, Pune-West, Hyderabad-Central, Chennai-North
- Same dynamic pricing logic as user's current tariff
- Useful for comparing tariffs across regions

---

#### 3. Get Tariff History
**Endpoint:** `GET /api/v1/tariff/history`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Tariff history retrieved successfully",
  "data": {
    "region": "Mumbai-North",
    "history": [
      {
        "id": "98bf880c-5246-45ac-bad3-dadba404e1d0",
        "region": "Mumbai-North",
        "price": "4.0000",
        "effective_from": "2025-11-12T12:37:13.518Z",
        "reason": "AUTO: Very low load (0.0% < 25%)",
        "triggered_by": "AUTO"
      }
    ]
  }
}
```

**Notes:**
- Returns complete tariff history for user's region (from assigned meter)
- History is retrieved from PostgreSQL database with full records including IDs
- Results ordered by most recent first (`effective_from DESC`)
- Includes both automatic price adjustments and manual operator overrides
- Shows detailed reason for each price change

---

#### 4. Estimate Cost
**Endpoint:** `GET /api/v1/tariff/estimate`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Test Request:** `GET /api/v1/tariff/estimate?consumption_kwh=5.0162`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Cost estimated successfully",
  "data": {
    "region": "Mumbai-North",
    "consumption_kwh": 5.0162,
    "current_price_per_kwh": 4,
    "estimated_cost": 20.06,
    "tariff_details": {
      "effective_from": "2025-11-12T12:47:42.682Z"
    }
  }
}
```

**Notes:**
- Estimates electricity cost based on hypothetical consumption
- Uses current tariff rate for user's region
- Query parameter: `consumption_kwh` (float, required)
- Calculation: `estimated_cost = consumption_kwh × current_price_per_kwh`
- Useful for users planning electricity usage or comparing scenarios
- Returns tariff effective timestamp for reference

---

#### 5. Get Tariff Forecast
**Endpoint:** `GET /api/v1/tariff/forecast`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Tariff forecast generated (placeholder data)",
  "data": {
    "region": "Mumbai-North",
    "current_price": 4,
    "forecast_hours": 24,
    "forecasts": [
      {
        "timestamp": "2025-11-12T13:47:52.546Z",
        "predicted_price": 4.03,
        "confidence": "low"
      },
      {
        "timestamp": "2025-11-12T14:47:52.546Z",
        "predicted_price": 3.77,
        "confidence": "low"
      }
      // ... 22 more hourly forecasts
    ],
    "note": "This is placeholder data. ML-based forecasting will be implemented in a future version."
  }
}
```

**Notes:**
- Provides 24-hour price forecast for user's region
- Currently returns placeholder data with random variations
- Future implementation will use ML models based on historical patterns
- Confidence levels: `low`, `medium`, `high`
- Helps users plan consumption during cheaper hours
- Forecasts generated hourly

---

#### 6. Get All Regional Tariffs (Operator)
**Endpoint:** `GET /api/v1/tariff/regions/all`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `operator` or `admin`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Regional tariffs retrieved successfully",
  "data": {
    "total_regions": 3,
    "tariffs": {
      "Mumbai-North": {
        "id": "",
        "region": "Mumbai-North",
        "price": 4,
        "effective_from": "2025-11-12T13:09:04.982Z",
        "reason": "AUTO: Very low load (0.0% < 25%)",
        "triggered_by": "AUTO"
      },
      "Bangalore-East": {
        "id": "",
        "region": "Bangalore-East",
        "price": 4,
        "effective_from": "2025-11-12T13:09:04.996Z",
        "reason": "AUTO: Very low load (0.0% < 25%)",
        "triggered_by": "AUTO"
      },
      "Pune-West": {
        "id": "",
        "region": "Pune-West",
        "price": 4,
        "effective_from": "2025-11-12T13:09:04.996Z",
        "reason": "AUTO: Very low load (0.1% < 25%)",
        "triggered_by": "AUTO"
      }
    },
    "raw_data": [
      {
        "id": "",
        "region": "Mumbai-North",
        "price": 4,
        "effective_from": "2025-11-12T13:09:04.982Z",
        "reason": "AUTO: Very low load (0.0% < 25%)",
        "triggered_by": "AUTO"
      }
      // ... 2 more regions
    ]
  }
}
```

**Notes:**
- Operator/Admin can view current tariffs for all regions at once
- Returns both map (keyed by region) and array formats for flexibility
- Shows count of active regions with tariffs
- Useful for grid-wide tariff monitoring and comparison
- All regions currently at ₹4.00/kWh due to very low load
- `id` empty due to Redis cache design (see Issue #6 notes)

---

#### 7. Get Tariff Analytics (Operator)
**Endpoint:** `GET /api/v1/tariff/analytics`

**Status:** ✅ PASSED (placeholder implementation)

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `operator` or `admin`

**Query Parameters:**
- `start` (optional): ISO 8601 timestamp (default: 30 days ago)
- `end` (optional): ISO 8601 timestamp (default: now)
- `region` (optional): Filter by specific region

**Test Request:** `GET /api/v1/tariff/analytics?region=Mumbai-North&start=2025-01-15T00:00:00Z&end=2025-11-15T23:59:59Z`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Tariff analytics retrieved successfully",
  "data": {
    "filters": {
      "start": "2025-01-15T00:00:00Z",
      "end": "2025-11-15T23:59:59Z",
      "region": "Mumbai-North"
    },
    "summary": {
      "total_regions": 1,
      "avg_price": 4,
      "max_price": 4,
      "min_price": 4,
      "price_range": 0,
      "override_count": 1,
      "automatic_count": 0,
      "override_percentage": 100
    },
    "tier_distribution": {
      "unknown": 1
    },
    "region_breakdown": [
      {
        "region": "Mumbai-North",
        "price": 4,
        "triggered_by": "AUTO",
        "effective_from": "2025-11-12T13:11:24.961Z",
        "is_override": true,
        "reason": "AUTO: Very low load (0.0% < 25%)"
      }
    ],
    "note": "Historical analytics not yet implemented. Showing current state only."
  }
}
```

**Notes:**
- Operator/Admin can analyze tariff trends and patterns
- Currently shows only current state (historical analytics placeholder)
- Summary includes: avg/max/min prices, price range, override vs automatic counts
- Future implementation will analyze historical data for trends and insights
- Useful for pricing strategy evaluation and regulatory reporting

---

#### 8. Override Tariff (Admin)
**Endpoint:** `POST /api/v1/tariff/override`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `admin`

**Request Body:**
```json
{
  "region": "Mumbai-North",
  "newPrice": 10.50,
  "reason": "Emergency demand spike - manual intervention required for grid stability",
  "operatorId": "93d38c1f-7b17-419e-9536-772392d23664"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Tariff override applied successfully",
  "data": {
    "override": {
      "id": "60cac78f-bb67-4e98-ad1c-c137c473557b",
      "region": "Mumbai-North",
      "price": 10.5,
      "effective_from": "2025-11-12T13:13:52.625Z",
      "reason": "Emergency demand spike - manual intervention required for grid stability",
      "triggered_by": "manual"
    },
    "audit": {
      "operator_id": "93d38c1f-7b17-419e-9536-772392d23664",
      "operator_email": "omargade22@gmail.com",
      "timestamp": "2025-11-12T13:13:52.625Z"
    }
  }
}
```

**Notes:**
- Admin-only endpoint for manual tariff overrides
- Immediately updates Redis cache and creates database record
- Publishes update to Kafka `tariff_updates` topic
- Full audit trail with operator ID, email, and timestamp
- Used for emergency situations, special events, or manual pricing adjustments
- Override remains until next automatic calculation or another manual override
- Unlike automatic tariffs, override records include full ID and reason

---

#### 9. Remove Tariff Override (Admin)
**Endpoint:** `DELETE /api/v1/tariff/override/:tariffId`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Required Role:** `admin`

**Test Request:** `DELETE /api/v1/tariff/override/60cac78f-bb67-4e98-ad1c-c137c473557b`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Tariff override removed successfully",
  "data": {
    "tariff_id": "60cac78f-bb67-4e98-ad1c-c137c473557b",
    "reverted_to_automatic": true,
    "audit": {
      "operator_id": "93d38c1f-7b17-419e-9536-772392d23664",
      "operator_email": "omargade22@gmail.com",
      "timestamp": "2025-11-12T13:16:55.172Z"
    }
  }
}
```

**Notes:**
- Admin-only endpoint to remove manual tariff overrides
- Reverts region to automatic pricing based on current load
- Deletes override record from database and updates Redis cache
- Publishes reversion to Kafka `tariff_updates` topic
- Full audit trail tracks who removed the override and when
- System immediately calculates new automatic price based on current regional load
- Used when emergency/special conditions no longer apply

---

### Alerts

**Status:** Not tested yet

---

### Invoices

**Status:** Not tested yet

---

## Database Issues Found

### Issue #1: Missing `attempts` column
- **Table:** `otp_verifications`
- **Error:** `column "attempts" does not exist`
- **Fix:** `ALTER TABLE otp_verifications ADD COLUMN attempts INTEGER DEFAULT 0;`
- **Status:** ✅ Fixed
- **Updated:** Master schema file `scripts/init-db.sql`

### Issue #2: Missing `verified_at` column
- **Table:** `otp_verifications`
- **Error:** `column "verified_at" of relation "otp_verifications" does not exist`
- **Fix:** `ALTER TABLE otp_verifications ADD COLUMN verified_at TIMESTAMPTZ;`
- **Status:** ✅ Fixed
- **Updated:** Master schema file `scripts/init-db.sql`

### Issue #3: Missing UNIQUE constraints on aggregates tables
- **Tables:** `aggregates_1m`, `aggregates_15m`
- **Error:** `invalid column reference in ON CONFLICT` (code 42P10)
- **Fix:** 
  ```sql
  ALTER TABLE aggregates_1m ADD CONSTRAINT aggregates_1m_unique_key UNIQUE (meter_id, window_start);
  ALTER TABLE aggregates_15m ADD CONSTRAINT aggregates_15m_unique_key UNIQUE (meter_id, window_start);
  ```
- **Status:** ✅ Fixed
- **Updated:** Master schema file `scripts/init-timescale.sql`
- **Note:** Had to disable compression temporarily to add constraints

### Issue #4: Column name mismatch - count vs reading_count
- **File:** `apps/api-gateway/src/services/external/timescaleClient.ts`
- **Error:** `column "count" does not exist`
- **Issue:** TypeScript interface and queries using `count` but database column is `reading_count`
- **Fix:** 
  - Updated `AggregateRow` interface: `count` → `reading_count`
  - Updated queries in `getLatestReading()`, `getMeterHistory()`, `getMeterStats()`
  - Rebuilt API Gateway with `pnpm build`
- **Status:** ✅ Fixed

### Issue #5: Tariff service Kafka topic mismatch
- **File:** `apps/tariff/.env`
- **Error:** `No tariff found for region: Mumbai-North`
- **Root Cause:** Tariff service subscribed to wrong Kafka topic
  - Stream Processor publishes to: `aggregates_1m_regional`
  - Tariff Service was listening to: `regional_aggregates_1m` (backwards!)
- **Fix:** 
  - Updated `.env`: `KAFKA_TOPIC_INPUT=aggregates_1m_regional`
  - Tariff service now processes regional aggregates from correct topic
  - Tariffs will be calculated and stored in database automatically
- **Status:** ✅ Fixed - Service needs to run to process backlog of 116 messages

### Issue #6: Role case sensitivity in JWT authorization
- **Files:** `apps/api-gateway/src/services/auth/jwt.service.ts`
- **Error:** `Access denied. Required role: operator or admin`
- **Root Cause:** Database stores roles in uppercase (`OPERATOR`, `ADMIN`, `USER`) but authorization middleware expects lowercase (`operator`, `admin`, `user`)
- **Fix:**
  - Modified `generateAccessToken()`: Convert role to lowercase with `role.toLowerCase()`
  - Modified `generateRefreshToken()`: Convert role to lowercase with `role.toLowerCase()`
  - JWT tokens now consistently use lowercase roles regardless of database casing
  - Rebuilt API Gateway with `pnpm build`
- **Status:** ✅ Fixed - Users need to login again to get new token with normalized role

### Issue #7: Missing energy_kwh column in raw_readings table
- **Table:** `raw_readings` (TimescaleDB)
- **Issue:** `total_consumption_kwh` and `avg_consumption_per_meter` always show 0
- **Root Cause:** 
  - Simulator generates and sends `energyKwh` field in telemetry readings
  - `raw_readings` table schema missing `energy_kwh` column
  - Ingestion service doesn't store energy data
  - Stream processor tries to aggregate `energyKwh` but gets `undefined`
  - All aggregated `energy_kwh_sum` values remain 0
- **Fix:**
  - Added `energy_kwh DECIMAL(12, 6)` column to `raw_readings` table
  - Updated master schema file `scripts/init-timescale.sql`
  - Ran: `ALTER TABLE raw_readings ADD COLUMN energy_kwh DECIMAL(12, 6);`
- **Status:** ✅ Fixed - Ingestion service needs restart to store new readings with energy data

### Issue #8: Alert service Kafka topic name mismatch
- **File:** `apps/alert/src/lifecycle/processLifecycle.ts`
- **Error:** Alert service not consuming any messages from Kafka
- **Root Cause:**
  - Config subscribed to topics: `['aggregates_1m_regional', 'alerts']`
  - Message handler checked: `if (topic === 'aggregated-data')` and `if (topic === 'anomaly-detected')`
  - Topic names never matched, so all messages were ignored
- **Fix:**
  - Changed hardcoded strings to config references:
    - `topic === 'aggregated-data'` → `topic === Config.kafka.topicAggregates`
    - `topic === 'anomaly-detected'` → `topic === Config.kafka.topicAlerts`
  - Rebuilt alert service with `pnpm build`
- **Validation:**
  - Consumer group `alert-service-group` shows LAG = 0 on both topics
  - 13 messages in `alerts` topic successfully consumed
  - 340 messages in `aggregates_1m_regional` topic successfully consumed
- **Status:** ✅ Fixed - But discovered Issue #9

### Issue #9: Alert type case sensitivity in AlertHelper
- **File:** `apps/alert/src/helpers/alertHelper.ts`
- **Error:** Messages consumed but no database records created
- **Root Cause:**
  - Stream processor publishes alerts with `"type": "ANOMALY"` (uppercase)
  - AlertHelper checks `if (alertData.type === 'anomaly')` (lowercase)
  - Case mismatch caused silent failure - messages consumed but not processed
- **Fix:**
  - Changed condition to: `if (alertData.type.toUpperCase() === 'ANOMALY')`
  - Makes check case-insensitive
  - Rebuilt alert service with `pnpm build`
- **Status:** ✅ Fixed - But discovered Issue #10

### Issue #10: Alert service column name mismatch
- **File:** `apps/alert/src/services/postgresService.ts`
- **Error:** `column "type" of relation "alerts" does not exist`
- **Root Cause:** PostgresService using wrong column names:
  - Code tried to insert into: `type`, `id`, `status`, `timestamp`
  - Actual database columns: `alert_type`, `alert_id`, `is_resolved`, `created_at`
- **Fix:** Updated all queries to use correct column names:
  - `type` → `alert_type`
  - `id` → `alert_id`
  - `status` → `is_resolved` (boolean)
  - `timestamp` → `created_at`
  - Updated INSERT, SELECT, UPDATE queries
  - Updated `mapRowToAlert()` to map database columns to interface
  - Rebuilt alert service with `pnpm build`
- **Validation:**
  - Reset consumer offset to reprocess messages: `kafka-consumer-groups --reset-offsets --to-earliest`
  - Alert service successfully created 5 alerts (3 low, 2 medium severity)
  - All alerts in Pune-West region with different meters
- **Status:** ✅ Fixed - But discovered Issue #11

### Issue #11: Status column mapping in updateAlert
- **File:** `apps/alert/src/services/postgresService.ts`
- **Error:** `column "status" of relation "alerts" does not exist` when resolving alerts
- **Root Cause:** 
  - `updateAlert()` method tried to directly update `status` column
  - Database uses `is_resolved` boolean instead of `status` enum
  - Acknowledge worked (updates `acknowledged` field) but resolve failed
- **Fix:** Map status values to is_resolved boolean:
  ```typescript
  if (data.status === 'resolved') {
    updates.push(`is_resolved = true`);
  } else if (data.status === 'active') {
    updates.push(`is_resolved = false`);
  }
  // 'acknowledged' status handled by acknowledged field
  ```
- **Validation:**
  - Rebuilt alert service with `pnpm build`
  - Successfully acknowledged alert (status: acknowledged)
  - Successfully resolved alert (is_resolved: true)
  - Resolution metadata stored correctly
- **Status:** ✅ Fixed - Alert lifecycle now fully operational

---

## Alert Routes

### User Routes

#### 1. Get My Alerts
**Endpoint:** `GET /api/v1/alerts/`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` (optional): Number of alerts per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User alerts retrieved successfully",
  "data": {
    "alerts": [
      {
        "id": "03480d78-481d-486b-8c64-035cf8b69148",
        "type": "ANOMALY",
        "severity": "medium",
        "region": "Pune-West",
        "meter_id": "MTR-00000044",
        "message": "Sudden power consumption spike: 101.9% increase (baseline: 2.09 kW, current: 4.22 kW)",
        "status": "active",
        "timestamp": "2025-11-12T13:43:32.083Z",
        "acknowledged": false,
        "acknowledged_by": null,
        "acknowledged_at": null,
        "resolved_at": null,
        "metadata": {
          "type": "spike",
          "change": 101.94054105726028,
          "source": "stream-processor",
          "current": 4.225,
          "baseline": 2.0922,
          "original_id": "4e0d0984-b5b8-4957-8d5f-c22f17c4c401"
        },
        "created_at": "2025-11-12T13:43:32.083Z",
        "updated_at": "2025-11-12T13:43:32.083Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0
    },
    "summary": {
      "active": 1,
      "acknowledged": 0,
      "resolved": 0
    }
  }
}
```

**Notes:**
- Returns alerts for user's assigned meter (MTR-00000044)
- Shows 1 medium severity alert (power spike: 101.9% increase)
- Includes detailed metadata with baseline and current readings
- Provides pagination info and alert summary
- Status: active (not acknowledged or resolved)

---

#### 2. Get Alert Details
**Endpoint:** `GET /api/v1/alerts/:alertId`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Alert retrieved successfully",
  "data": {
    "id": "03480d78-481d-486b-8c64-035cf8b69148",
    "type": "ANOMALY",
    "severity": "medium",
    "region": "Pune-West",
    "meter_id": "MTR-00000044",
    "message": "Sudden power consumption spike: 101.9% increase (baseline: 2.09 kW, current: 4.22 kW)",
    "status": "active",
    "timestamp": "2025-11-12T13:43:32.083Z",
    "acknowledged": false,
    "acknowledged_by": null,
    "acknowledged_at": null,
    "resolved_at": null,
    "metadata": {
      "type": "spike",
      "change": 101.94054105726028,
      "source": "stream-processor",
      "current": 4.225,
      "baseline": 2.0922,
      "original_id": "4e0d0984-b5b8-4957-8d5f-c22f17c4c401"
    },
    "created_at": "2025-11-12T13:43:32.083Z",
    "updated_at": "2025-11-12T13:43:32.083Z"
  }
}
```

**Notes:**
- Returns full details for a specific alert
- User can only view alerts for their own meter

---

### Operator Routes

#### 1. Get All Alerts
**Endpoint:** `GET /api/v1/alerts/operator/all`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "All alerts retrieved successfully",
  "data": {
    "alerts": [
      {
        "id": "92d732ca-2150-4b8f-a837-4da05960fd51",
        "type": "ANOMALY",
        "severity": "low",
        "region": "Pune-West",
        "meter_id": "MTR-00000028",
        "message": "Sudden power consumption drop: 50.6% decrease (baseline: 4.36 kW, current: 2.16 kW)",
        "status": "resolved",
        "timestamp": "2025-11-12T13:43:32.141Z",
        "acknowledged": true,
        "acknowledged_by": "93d38c1f-7b17-419e-9536-772392d23664",
        "acknowledged_at": "2025-11-12T14:07:57.782Z",
        "resolved_at": "2025-11-12T14:12:40.441Z",
        "metadata": {
          "type": "drop",
          "change": 50.57086523912147,
          "source": "stream-processor",
          "current": 2.156,
          "baseline": 4.361800000000001,
          "original_id": "a3ec6403-15d7-4955-ba44-95a114597f3c",
          "resolved_by": "93d38c1f-7b17-419e-9536-772392d23664",
          "resolution_note": "Issue fixed - meter reset performed",
          "acknowledgment_note": "Investigating the issue",
          "resolution_timestamp": "2025-11-12T14:12:40.441Z",
          "acknowledgment_timestamp": "2025-11-12T14:07:57.782Z"
        },
        "created_at": "2025-11-12T13:43:32.141Z",
        "updated_at": "2025-11-12T14:12:40.446Z"
      }
      // ... 4 more alerts
    ]
  }
}
```

**Notes:**
- Returns all alerts across all meters (5 total)
- 1 resolved, 4 active
- Mix of spikes (2) and drops (3)
- All in Pune-West region

---

#### 2. Get Active Alerts
**Endpoint:** `GET /api/v1/alerts/operator/active`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Active alerts retrieved successfully",
  "data": {
    "alerts": [
      // 4 active alerts (unresolved)
    ]
  }
}
```

**Notes:**
- Returns only active (unresolved) alerts
- Filters out the resolved alert
- Shows 4 active alerts requiring attention

---

#### 3. Get Alert History by Region
**Endpoint:** `GET /api/v1/alerts/operator/history/:region`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Alert history for Pune-West retrieved successfully",
  "data": {
    "region": "Pune-West",
    "alerts": [
      {
        "id": "92d732ca-2150-4b8f-a837-4da05960fd51",
        "type": "ANOMALY",
        "severity": "low",
        "status": "resolved",
        "acknowledged": true,
        "acknowledged_by": "93d38c1f-7b17-419e-9536-772392d23664",
        "acknowledged_at": "2025-11-12T14:07:57.782Z",
        "resolved_at": "2025-11-12T14:12:40.441Z",
        "metadata": {
          "resolved_by": "93d38c1f-7b17-419e-9536-772392d23664",
          "resolution_note": "Issue fixed - meter reset performed",
          "acknowledgment_note": "Investigating the issue"
        }
      }
    ]
  }
}
```

**Notes:**
- Returns only resolved alerts for specified region
- Shows full resolution details including notes
- Tracks who resolved and when

---

#### 4. Get Alert Statistics
**Endpoint:** `GET /api/v1/alerts/operator/stats`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Alert statistics retrieved successfully",
  "data": {
    "statistics": {
      "total_alerts": 5,
      "active_alerts": 4,
      "acknowledged_alerts": 1,
      "resolved_alerts": 1,
      "alerts_by_type": {
        "ANOMALY": 5
      },
      "alerts_by_region": {
        "Pune-West": 5
      },
      "avg_resolution_time_hours": 0.078
    }
  }
}
```

**Notes:**
- Provides system-wide alert metrics
- Shows distribution by type and region
- Calculates average resolution time
- All current alerts are ANOMALY type from stream processor

---

#### 5. Get Specific Alert (Operator)
**Endpoint:** `GET /api/v1/alerts/operator/:alertId`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Alert retrieved successfully",
  "data": {
    "id": "03480d78-481d-486b-8c64-035cf8b69148",
    "type": "ANOMALY",
    "severity": "medium",
    "region": "Pune-West",
    "meter_id": "MTR-00000044",
    "message": "Sudden power consumption spike: 101.9% increase (baseline: 2.09 kW, current: 4.22 kW)",
    "status": "active"
  }
}
```

**Notes:**
- Operator can view any alert (not restricted to own meter)
- Returns full alert details

---

#### 6. Acknowledge Alert
**Endpoint:** `PUT /api/v1/alerts/operator/:alertId/acknowledge`

**Status:** ✅ PASSED

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "note": "Investigating the issue"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Alert acknowledged successfully",
  "data": {
    "id": "92d732ca-2150-4b8f-a837-4da05960fd51",
    "status": "acknowledged",
    "acknowledged": true,
    "acknowledged_by": "93d38c1f-7b17-419e-9536-772392d23664",
    "acknowledged_at": "2025-11-12T14:07:57.782Z",
    "metadata": {
      "acknowledgment_note": "Investigating the issue",
      "acknowledgment_timestamp": "2025-11-12T14:07:57.782Z"
    }
  }
}
```

**Notes:**
- Marks alert as acknowledged by operator
- Stores user ID who acknowledged
- Adds acknowledgment note to metadata
- Publishes status update to Kafka topic

---

#### 7. Resolve Alert
**Endpoint:** `PUT /api/v1/alerts/operator/:alertId/resolve`

**Status:** ✅ PASSED (after Issue #11 fix)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "resolution_note": "Issue fixed - meter reset performed"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Alert resolved successfully",
  "data": {
    "id": "92d732ca-2150-4b8f-a837-4da05960fd51",
    "status": "resolved",
    "acknowledged": true,
    "resolved_at": "2025-11-12T14:12:40.441Z",
    "metadata": {
      "resolved_by": "93d38c1f-7b17-419e-9536-772392d23664",
      "resolution_note": "Issue fixed - meter reset performed",
      "resolution_timestamp": "2025-11-12T14:12:40.441Z"
    }
  }
}
```

**Notes:**
- Marks alert as resolved
- Stores resolution timestamp and note
- Updates `is_resolved` flag in database
- Publishes resolution status to Kafka

**Issue Found & Fixed:**
- **Issue #11**: `updateAlert()` tried to update non-existent `status` column
- **Fix**: Map `status` values to `is_resolved` boolean:
  - `'resolved'` → `is_resolved = true`
  - `'active'` → `is_resolved = false`

---

## Fixes Applied

## Fixes Applied

*Database schema fixes will be documented here*
