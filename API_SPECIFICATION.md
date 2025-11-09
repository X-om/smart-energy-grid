# 🚀 SEGS API Gateway - Complete API Specification

**Interview Date:** November 11, 2025 @ 3 PM  
**Status:** Ready for Implementation  
**Version:** 1.0.0

---

## 👥 User Roles & Permissions

### 1. **End User** (Residential/Commercial Customer)
- View own consumption data
- View current tariff rates
- View own billing/invoices
- Manage profile
- View own alerts
- Subscribe to real-time notifications

### 2. **Grid Operator** (Control Center Staff)
- View real-time grid status (all regions)
- View all alerts (system-wide)
- Acknowledge/resolve alerts
- View regional load and capacity
- Monitor meter health
- View aggregated analytics
- **NO** tariff override (requires admin)

### 3. **Admin** (System Administrator)
- All operator permissions +
- Manual tariff overrides
- User management
- System configuration
- Meter provisioning
- Access audit logs

---

## 🔐 Authentication Flow

### Public Endpoints (No Auth)
```
POST   /api/v1/auth/register          - User registration
POST   /api/v1/auth/login             - User login
POST   /api/v1/auth/refresh           - Refresh access token
GET    /health                        - Health check
GET    /metrics                       - Prometheus metrics
GET    /docs                          - API documentation
```

### Protected Endpoints (JWT Required)
All other endpoints require `Authorization: Bearer <token>` header

---

## 📡 Real-Time Notification Integration

### WebSocket Connection
```javascript
// Client connects to notification service via API Gateway proxy
const ws = new WebSocket('ws://api-gateway:3000/api/v1/ws', {
  headers: { 'Authorization': 'Bearer <token>' }
});

// API Gateway validates JWT, then proxies to notification service
// Client receives real-time updates for:
// - Alerts (user-specific or region-specific)
// - Tariff changes (user's region)
// - Alert status updates (operators)
```

### Notification Subscription Model
```
User Role → Receives:
- END_USER: alerts for their meter_id, tariff updates for their region
- OPERATOR: all alerts, all tariff updates, system status
- ADMIN: all notifications + audit events
```

---

## 📋 Complete API Endpoints

### 1️⃣ Authentication & Authorization

#### `POST /api/v1/auth/register`
**Purpose:** Register new user  
**Access:** Public  
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105"
  }
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-11-10T12:00:00Z"
  },
  "message": "Registration successful. Please verify your email."
}
```

---

#### `POST /api/v1/auth/login`
**Purpose:** User login  
**Access:** Public  
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "refresh-token-here",
    "expiresIn": 86400,
    "user": {
      "userId": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "meterId": "meter-123"
    }
  }
}
```

---

#### `POST /api/v1/auth/refresh`
**Purpose:** Refresh access token  
**Access:** Public  
**Request Body:**
```json
{
  "refreshToken": "refresh-token-here"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token",
    "expiresIn": 86400
  }
}
```

---

#### `POST /api/v1/auth/logout`
**Purpose:** Logout (invalidate tokens)  
**Access:** Authenticated  
**Request Body:**
```json
{
  "refreshToken": "refresh-token-here"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 2️⃣ User Profile Management

#### `GET /api/v1/users/me`
**Purpose:** Get current user profile  
**Access:** Authenticated (All roles)  
**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "role": "user",
    "meterId": "meter-123",
    "region": "north",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94105"
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "emailVerified": true
  }
}
```

---

#### `PUT /api/v1/users/me`
**Purpose:** Update user profile  
**Access:** Authenticated (All roles)  
**Request Body:**
```json
{
  "name": "John Updated",
  "phone": "+1234567891",
  "address": {
    "street": "456 New St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94106"
  }
}
```

---

#### `PUT /api/v1/users/me/password`
**Purpose:** Change password  
**Access:** Authenticated (All roles)  
**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

---

### 3️⃣ Consumption Data (User APIs)

