#!/bin/bash

# Smart Energy Grid - Full Pipeline Startup Script for Phase 4 Testing
# This script starts all services in the correct order to test the telemetry endpoints

set -e

echo "🚀 Starting Smart Energy Grid Full Pipeline for Phase 4 Testing"
echo "================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if infrastructure is running
echo -e "${YELLOW}📋 Checking infrastructure services...${NC}"
if ! docker ps | grep -q segs-kafka; then
    echo -e "${RED}❌ Kafka is not running. Please start infrastructure first:${NC}"
    echo "   docker-compose up -d zookeeper kafka timescaledb redis postgres"
    exit 1
fi

if ! docker ps | grep -q segs-timescaledb; then
    echo -e "${RED}❌ TimescaleDB is not running. Please start it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Infrastructure services are running${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Service startup order
echo -e "${YELLOW}📦 Starting services in order...${NC}"
echo ""

# 1. Stream Processor (must be running before data ingestion)
echo -e "${YELLOW}1️⃣  Starting Stream Processor (port 3002)...${NC}"
if check_port 3002; then
    echo -e "${GREEN}   ✅ Stream Processor already running${NC}"
else
    echo "   Starting in new terminal tab..."
    osascript -e 'tell application "Terminal" to do script "cd /tmp/smart-energy-grid/apps/stream-processor && pnpm dev"'
    sleep 5
fi
echo ""

# 2. Ingestion Service (receives data from simulator, publishes to Kafka)
echo -e "${YELLOW}2️⃣  Starting Ingestion Service (port 3001)...${NC}"
if check_port 3001; then
    echo -e "${GREEN}   ✅ Ingestion Service already running${NC}"
else
    echo "   Starting in new terminal tab..."
    osascript -e 'tell application "Terminal" to do script "cd /tmp/smart-energy-grid/apps/ingestion && pnpm dev"'
    sleep 5
fi
echo ""

# 3. API Gateway (queries TimescaleDB)
echo -e "${YELLOW}3️⃣  Starting API Gateway (port 3000)...${NC}"
if check_port 3000; then
    echo -e "${GREEN}   ✅ API Gateway already running${NC}"
else
    echo "   Starting in new terminal tab..."
    osascript -e 'tell application "Terminal" to do script "cd /tmp/smart-energy-grid/apps/api-gateway && pnpm dev"'
    sleep 5
fi
echo ""

# 4. Simulator (generates test data)
echo -e "${YELLOW}4️⃣  Starting Simulator...${NC}"
echo "   ⚠️  Simulator will start sending data in new terminal tab..."
osascript -e 'tell application "Terminal" to do script "cd /tmp/smart-energy-grid/apps/simulator && pnpm dev"'
echo ""

echo "================================================================"
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "📊 Service Status:"
echo "   - Stream Processor: http://localhost:3002/metrics"
echo "   - Ingestion:        http://localhost:3001/health"
echo "   - API Gateway:      http://localhost:3000/health"
echo "   - Kafka UI:         http://localhost:8080"
echo ""
echo "⏳ Wait 5-10 minutes for data accumulation, then test endpoints:"
echo "   See TESTING_PHASE_4.md for detailed testing instructions"
echo ""
echo "🔍 Monitor data flow:"
echo "   docker exec segs-kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic raw_readings --max-messages 5"
echo ""
echo "📈 Check TimescaleDB data:"
echo "   docker exec segs-timescaledb psql -U segs_user -d segs_db -c 'SELECT COUNT(*) FROM aggregates_1m'"
echo ""
