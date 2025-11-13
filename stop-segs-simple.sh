#!/bin/bash

echo "=========================================="
echo "  Stopping Smart Energy Grid System"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Stop all Node.js services
echo -e "${YELLOW}Stopping microservices...${NC}"

if [ -d "logs" ]; then
  for pidfile in logs/*.pid; do
    if [ -f "$pidfile" ]; then
      PID=$(cat "$pidfile")
      SERVICE=$(basename "$pidfile" .pid)
      if kill -0 $PID 2>/dev/null; then
        echo "  Stopping $SERVICE (PID: $PID)..."
        kill $PID
        rm "$pidfile"
      fi
    fi
  done
fi

# Also kill any remaining node processes for our services
pkill -f "node.*apps/(api-gateway|ingestion|stream-processor|tariff|alert|notification|simulator)" 2>/dev/null || true

echo -e "${GREEN}✓ Microservices stopped${NC}"
echo ""

# Stop infrastructure
echo -e "${YELLOW}Stopping infrastructure...${NC}"
docker-compose -f docker-compose.infrastructure.yml down

if [ "$1" == "-v" ] || [ "$1" == "--volumes" ]; then
  echo -e "${YELLOW}Removing volumes...${NC}"
  docker-compose -f docker-compose.infrastructure.yml down -v
fi

echo -e "${GREEN}✓ Infrastructure stopped${NC}"
echo ""
echo "All services stopped successfully!"