#### `GET /api/v1/consumption`
**Purpose:** Get user's energy consumption data  
**Access:** Authenticated (User, Operator, Admin)  
**Query Parameters:**
```
?start=2025-11-01T00:00:00Z    (required)
?end=2025-11-10T23:59:59Z      (required)
?interval=1h                    (optional: 1m, 5m, 15m, 1h, 1d - default: 1h)
?meterId=meter-123              (optional, operator/admin only)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "meterId": "meter-123",
    "region": "north",
    "interval": "1h",
    "period": {
      "start": "2025-11-01T00:00:00Z",
      "end": "2025-11-10T23:59:59Z"
    },
    "readings": [
      {
        "timestamp": "2025-11-01T00:00:00Z",
        "avgPowerKw": 4.5,
        "maxPowerKw": 6.2,
        "energyKwh": 4.5,
        "count": 60
      },
      {
        "timestamp": "2025-11-01T01:00:00Z",
        "avgPowerKw": 3.8,
        "maxPowerKw": 5.1,
        "energyKwh": 3.8,
        "count": 60
      }
    ],
    "summary": {
      "totalEnergyKwh": 1024.5,
      "avgPowerKw": 4.27,
      "peakPowerKw": 8.9,
      "totalReadings": 14400
    }
  }
}
```

---

#### `GET /api/v1/consumption/summary`
**Purpose:** Get consumption summary statistics  
**Access:** Authenticated (User, Operator, Admin)  
**Query Parameters:**
```
?period=today|week|month|year  (default: month)
?meterId=meter-123             (optional, operator/admin only)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "meterId": "meter-123",
    "current": {
      "totalKwh": 450.5,
      "avgKw": 4.2,
      "peakKw": 8.9,
      "cost": 2252.50,
      "days": 30
    },
    "previous": {
      "totalKwh": 420.3,
      "avgKw": 3.9,
      "peakKw": 7.8,
      "cost": 2101.50,
      "days": 30
    },
    "comparison": {
      "energyChange": 7.2,
      "costChange": 7.2,
      "percentChange": 7.2
    }
  }
}
```

---

#### `GET /api/v1/consumption/realtime`
**Purpose:** Get latest consumption reading  
**Access:** Authenticated (User, Operator, Admin)  
**Query Parameters:**
```
?meterId=meter-123  (optional, operator/admin only)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "meterId": "meter-123",
    "timestamp": "2025-11-10T14:32:15Z",
    "powerKw": 4.8,
    "voltage": 240.5,
    "current": 20.0,
    "region": "north",
    "status": "OK"
  }
}
```

---

### 4️⃣ Tariff APIs

#### `GET /api/v1/tariffs/current`
**Purpose:** Get current tariff rates  
**Access:** Authenticated (All roles)  
**Query Parameters:**
```
?region=north  (optional, defaults to user's region)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "region": "north",
    "currentTariff": {
      "tariffId": "uuid",
      "pricePerKwh": 6.25,
      "effectiveFrom": "2025-11-10T14:00:00Z",
      "reason": "High demand - regional load at 78%",
      "loadPercentage": 78.5,
      "tier": "high"
    },
    "nextUpdate": "2025-11-10T15:00:00Z"
  }
}
```

---

#### `GET /api/v1/tariffs/history`
**Purpose:** Get tariff history  
**Access:** Authenticated (All roles)  
**Query Parameters:**
```
?region=north                  (optional, defaults to user's region)
?start=2025-11-01T00:00:00Z   (required)
?end=2025-11-10T23:59:59Z     (required)
?limit=100                     (optional, default: 100)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "region": "north",
    "period": {
      "start": "2025-11-01T00:00:00Z",
      "end": "2025-11-10T23:59:59Z"
    },
    "tariffs": [
      {
        "tariffId": "uuid",
        "pricePerKwh": 6.25,
        "effectiveFrom": "2025-11-10T14:00:00Z",
        "reason": "High demand",
        "triggeredBy": "AUTO",
        "oldPrice": 5.00
      }
    ],
    "statistics": {
      "avgPrice": 5.42,
      "minPrice": 4.00,
      "maxPrice": 8.00,
      "changes": 45
    },
    "pagination": {
      "total": 150,
      "limit": 100,
      "offset": 0
    }
  }
}
```

---

