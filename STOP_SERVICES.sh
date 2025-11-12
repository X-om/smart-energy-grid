#!/bin/bash

# Smart Energy Grid - Stop All Services Script
# This script stops all running microservices

echo "🛑 Stopping Smart Energy Grid Microservices..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill all pnpm processes running services
echo -e "${YELLOW}Stopping pnpm processes...${NC}"
pkill -f "pnpm.*--filter.*start" 2>/dev/null && echo "   ✅ pnpm processes stopped" || echo "   ℹ️  No pnpm processes found"

# Kill all node processes running our services
echo -e "${YELLOW}Stopping Node.js processes...${NC}"
pkill -f "node.*dist.*stream-processor" 2>/dev/null && echo "   ✅ Stream Processor stopped" || true
pkill -f "node.*dist.*alert" 2>/dev/null && echo "   ✅ Alert Service stopped" || true
pkill -f "node.*dist.*tariff" 2>/dev/null && echo "   ✅ Tariff Service stopped" || true
pkill -f "node.*dist.*notification" 2>/dev/null && echo "   ✅ Notification Service stopped" || true
pkill -f "node.*dist.*api-gateway" 2>/dev/null && echo "   ✅ API Gateway stopped" || true
pkill -f "node.*dist.*ingestion" 2>/dev/null && echo "   ✅ Ingestion Service stopped" || true
pkill -f "node.*dist.*simulator" 2>/dev/null && echo "   ✅ Simulator stopped" || true

# Wait a moment for processes to terminate
sleep 1

# Force kill any remaining processes
echo -e "${YELLOW}Checking for remaining processes...${NC}"
remaining=$(ps aux | grep -E "node.*(dist|pnpm)" | grep -v grep | grep -v STOP_SERVICES | awk '{print $2}')
if [ -n "$remaining" ]; then
    echo "   ⚠️  Force killing remaining processes..."
    echo "$remaining" | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Clear ports just to be sure
echo -e "${YELLOW}Clearing ports...${NC}"
lsof -ti:3000,3001,3002,3003,3004,3005 2>/dev/null | xargs kill -9 2>/dev/null && echo "   ✅ Ports cleared" || echo "   ℹ️  Ports already free"

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
echo ""

# Verify no services are running
remaining=$(ps aux | grep -E "node.*dist/(apps|index)" | grep -v grep | wc -l | tr -d ' ')
if [ "$remaining" -gt 0 ]; then
    echo -e "${RED}⚠️  Warning: $remaining Node.js process(es) still running${NC}"
    ps aux | grep -E "node.*dist" | grep -v grep
else
    echo -e "${GREEN}✅ No services running${NC}"
fi

echo ""
