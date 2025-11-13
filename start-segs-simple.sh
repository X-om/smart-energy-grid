#!/bin/bash

set -e

echo "=========================================="
echo "  Smart Energy Grid System - Startup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Build all services
echo -e "${YELLOW}[1/5] Building all services...${NC}"
pnpm build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Start infrastructure with docker-compose
echo -e "${YELLOW}[2/5] Starting infrastructure (Kafka, Redis, PostgreSQL, TimescaleDB, Prometheus, Grafana)...${NC}"
docker-compose -f docker-compose.yml up -d
echo -e "${GREEN}✓ Infrastructure started${NC}"
echo ""

# Wait for Kafka to be ready
echo -e "${YELLOW}[3/5] Waiting for Kafka to be ready...${NC}"
until docker exec segs-kafka kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; do
    echo "  Waiting for Kafka..."
    sleep 2
done
echo -e "${GREEN}✓ Kafka is ready${NC}"
echo ""

# Create Kafka topics
echo -e "${YELLOW}[4/5] Creating Kafka topics...${NC}"
docker exec segs-kafka kafka-topics --create --if-not-exists --topic raw_readings --bootstrap-server localhost:9092 --partitions 6 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic aggregates_1m --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic aggregates_15m --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic aggregates_1m_regional --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic anomalies --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic tariff_updates --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic alerts --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic tariff_overrides --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic notifications --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic alerts_processed --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic alert_status_updates --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic billing_updates --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic payment_updates --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
docker exec segs-kafka kafka-topics --create --if-not-exists --topic dispute_updates --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
echo -e "${GREEN}✓ Kafka topics created${NC}"
echo ""

# Start all microservices in background
echo -e "${YELLOW}[5/5] Starting microservices...${NC}"

# Create logs directory
mkdir -p logs

# Start API Gateway
echo "  Starting API Gateway on port 3000..."
PORT=3000 pnpm --filter api-gateway start > logs/api-gateway.log 2>&1 &
echo $! > logs/api-gateway.pid

# Start Ingestion Service
echo "  Starting Ingestion Service on port 3001..."
PORT=3001 pnpm --filter ingestion start > logs/ingestion.log 2>&1 &
echo $! > logs/ingestion.pid

# Start Stream Processor
echo "  Starting Stream Processor on port 3002..."
PORT=3002 pnpm --filter stream-processor start > logs/stream-processor.log 2>&1 &
echo $! > logs/stream-processor.pid

# Start Notification Service
echo "  Starting Notification Service on port 3003..."
PORT=3003 pnpm --filter notification start > logs/notification.log 2>&1 &
echo $! > logs/notification.pid

# Start Alert Service
echo "  Starting Alert Service on port 3004..."
PORT=3004 pnpm --filter alert start > logs/alert.log 2>&1 &
echo $! > logs/alert.pid

# Start Tariff Service  
echo "  Starting Tariff Service on port 3005..."
PORT=3005 pnpm --filter tariff start > logs/tariff.log 2>&1 &
echo $! > logs/tariff.pid

# Start Simulator with 5000 meters, 10s interval, normal mode
echo "  Starting Simulator (5000 meters, 10s interval, normal mode)..."
TOTAL_METERS=5000 INTERVAL_MS=10000 ITERATIONS=0 MODE=normal pnpm --filter simulator start > logs/simulator.log 2>&1 &
echo $! > logs/simulator.pid

sleep 3
echo -e "${GREEN}✓ All services started${NC}"
echo ""

echo "=========================================="
echo "  Smart Energy Grid System - RUNNING"
echo "=========================================="
echo ""
echo "Infrastructure:"
echo "  • Kafka UI:      http://localhost:8080"
echo "  • Prometheus:    http://localhost:9090"
echo "  • Grafana:       http://localhost:3006 (admin/admin)"
echo ""
echo "Services:"
echo "  • API Gateway:   http://localhost:3000"
echo "  • Ingestion:     http://localhost:3001"
echo "  • Stream Proc:   http://localhost:3002"
echo "  • Notification:  http://localhost:3003"
echo "  • Alert:         http://localhost:3004"
echo "  • Tariff:        http://localhost:3005"
echo "  • Simulator:     Running (5000 meters)"
echo ""
echo "Logs are in ./logs/ directory"
echo "Use ./stop-segs.sh to stop all services"
echo "Use ./status-segs.sh to check service status"
echo ""