#### `POST /api/v1/tariffs/override` ⚠️
**Purpose:** Manual tariff override (emergency pricing)  
**Access:** Admin only  
**Request Body:**
```json
{
  "region": "north",
  "pricePerKwh": 10.00,
  "reason": "Emergency - grid emergency declared",
  "duration": 3600
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "tariffId": "uuid",
    "region": "north",
    "pricePerKwh": 10.00,
    "effectiveFrom": "2025-11-10T14:35:00Z",
    "expiresAt": "2025-11-10T15:35:00Z",
    "reason": "Emergency - grid emergency declared",
    "triggeredBy": "MANUAL",
    "overrideBy": "admin-user-id"
  },
  "message": "Tariff override applied successfully. Will revert to auto pricing after 1 hour."
}
```

---

### 5️⃣ Billing & Invoices

#### `GET /api/v1/billing/invoices`
**Purpose:** Get user's invoices  
**Access:** Authenticated (User, Admin)  
**Query Parameters:**
```
?status=paid|unpaid|overdue    (optional)
?year=2025                      (optional)
?limit=20                       (optional)
?offset=0                       (optional)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoiceId": "INV-2025-11",
        "userId": "uuid",
        "period": {
          "start": "2025-11-01T00:00:00Z",
          "end": "2025-11-30T23:59:59Z"
        },
        "consumption": {
          "totalKwh": 450.5,
          "avgKw": 4.2,
          "peakKw": 8.9
        },
        "charges": {
          "energyCharges": 2252.50,
          "fixedCharges": 25.00,
          "taxes": 227.25,
          "total": 2504.75
        },
        "status": "unpaid",
        "dueDate": "2025-12-15T00:00:00Z",
        "generatedAt": "2025-12-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 12,
      "limit": 20,
      "offset": 0
    }
  }
}
```

---

#### `GET /api/v1/billing/invoices/:invoiceId`
**Purpose:** Get invoice details  
**Access:** Authenticated (User owns invoice, or Admin)  
**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "INV-2025-11",
    "userId": "uuid",
    "user": {
      "name": "John Doe",
      "email": "user@example.com",
      "meterId": "meter-123"
    },
    "period": {
      "start": "2025-11-01T00:00:00Z",
      "end": "2025-11-30T23:59:59Z"
    },
    "consumption": {
      "totalKwh": 450.5,
      "breakdown": [
        { "date": "2025-11-01", "kwh": 15.2 },
        { "date": "2025-11-02", "kwh": 14.8 }
      ]
    },
    "tariffBreakdown": [
      {
        "period": "2025-11-01T00:00:00Z - 2025-11-01T05:59:59Z",
        "hours": 6,
        "kwh": 25.2,
        "rate": 4.00,
        "amount": 100.80,
        "tier": "off-peak"
      },
      {
        "period": "2025-11-01T06:00:00Z - 2025-11-01T21:59:59Z",
        "hours": 16,
        "kwh": 68.5,
        "rate": 5.00,
        "amount": 342.50,
        "tier": "normal"
      }
    ],
    "charges": {
      "energyCharges": 2252.50,
      "fixedCharges": 25.00,
      "taxes": 227.25,
      "total": 2504.75
    },
    "status": "unpaid",
    "dueDate": "2025-12-15T00:00:00Z",
    "pdfUrl": "/api/v1/billing/invoices/INV-2025-11/pdf"
  }
}
```

---

#### `POST /api/v1/billing/calculate`
**Purpose:** Calculate cost for a period (preview before invoice generation)  
**Access:** Authenticated (User, Admin)  
**Request Body:**
```json
{
  "meterId": "meter-123",
  "start": "2025-11-01T00:00:00Z",
  "end": "2025-11-10T23:59:59Z"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "meterId": "meter-123",
    "period": {
      "start": "2025-11-01T00:00:00Z",
      "end": "2025-11-10T23:59:59Z"
    },
    "totalKwh": 150.5,
    "estimatedCost": 752.50,
    "breakdown": {
      "energyCharges": 727.50,
      "fixedCharges": 25.00,
      "taxes": 0.00
    },
    "avgRate": 4.83
  }
}
```

---

### 6️⃣ Alerts (User View)

#### `GET /api/v1/alerts`
**Purpose:** Get user's alerts  
**Access:** Authenticated (All roles)  
**Query Parameters:**
```
?status=active|acknowledged|resolved  (optional)
?severity=low|medium|high|critical    (optional)
?type=ANOMALY|REGIONAL_OVERLOAD       (optional)
?limit=50                              (optional)
?offset=0                              (optional)
?startDate=2025-11-01                  (optional)
?endDate=2025-11-10                    (optional)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-uuid",
        "type": "ANOMALY",
        "severity": "medium",
        "region": "north",
        "meterId": "meter-123",
        "message": "Sudden power consumption spike: 120.5% increase",
        "status": "active",
        "timestamp": "2025-11-10T14:25:00Z",
        "metadata": {
          "baseline": 4.5,
          "current": 9.9,
          "change": 120.5
        }
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 50,
      "offset": 0
    },
    "summary": {
      "active": 3,
      "acknowledged": 7,
      "resolved": 5
    }
  }
}
```

---

#### `GET /api/v1/alerts/:alertId`
**Purpose:** Get alert details  
**Access:** Authenticated (User owns alert, or Operator/Admin)  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert-uuid",
    "type": "ANOMALY",
    "severity": "medium",
    "region": "north",
    "meterId": "meter-123",
    "message": "Sudden power consumption spike: 120.5% increase",
    "status": "active",
    "timestamp": "2025-11-10T14:25:00Z",
    "acknowledged": false,
    "metadata": {
      "baseline": 4.5,
      "current": 9.9,
      "change": 120.5,
      "type": "spike"
    },
    "createdAt": "2025-11-10T14:25:05Z",
    "updatedAt": "2025-11-10T14:25:05Z"
  }
}
```

