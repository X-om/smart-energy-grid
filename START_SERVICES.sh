#!/bin/bash

# ================================================================
# Smart Energy Grid - Start All Services Script
# ================================================================
# This script:
# 1. Runs database migrations (PostgreSQL + TimescaleDB)
# 2. Starts all microservices in the correct order
# ================================================================

set -e

echo "🚀 Starting Smart Energy Grid System..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to project root
cd "$(dirname "$0")"

# Create logs directory
mkdir -p /tmp/segs-logs

# ================================================================
# STEP 1: DATABASE MIGRATIONS
# ================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  STEP 1: DATABASE SCHEMA INITIALIZATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if PostgreSQL is running
echo -e "${YELLOW}🔍 Checking PostgreSQL connection...${NC}"
if docker exec segs-postgres pg_isready -U segs_user > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}   ❌ PostgreSQL is not running!${NC}"
    echo "   Please start infrastructure: docker-compose up -d"
    exit 1
fi

# Check if TimescaleDB is running
echo -e "${YELLOW}🔍 Checking TimescaleDB connection...${NC}"
if docker exec segs-timescaledb pg_isready -U segs_user > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ TimescaleDB is running${NC}"
else
    echo -e "${RED}   ❌ TimescaleDB is not running!${NC}"
    echo "   Please start infrastructure: docker-compose up -d"
    exit 1
fi

echo ""

# Run PostgreSQL migrations
echo -e "${YELLOW}📊 Running PostgreSQL schema migrations...${NC}"
if docker exec -i segs-postgres psql -U segs_user -d segs_db < scripts/init-db.sql > /tmp/segs-logs/postgres-migration.log 2>&1; then
    # Check if tables already existed
    if grep -q "already exists" /tmp/segs-logs/postgres-migration.log 2>/dev/null; then
        echo -e "${GREEN}   ⏭️  PostgreSQL tables already exist - skipped${NC}"
    else
        echo -e "${GREEN}   ✅ PostgreSQL schema initialized successfully${NC}"
    fi
else
    echo -e "${RED}   ❌ PostgreSQL migration failed!${NC}"
    echo "   Check logs: cat /tmp/segs-logs/postgres-migration.log"
    exit 1
fi

# Run TimescaleDB migrations
echo -e "${YELLOW}⏱️  Running TimescaleDB schema migrations...${NC}"
if docker exec -i segs-timescaledb psql -U segs_user -d segs_db < scripts/init-timescale.sql > /tmp/segs-logs/timescale-migration.log 2>&1; then
    # Check if hypertables already existed
    if grep -q "already exists" /tmp/segs-logs/timescale-migration.log 2>/dev/null; then
        echo -e "${GREEN}   ⏭️  TimescaleDB hypertables already exist - skipped${NC}"
    else
        echo -e "${GREEN}   ✅ TimescaleDB schema initialized successfully${NC}"
    fi
else
    echo -e "${RED}   ❌ TimescaleDB migration failed!${NC}"
    echo "   Check logs: cat /tmp/segs-logs/timescale-migration.log"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Database schemas are ready!${NC}"
echo ""

# ================================================================
# STEP 2: START MICROSERVICES
# ================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  STEP 2: STARTING MICROSERVICES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}1️⃣  Starting Stream Processor...${NC}"
pnpm --filter stream-processor start > /tmp/segs-logs/stream-processor.log 2>&1 &
STREAM_PID=$!
sleep 3
if ps -p $STREAM_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Stream Processor started (PID: $STREAM_PID)${NC}"
else
    echo -e "${RED}   ❌ Stream Processor failed to start${NC}"
    tail -20 /tmp/segs-logs/stream-processor.log
fi
echo "   📄 Logs: tail -f /tmp/segs-logs/stream-processor.log"
sleep 7

echo ""
echo -e "${YELLOW}2️⃣  Starting Alert Service...${NC}"
pnpm --filter alert start > /tmp/segs-logs/alert.log 2>&1 &
ALERT_PID=$!
sleep 3
if ps -p $ALERT_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Alert Service started (PID: $ALERT_PID)${NC}"
else
    echo -e "${RED}   ❌ Alert Service failed to start${NC}"
    tail -20 /tmp/segs-logs/alert.log
fi
echo "   📄 Logs: tail -f /tmp/segs-logs/alert.log"
sleep 7

echo ""
echo -e "${YELLOW}3️⃣  Starting Tariff Service...${NC}"
pnpm --filter tariff start > /tmp/segs-logs/tariff.log 2>&1 &
TARIFF_PID=$!
sleep 3
if ps -p $TARIFF_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Tariff Service started (PID: $TARIFF_PID)${NC}"
else
    echo -e "${RED}   ❌ Tariff Service failed to start${NC}"
    tail -20 /tmp/segs-logs/tariff.log
