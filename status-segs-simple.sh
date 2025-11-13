#!/bin/bash

echo "=========================================="
echo "  Smart Energy Grid System - Status"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check infrastructure
echo -e "${YELLOW}Infrastructure Status:${NC}"
docker-compose -f docker-compose.infrastructure.yml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check microservices
echo -e "${YELLOW}Microservices Status:${NC}"

check_service() {
  SERVICE=$1
  PORT=$2
  
  if [ -f "logs/$SERVICE.pid" ]; then
    PID=$(cat "logs/$SERVICE.pid")
    if kill -0 $PID 2>/dev/null; then
      # Check if port is listening
      if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $SERVICE (PID: $PID, Port: $PORT) - Running"
      else
        echo -e "  ${YELLOW}⚠${NC} $SERVICE (PID: $PID) - Started but port $PORT not listening"
      fi
    else
      echo -e "  ${RED}✗${NC} $SERVICE - Stopped (stale PID file)"
    fi
  else
    echo -e "  ${RED}✗${NC} $SERVICE - Not started"
  fi
}

check_service "api-gateway" 3000
check_service "ingestion" 3001
check_service "stream-processor" 3002
check_service "tariff" 3003
check_service "alert" 3004
check_service "notification" 3005
check_service "simulator" 3007

echo ""
echo -e "${YELLOW}Quick Links:${NC}"
echo "  Kafka UI:      http://localhost:8080"
echo "  Prometheus:    http://localhost:9090"
echo "  Grafana:       http://localhost:3006"
echo "  API Gateway:   http://localhost:3000"
echo ""