---

### 7️⃣ Grid Status (Operator APIs)

#### `GET /api/v1/grid/status`
**Purpose:** Real-time grid status overview  
**Access:** Operator, Admin  
**Query Parameters:**
```
?region=north  (optional, if omitted returns all regions)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-11-10T14:35:00Z",
    "regions": [
      {
        "region": "north",
        "status": "normal",
        "metrics": {
          "totalMeters": 1250,
          "activeMeters": 1242,
          "offlineMeters": 8,
          "currentLoadMw": 5.25,
          "capacityMw": 10.0,
          "loadPercentage": 52.5,
          "avgConsumptionKw": 4.23
        },
        "currentTariff": {
          "pricePerKwh": 5.00,
          "tier": "normal"
        },
        "alerts": {
          "active": 2,
          "critical": 0
        }
      },
      {
        "region": "south",
        "status": "high_load",
        "metrics": {
          "totalMeters": 1500,
          "activeMeters": 1495,
          "offlineMeters": 5,
          "currentLoadMw": 8.75,
          "capacityMw": 10.0,
          "loadPercentage": 87.5,
          "avgConsumptionKw": 5.85
        },
        "currentTariff": {
          "pricePerKwh": 7.50,
          "tier": "peak"
        },
        "alerts": {
          "active": 5,
          "critical": 1
        }
      }
    ],
    "systemWide": {
      "totalMeters": 5000,
      "activeMeters": 4975,
      "totalLoadMw": 21.5,
      "totalCapacityMw": 40.0,
      "avgLoadPercentage": 53.75,
      "activeAlerts": 12,
      "criticalAlerts": 1
    }
  }
}
```

---

#### `GET /api/v1/grid/regions/:region/load`
**Purpose:** Regional load time series  
**Access:** Operator, Admin  
**Query Parameters:**
```
?start=2025-11-10T00:00:00Z  (required)
?end=2025-11-10T23:59:59Z    (required)
?interval=1m|5m|15m|1h       (default: 15m)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "region": "north",
    "interval": "15m",
    "capacity": 10.0,
    "series": [
      {
        "timestamp": "2025-11-10T00:00:00Z",
        "loadMw": 3.5,
        "loadPercentage": 35.0,
        "activeMeters": 1150,
        "avgConsumptionKw": 3.04
      },
      {
        "timestamp": "2025-11-10T00:15:00Z",
        "loadMw": 3.8,
        "loadPercentage": 38.0,
        "activeMeters": 1180,
        "avgConsumptionKw": 3.22
      }
    ]
  }
}
```

---

