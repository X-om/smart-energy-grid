# 🚀 SEGS Services Startup Guide

## ✅ Prerequisites Check

1. **Infrastructure Services Running:**
```bash
docker-compose up -d postgres timescaledb redis kafka zookeeper
docker ps | grep -E "segs-(postgres|timescaledb|redis|kafka|zookeeper)"
```

2. **Dependencies Installed:**
```bash
cd /Users/om/Projects/SMART-ENERGY-GRID
pnpm install
```

3. **Build All Services:**
```bash
# Build shared packages first
cd packages/shared-types && pnpm build
cd ../..

# Build all services
pnpm build
```

---

## 📝 Service Startup Order

### **1. API Gateway (Port 3000)** ✅ TESTED & WORKING

```bash
# Terminal 1
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/api-gateway
node dist/index.js
```

**Expected Output:**
```
{"level":30,"msg":"Starting API Gateway..."}
{"level":30,"msg":"✓ PostgreSQL connected"}
{"level":30,"msg":"✓ TimescaleDB connected"}
{"level":30,"msg":"✓ Redis connected"}
{"level":30,"msg":"🚀 API Gateway started on port 3000"}
```

**Test:**
```bash
curl http://localhost:3000/health
```

---

### **2. Alert Service (Port 3004)**

```bash
# Terminal 2
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/alert
pnpm build
node dist/index.js
```

**Test:**
```bash
curl http://localhost:3004/health
```

---

### **3. Tariff Service (Port 3003)**

```bash
# Terminal 3
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/tariff
pnpm build
node dist/index.js
```

**Test:**
```bash
curl http://localhost:3003/health
```

---

### **4. Stream Processor (Port 3002)** - Optional for Alert Testing

```bash
# Terminal 4
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/stream-processor
pnpm build
node dist/index.js
```

---

### **5. Ingestion Service (Port 3001)** - Optional

```bash
# Terminal 5
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/ingestion
pnpm build
node dist/index.js
```

---

### **6. Notification Service (Port 3005)** - Optional

```bash
# Terminal 6
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/notification
pnpm build
node dist/index.js
```

---

## 🧪 Quick Verification Script

Save as `check-services.sh`:

```bash
#!/bin/bash

echo "==================================="
echo "🔍 SEGS Services Health Check"
echo "==================================="

services=(
  "http://localhost:3000/health|API Gateway"
  "http://localhost:3001/health|Ingestion"
  "http://localhost:3003/health|Tariff"
  "http://localhost:3004/health|Alert"
  "http://localhost:3005/health|Notification"
)

for service in "${services[@]}"; do
  IFS='|' read -r url name <<< "$service"
  echo -n "Checking $name... "
  
  if curl -s -f "$url" > /dev/null 2>&1; then
    echo "✅ UP"
  else
    echo "❌ DOWN"
  fi
done

echo ""
echo "Infrastructure Services:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep segs-
```

Make executable:
```bash
chmod +x check-services.sh
./check-services.sh
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module"
**Solution:** Build the service first
```bash
cd apps/<service-name>
pnpm build
```

### Issue: "ECONNREFUSED" for database
**Solution:** Start infrastructure
```bash
docker-compose up -d postgres timescaledb redis
sleep 10
```

### Issue: "Port already in use"
**Solution:** Kill existing process
```bash
# Find process
lsof -i :3000  # or whatever port

# Kill it
kill -9 <PID>
```

### Issue: TypeScript compilation errors
**Solution:** Clean and rebuild
```bash
rm -rf dist tsconfig.tsbuildinfo
pnpm build
```

---

## 📊 Service Dependencies

```
┌─────────────────┐
│   API Gateway   │ ← Entry point (3000)
└────────┬────────┘
         │
         ├─→ PostgreSQL (5432)
         ├─→ TimescaleDB (5433)
         ├─→ Redis (6379)
         ├─→ Alert Service (3004)
         └─→ Tariff Service (3003)

┌─────────────┐
│    Alert    │ (3004)
└──────┬──────┘
       ├─→ PostgreSQL (5432)
       ├─→ Redis (6379)
       └─→ Kafka (29092)

┌─────────────┐
│   Tariff    │ (3003)
└──────┬──────┘
       ├─→ PostgreSQL (5432)
       ├─→ Redis (6379)
       └─→ Kafka (29092)
```

---

## 🎯 For Alert Route Testing

**Minimum Required Services:**
1. ✅ Infrastructure (Postgres, Redis, Kafka)
2. ✅ API Gateway (3000)
3. ✅ Alert Service (3004)

Optional but recommended:
- Tariff Service (3003) - for complete system
- Stream Processor (3002) - for generating alerts

---

## 📝 Environment Files Summary

All `.env` files have been created with proper localhost configurations:

- ✅ `apps/api-gateway/.env`
- ✅ `apps/alert/.env`
- ✅ `apps/tariff/.env`
- ✅ `apps/ingestion/.env`
- ✅ `apps/stream-processor/.env`
- ✅ `apps/notification/.env`
- ✅ `apps/simulator/.env`

No changes needed - ready to use!

---

## 🚀 Quick Start (Minimal for Alert Testing)

```bash
# 1. Start infrastructure
docker-compose up -d postgres timescaledb redis kafka zookeeper

# 2. Wait for services to be healthy
sleep 15

# 3. Start API Gateway
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/api-gateway
node dist/index.js &

# 4. Start Alert Service  
cd /Users/om/Projects/SMART-ENERGY-GRID/apps/alert
pnpm build
node dist/index.js &

# 5. Test
sleep 5
curl http://localhost:3000/health
curl http://localhost:3004/health
```

Ready for testing! 🎉