fi
echo "   📄 Logs: tail -f /tmp/segs-logs/tariff.log"
sleep 2

echo ""
echo -e "${YELLOW}4️⃣  Starting Notification Service...${NC}"
pnpm --filter notification start > /tmp/segs-logs/notification.log 2>&1 &
NOTIFICATION_PID=$!
sleep 3
if ps -p $NOTIFICATION_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Notification Service started (PID: $NOTIFICATION_PID)${NC}"
else
    echo -e "${RED}   ❌ Notification Service failed to start${NC}"
    tail -20 /tmp/segs-logs/notification.log
fi
echo "   📄 Logs: tail -f /tmp/segs-logs/notification.log"
sleep 2

echo ""
echo -e "${YELLOW}5️⃣  Starting API Gateway...${NC}"
pnpm --filter api-gateway start > /tmp/segs-logs/api-gateway.log 2>&1 &
GATEWAY_PID=$!
sleep 3
if ps -p $GATEWAY_PID > /dev/null; then
    echo -e "${GREEN}   ✅ API Gateway started (PID: $GATEWAY_PID)${NC}"
else
    echo -e "${RED}   ❌ API Gateway failed to start${NC}"
    tail -20 /tmp/segs-logs/api-gateway.log
fi
echo "   📄 Logs: tail -f /tmp/segs-logs/api-gateway.log"
sleep 7

echo ""
echo -e "${YELLOW}6️⃣  Starting Ingestion Service...${NC}"
pnpm --filter ingestion start > /tmp/segs-logs/ingestion.log 2>&1 &
INGESTION_PID=$!
sleep 3
if ps -p $INGESTION_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Ingestion Service started (PID: $INGESTION_PID)${NC}"
else
    echo -e "${RED}   ❌ Ingestion Service failed to start${NC}"
    tail -20 /tmp/segs-logs/ingestion.log
fi
echo "   📄 Logs: tail -f /tmp/segs-logs/ingestion.log"
sleep 2

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ALL SERVICES STARTED SUCCESSFULLY!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verify which processes are actually running
echo "📋 Service Status:"
RUNNING_COUNT=0

if ps -p $STREAM_PID > /dev/null 2>&1; then
    echo "   ✅ Stream Processor - PID: $STREAM_PID (Port: 3002)"
    ((RUNNING_COUNT++))
else
    echo "   ❌ Stream Processor - NOT RUNNING"
fi

if ps -p $ALERT_PID > /dev/null 2>&1; then
    echo "   ✅ Alert Service    - PID: $ALERT_PID (Port: 3004)"
    ((RUNNING_COUNT++))
else
    echo "   ❌ Alert Service    - NOT RUNNING"
fi

if ps -p $TARIFF_PID > /dev/null 2>&1; then
    echo "   ✅ Tariff Service   - PID: $TARIFF_PID (Port: 3005)"
    ((RUNNING_COUNT++))
else
    echo "   ❌ Tariff Service   - NOT RUNNING"
fi

if ps -p $NOTIFICATION_PID > /dev/null 2>&1; then
    echo "   ✅ Notification     - PID: $NOTIFICATION_PID (Port: 3003)"
    ((RUNNING_COUNT++))
else
    echo "   ❌ Notification     - NOT RUNNING"
fi

if ps -p $GATEWAY_PID > /dev/null 2>&1; then
    echo "   ✅ API Gateway      - PID: $GATEWAY_PID (Port: 3000)"
    ((RUNNING_COUNT++))
else
    echo "   ❌ API Gateway      - NOT RUNNING"
fi

if ps -p $INGESTION_PID > /dev/null 2>&1; then
    echo "   ✅ Ingestion        - PID: $INGESTION_PID (Port: 3001)"
    ((RUNNING_COUNT++))
else
    echo "   ❌ Ingestion        - NOT RUNNING"
fi

echo ""
echo "📊 Summary: $RUNNING_COUNT/6 services running"
echo ""
echo "📝 Logs Directory: /tmp/segs-logs/"
echo ""
echo "🔍 Health Checks:"
echo "   curl http://localhost:3000/health  # API Gateway"
echo "   curl http://localhost:3001/health  # Ingestion"
echo "   curl http://localhost:3003/health  # Notification"
echo "   curl http://localhost:3004/health  # Alert"
echo "   curl http://localhost:3005/health  # Tariff"
echo "   curl http://localhost:3002/metrics # Stream Processor"
echo ""
echo "🛑 To stop all services: ./STOP_SERVICES.sh"
echo "   Or manually: kill $STREAM_PID $ALERT_PID $TARIFF_PID $NOTIFICATION_PID $GATEWAY_PID $INGESTION_PID"
echo ""
echo "📖 API Documentation: API_RESPONSES.md"
echo ""