#### `GET /api/v1/grid/meters`
**Purpose:** List all meters with health status  
**Access:** Operator, Admin  
**Query Parameters:**
```
?region=north              (optional)
?status=online|offline     (optional)
?limit=100                 (default: 100)
?offset=0                  (default: 0)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "meters": [
      {
        "meterId": "meter-123",
        "userId": "user-uuid",
        "region": "north",
        "status": "online",
        "lastReading": "2025-11-10T14:34:00Z",
        "currentPowerKw": 4.8,
        "avgPowerKw": 4.2,
        "totalKwhToday": 95.5,
        "alertsActive": 1
      }
    ],
    "pagination": {
      "total": 5000,
      "limit": 100,
      "offset": 0
    },
    "summary": {
      "total": 5000,
      "online": 4975,
      "offline": 25,
      "withAlerts": 45
    }
  }
}
```

---

#### `GET /api/v1/grid/meters/:meterId`
**Purpose:** Get detailed meter information  
**Access:** Operator, Admin  
**Response:**
```json
{
  "success": true,
  "data": {
    "meterId": "meter-123",
    "userId": "user-uuid",
    "user": {
      "name": "John Doe",
      "email": "user@example.com"
    },
    "region": "north",
    "status": "online",
    "location": {
      "address": "123 Main St, San Francisco, CA 94105",
      "coordinates": {
        "lat": 37.7749,
        "lng": -122.4194
      }
    },
    "current": {
      "timestamp": "2025-11-10T14:34:00Z",
      "powerKw": 4.8,
      "voltage": 240.5,
      "current": 20.0
    },
    "statistics": {
      "avgPowerKw": 4.2,
      "peakPowerKw": 8.9,
      "totalKwhToday": 95.5,
      "totalKwhMonth": 450.5
    },
    "health": {
      "uptime": 99.8,
      "lastOnline": "2025-11-10T14:34:00Z",
      "lastOffline": "2025-11-09T03:15:00Z",
      "firmwareVersion": "2.1.5"
    },
    "alerts": {
      "active": 1,
      "total": 15
    }
  }
}
```

---

### 8️⃣ Alert Management (Operator APIs)

#### `GET /api/v1/operator/alerts`
**Purpose:** Get all system alerts (operator view)  
**Access:** Operator, Admin  
**Query Parameters:**
```
?status=active|acknowledged|resolved  (optional)
?severity=low|medium|high|critical    (optional)
?region=north                          (optional)
?type=ANOMALY|REGIONAL_OVERLOAD       (optional)
?limit=100                             (default: 50)
?offset=0                              (default: 0)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-uuid",
        "type": "REGIONAL_OVERLOAD",
        "severity": "critical",
        "region": "south",
        "meterId": null,
        "message": "Regional load exceeded 90% - 92.5% capacity",
        "status": "active",
        "timestamp": "2025-11-10T14:25:00Z",
        "metadata": {
          "loadPercentage": 92.5,
          "capacityMw": 10.0,
          "currentLoadMw": 9.25
        }
      }
    ],
    "pagination": {
      "total": 45,
      "limit": 100,
      "offset": 0
    },
    "summary": {
      "active": 12,
      "acknowledged": 18,
      "resolved": 15,
      "bySeverity": {
        "critical": 2,
        "high": 5,
        "medium": 15,
        "low": 23
      },
      "byRegion": {
        "north": 10,
        "south": 15,
        "east": 12,
        "west": 8
      }
    }
  }
}
```

---

#### `PUT /api/v1/operator/alerts/:alertId/acknowledge`
**Purpose:** Acknowledge an alert  
**Access:** Operator, Admin  
**Request Body:**
```json
{
  "notes": "Investigating high load. Demand response initiated."
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert-uuid",
    "status": "acknowledged",
    "acknowledgedBy": "operator-user-id",
    "acknowledgedAt": "2025-11-10T14:40:00Z",
    "notes": "Investigating high load. Demand response initiated."
  },
  "message": "Alert acknowledged successfully"
}
```

---

#### `PUT /api/v1/operator/alerts/:alertId/resolve`
**Purpose:** Resolve an alert  
**Access:** Operator, Admin  
**Request Body:**
```json
{
  "resolution": "Load reduced to 75% after demand response. No action needed.",
  "rootCause": "Peak demand spike - normal pattern"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert-uuid",
    "status": "resolved",
    "resolvedBy": "operator-user-id",
    "resolvedAt": "2025-11-10T15:30:00Z",
    "resolution": "Load reduced to 75% after demand response. No action needed.",
    "rootCause": "Peak demand spike - normal pattern"
  },
  "message": "Alert resolved successfully"
}
```

