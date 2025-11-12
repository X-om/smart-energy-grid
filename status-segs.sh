#!/bin/bash

# Smart Energy Grid System - Status Check Script
# Shows the status of all services

echo "======================================================================"
echo "  Smart Energy Grid Management System (SEGS) - Status"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if any containers are running
if [ -z "$(docker-compose ps -q)" ]; then
    echo -e "${RED}No services are currently running${NC}"
    echo ""
    echo "To start the system: ./start-segs.sh"
    exit 0
fi

# Show container status
echo "Container Status:"
echo "======================================================================"
docker-compose ps
echo ""

# Count running services
running=$(docker-compose ps --filter "status=running" -q | wc -l | tr -d ' ')
total=$(docker-compose ps -q | wc -l | tr -d ' ')

echo "Summary: $running/$total services running"
echo ""

# Check service health
echo "======================================================================"
echo "Service Health Checks:"
echo "======================================================================"
echo ""

check_http() {
    local name=$1
    local url=$2
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name - healthy"
    else
        echo -e "${RED}✗${NC} $name - not responding"
    fi
}

check_http "API Gateway" "http://localhost:3000/health"
check_http "Ingestion Service" "http://localhost:3001/health"
check_http "Stream Processor" "http://localhost:3002/health"
check_http "Tariff Service" "http://localhost:3003/health"
check_http "Alert Service" "http://localhost:3004/health"
check_http "Notification Service" "http://localhost:3005/health"
check_http "Kafka UI" "http://localhost:8080"
check_http "Grafana" "http://localhost:3006/api/health"
check_http "Prometheus" "http://localhost:9090/-/healthy"

echo ""

# Check Kafka topics
if docker-compose exec -T kafka kafka-topics --bootstrap-server localhost:29092 --list &> /dev/null; then
    echo "======================================================================"
    echo "Kafka Topics:"
    echo "======================================================================"
    docker-compose exec -T kafka kafka-topics --bootstrap-server localhost:29092 --list | sort
    echo ""
fi

# Show recent logs summary
echo "======================================================================"
echo "Recent Activity (last 10 lines):"
echo "======================================================================"
docker-compose logs --tail=10 simulator 2>/dev/null | grep -E "(Generated|Sent|batch)" || echo "No recent simulator activity"

echo ""
echo "======================================================================"
echo ""
echo "Useful commands:"
echo "  View all logs:        docker-compose logs -f"
echo "  View service logs:    docker-compose logs -f [service-name]"
echo "  Restart service:      docker-compose restart [service-name]"
echo "  Stop all:             ./stop-segs.sh"
echo ""
