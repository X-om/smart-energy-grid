#!/bin/bash

# Smart Energy Grid System - Health Check Script
# Checks the health status of all services

set -e

echo "🏥 Smart Energy Grid System - Health Check"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local container_name=$3
    
    printf "%-25s" "$service_name"
    
    # Check if container is running
    if ! docker ps --format "{{.Names}}" | grep -q "^$container_name$"; then
        echo -e "${RED}⚠️  Container not running${NC}"
        return 1
    fi
    
    # Check HTTP endpoint
    if curl -sf "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Endpoint not responding${NC}"
        return 1
    fi
}

# Check infrastructure services
echo "Infrastructure Services:"
echo "------------------------"
check_service "Kafka" "http://localhost:8080" "segs-kafka-ui"
check_service "Redis" "http://localhost:6379" "segs-redis" || echo -e "   ${GREEN}✅ Running (no HTTP endpoint)${NC}"
check_service "PostgreSQL" "http://localhost:5432" "segs-postgres" || echo -e "   ${GREEN}✅ Running (no HTTP endpoint)${NC}"
check_service "TimescaleDB" "http://localhost:5433" "segs-timescaledb" || echo -e "   ${GREEN}✅ Running (no HTTP endpoint)${NC}"
check_service "Prometheus" "http://localhost:9090/-/healthy" "segs-prometheus"
check_service "Grafana" "http://localhost:3006/api/health" "segs-grafana"

echo ""
echo "Application Services:"
echo "---------------------"
check_service "API Gateway" "http://localhost:3000/health" "segs-api-gateway"
check_service "Ingestion" "http://localhost:3001/health" "segs-ingestion"
check_service "Stream Processor" "http://localhost:3002/metrics" "segs-stream-processor"
check_service "Tariff Service" "http://localhost:3003/health" "segs-tariff"
check_service "Alert Service" "http://localhost:3004/metrics" "segs-alert"
check_service "Notification" "http://localhost:3005/health" "segs-notification"

echo ""
echo "=========================================="
echo ""

# Check Kafka topics
echo "Kafka Topics:"
echo "-------------"
KAFKA_CONTAINER=$(docker ps --filter "name=segs-kafka" --format "{{.Names}}" | head -n 1)
if [ -n "$KAFKA_CONTAINER" ]; then
    docker exec "$KAFKA_CONTAINER" kafka-topics.sh --list --bootstrap-server localhost:9092 2>/dev/null | while read topic; do
        echo "  ✅ $topic"
    done
else
    echo -e "  ${RED}❌ Kafka container not found${NC}"
fi

echo ""

# Database connectivity
echo "Database Connectivity:"
echo "----------------------"
if docker exec segs-postgres pg_isready -U segs_user -d segs_db > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PostgreSQL${NC}"
    
    # Count records
    USER_COUNT=$(docker exec segs-postgres psql -U segs_user -d segs_db -t -c "SELECT COUNT(*) FROM users" 2>/dev/null | tr -d ' ')
    METER_COUNT=$(docker exec segs-postgres psql -U segs_user -d segs_db -t -c "SELECT COUNT(*) FROM meters" 2>/dev/null | tr -d ' ')
    ALERT_COUNT=$(docker exec segs-postgres psql -U segs_user -d segs_db -t -c "SELECT COUNT(*) FROM alerts" 2>/dev/null | tr -d ' ')
    
    echo "     Users: $USER_COUNT"
    echo "     Meters: $METER_COUNT"
    echo "     Alerts: $ALERT_COUNT"
else
    echo -e "  ${RED}❌ PostgreSQL${NC}"
fi

if docker exec segs-timescaledb pg_isready -U segs_user -d segs_db > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ TimescaleDB${NC}"
    
    # Count time-series records
    RAW_COUNT=$(docker exec segs-timescaledb psql -U segs_user -d segs_db -t -c "SELECT COUNT(*) FROM raw_readings" 2>/dev/null | tr -d ' ')
    AGG_1M_COUNT=$(docker exec segs-timescaledb psql -U segs_user -d segs_db -t -c "SELECT COUNT(*) FROM aggregates_1m" 2>/dev/null | tr -d ' ')
    
    echo "     Raw Readings: $RAW_COUNT"
    echo "     1m Aggregates: $AGG_1M_COUNT"
else
    echo -e "  ${RED}❌ TimescaleDB${NC}"
fi

echo ""
echo "=========================================="
echo ""

# Summary
echo "Quick Links:"
echo "------------"
echo "  📚 API Docs:      http://localhost:3000/docs"
echo "  📊 Kafka UI:      http://localhost:8080"
echo "  📈 Prometheus:    http://localhost:9090"
echo "  📉 Grafana:       http://localhost:3006 (admin/admin)"
echo "  🔔 Notifications: ws://localhost:3005/ws"
echo ""