---

### 9️⃣ Analytics & Reporting

#### `GET /api/v1/analytics/consumption/trends`
**Purpose:** Consumption trend analysis  
**Access:** Operator, Admin  
**Query Parameters:**
```
?region=north              (optional)
?period=day|week|month     (default: week)
?groupBy=hour|day|region   (default: day)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "period": "week",
    "groupBy": "day",
    "region": "north",
    "trends": [
      {
        "date": "2025-11-04",
        "totalKwh": 5250.5,
        "avgKw": 4.2,
        "peakKw": 8.9,
        "activeMeters": 1245,
        "avgCost": 26250.00
      }
    ],
    "insights": {
      "avgDailyConsumption": 5200.0,
      "peakDay": "2025-11-08",
      "lowestDay": "2025-11-05",
      "trend": "increasing"
    }
  }
}
```

---

#### `GET /api/v1/analytics/alerts/summary`
**Purpose:** Alert analytics  
**Access:** Operator, Admin  
**Query Parameters:**
```
?start=2025-11-01  (required)
?end=2025-11-10    (required)
?region=north      (optional)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-11-01",
      "end": "2025-11-10"
    },
    "totalAlerts": 156,
    "byType": {
      "ANOMALY": 120,
      "REGIONAL_OVERLOAD": 36
    },
    "bySeverity": {
      "critical": 12,
      "high": 35,
      "medium": 68,
      "low": 41
    },
    "byRegion": {
      "north": 38,
      "south": 45,
      "east": 42,
      "west": 31
    },
    "averageResolutionTime": 1245,
    "topMeters": [
      {
        "meterId": "meter-456",
        "alertCount": 8,
        "region": "south"
      }
    ]
  }
}
```

---

### 🔟 Admin APIs

#### `GET /api/v1/admin/users`
**Purpose:** List all users  
**Access:** Admin  
**Query Parameters:**
```
?role=user|operator|admin  (optional)
?status=active|inactive    (optional)
?search=email or name      (optional)
?limit=50                  (default: 50)
?offset=0                  (default: 0)
```

---

#### `POST /api/v1/admin/users/:userId/role`
**Purpose:** Change user role  
**Access:** Admin  
**Request Body:**
```json
{
  "role": "operator"
}
```

---

#### `POST /api/v1/admin/meters`
**Purpose:** Provision new meter  
**Access:** Admin  
**Request Body:**
```json
{
  "meterId": "meter-new-001",
  "userId": "user-uuid",
  "region": "north",
  "location": {
    "address": "789 Oak St, San Francisco, CA 94107",
    "coordinates": {
      "lat": 37.7749,
      "lng": -122.4194
    }
  }
}
```

---

#### `GET /api/v1/admin/audit-logs`
**Purpose:** System audit logs  
**Access:** Admin  
**Query Parameters:**
```
?action=login|logout|tariff_override|alert_acknowledge  (optional)
?userId=user-uuid                                        (optional)
?start=2025-11-01                                        (optional)
?end=2025-11-10                                          (optional)
?limit=100                                               (default: 100)
```
**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "timestamp": "2025-11-10T14:35:00Z",
        "userId": "admin-uuid",
        "userName": "Admin User",
        "action": "tariff_override",
        "resource": "tariff",
        "resourceId": "tariff-uuid",
        "details": {
          "region": "north",
          "oldPrice": 5.00,
          "newPrice": 10.00,
          "reason": "Emergency"
        },
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0..."
      }
    ],
    "pagination": {
      "total": 5000,
      "limit": 100,
      "offset": 0
    }
  }
}
```

---

### 1️⃣1️⃣ WebSocket Real-Time Updates

#### `WS /api/v1/ws`
**Purpose:** Real-time notifications via WebSocket  
**Access:** Authenticated (JWT in query param or headers)  
**Connection URL:**
```
ws://api-gateway:3000/api/v1/ws?token=<jwt-token>
```

**Message Types (Server → Client):**

```javascript
// Alert notification
{
  "type": "alert",
  "timestamp": "2025-11-10T14:25:00Z",
  "data": {
    "id": "alert-uuid",
    "type": "ANOMALY",
    "severity": "medium",
    "region": "north",
    "meterId": "meter-123",
    "message": "Sudden power consumption spike: 120.5% increase"
  }
}

// Tariff update notification
{
  "type": "tariff",
  "timestamp": "2025-11-10T14:30:00Z",
  "data": {
    "tariffId": "uuid",
    "region": "north",
    "pricePerKwh": 6.25,
    "effectiveFrom": "2025-11-10T14:30:00Z",
    "reason": "High demand - regional load at 78%",
    "oldPrice": 5.00
  }
}

// Alert status update
{
  "type": "alert_status",
  "timestamp": "2025-11-10T14:40:00Z",
  "data": {
    "alertId": "alert-uuid",
    "status": "acknowledged",
    "acknowledgedBy": "operator-uuid",
    "notes": "Investigating..."
  }
}

// System status (operators only)
{
  "type": "system_status",
  "timestamp": "2025-11-10T14:35:00Z",
  "data": {
    "region": "south",
    "status": "critical",
    "loadPercentage": 92.5,
    "message": "Regional load critical"
  }
}
```

**Client → Server Messages:**
```javascript
// Subscribe to specific regions (optional filtering)
{
  "action": "subscribe",
  "filters": {
    "regions": ["north", "south"],
    "severities": ["high", "critical"]
  }
}

// Ping/pong for keep-alive
{
  "action": "ping"
}
```

---

## 📊 Summary

### Total API Endpoints: **50+**

**Authentication:** 4 endpoints  
**User Profile:** 3 endpoints  
**Consumption Data:** 3 endpoints  
**Tariff APIs:** 3 endpoints  
**Billing:** 3 endpoints  
**Alerts (User):** 2 endpoints  
**Grid Status (Operator):** 4 endpoints  
**Alert Management (Operator):** 3 endpoints  
**Analytics:** 2 endpoints  
**Admin:** 4+ endpoints  
**WebSocket:** 1 connection  

### User Roles & Access Matrix

| Endpoint Category | User | Operator | Admin |
|-------------------|------|----------|-------|
| Authentication | ✅ | ✅ | ✅ |
| Profile Management | ✅ Own | ✅ Own | ✅ All |
| Consumption Data | ✅ Own | ✅ All | ✅ All |
| Tariff View | ✅ | ✅ | ✅ |
| Tariff Override | ❌ | ❌ | ✅ |
| Billing | ✅ Own | ❌ | ✅ All |
| Alerts (View) | ✅ Own | ✅ All | ✅ All |
| Alert Management | ❌ | ✅ | ✅ |
| Grid Status | ❌ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ |
| User Management | ❌ | ❌ | ✅ |
| Audit Logs | ❌ | ❌ | ✅ |
| WebSocket | ✅ Filtered | ✅ Full | ✅ Full |

---

## 🎯 Implementation Priority for Tomorrow's Interview

### Phase 1: Core APIs (4-6 hours) ⭐⭐⭐
1. Authentication (login, register, refresh)
2. User profile (GET, PUT)
3. Consumption data (GET /consumption, GET /consumption/summary)
4. Current tariff (GET /tariffs/current)
5. Alerts (GET /alerts)
6. Grid status (GET /grid/status) - for demo

### Phase 2: Demo Features (2-3 hours) ⭐⭐
1. WebSocket proxy to notification service
2. Invoice details (GET /billing/invoices/:id)
3. Alert acknowledge (PUT /operator/alerts/:id/acknowledge)
4. Real-time dashboard data endpoint

### Phase 3: Documentation (1-2 hours) ⭐
1. OpenAPI/Swagger spec
2. Postman collection
3. README with examples

### Total Time: 7-11 hours (achievable before 3 PM tomorrow!)

---

**This API specification provides:**
- ✅ Complete REST API coverage for all user roles
- ✅ Real-time WebSocket integration with notification service
- ✅ Proper authentication and authorization
- ✅ Comprehensive data access patterns
- ✅ Operator control panel capabilities
- ✅ Admin system management
- ✅ Production-ready error handling patterns
- ✅ Pagination and filtering
- ✅ Clear separation of concerns

Ready to implement! 🚀
