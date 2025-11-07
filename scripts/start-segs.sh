#!/bin/bash

# Smart Energy Grid System - Complete Startup Script
# Orchestrates the complete system initialization

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Smart Energy Grid Management System (SEGS)      ║${NC}"
echo -e "${CYAN}║            Complete System Startup                 ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print step
print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install Docker first."
    exit 1
fi
print_success "Docker found"

if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose not found. Please install Docker Compose first."
    exit 1
fi
print_success "Docker Compose found"

if ! command -v pnpm &> /dev/null; then
    print_warning "PNPM not found. Installing services via Docker only."
else
    print_success "PNPM found"
fi

# Step 1: Build all services
if command -v pnpm &> /dev/null; then
    print_step "Building all services with Turborepo..."
    pnpm turbo build
    print_success "All services built successfully"
else
    print_warning "Skipping local build (PNPM not installed)"
fi

# Step 2: Start Docker Compose stack
print_step "Starting Docker Compose stack..."
echo ""
echo "This will start:"
echo "  ✓ Infrastructure: Zookeeper, Kafka, Redis, PostgreSQL, TimescaleDB"
echo "  ✓ Monitoring: Prometheus, Grafana, Kafka UI"
echo "  ✓ Microservices: API Gateway, Ingestion, Stream Processor, Tariff, Alert, Notification"
echo ""

docker compose up -d

print_success "Docker stack started"

# Step 3: Wait for services to be healthy
print_step "Waiting for services to become healthy..."
echo ""

MAX_WAIT=180
WAIT_TIME=0

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    # Check if Kafka is ready
    if docker exec segs-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list &> /dev/null; then
        print_success "Kafka is ready"
        break
    fi
    
    echo -n "."
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    print_error "Kafka failed to start within ${MAX_WAIT}s"
    exit 1
fi

# Check PostgreSQL
if docker exec segs-postgres pg_isready -U segs_user -d segs_db &> /dev/null; then
    print_success "PostgreSQL is ready"
else
    print_error "PostgreSQL is not ready"
    exit 1
fi

# Check TimescaleDB
if docker exec segs-timescaledb pg_isready -U segs_user -d segs_db &> /dev/null; then
    print_success "TimescaleDB is ready"
else
    print_error "TimescaleDB is not ready"
    exit 1
fi

# Check Redis
if docker exec segs-redis redis-cli PING &> /dev/null; then
    print_success "Redis is ready"
else
    print_error "Redis is not ready"
    exit 1
fi

# Step 4: Create Kafka topics
print_step "Creating Kafka topics..."
./scripts/create-topics.sh
print_success "Kafka topics created"

# Step 5: Seed database
print_step "Seeding database with initial data..."
./scripts/seed-db.sh
print_success "Database seeded"

# Step 6: Wait for all microservices
print_step "Waiting for microservices to start..."
sleep 15

# Check API Gateway
if curl -sf http://localhost:3000/health &> /dev/null; then
    print_success "API Gateway is healthy"
else
    print_warning "API Gateway is starting (may take a few more seconds)"
fi

# Check Ingestion
if curl -sf http://localhost:3001/health &> /dev/null; then
    print_success "Ingestion Service is healthy"
else
    print_warning "Ingestion Service is starting"
fi

# Step 7: Display access information
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        SEGS System Started Successfully! 🎉        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📚 Service URLs:${NC}"
echo "  ├─ API Gateway:        http://localhost:3000/docs"
echo "  ├─ Ingestion:          http://localhost:3001/health"
echo "  ├─ Stream Processor:   http://localhost:3002/metrics"
echo "  ├─ Tariff Service:     http://localhost:3003/health"
echo "  ├─ Alert Service:      http://localhost:3004/metrics"
echo "  └─ Notification:       http://localhost:3005/health"
echo ""

echo -e "${CYAN}🔧 Infrastructure:${NC}"
echo "  ├─ Kafka UI:           http://localhost:8080"
echo "  ├─ Prometheus:         http://localhost:9090"
echo "  ├─ Grafana:            http://localhost:3006 (admin/admin)"
echo "  ├─ PostgreSQL:         localhost:5432"
echo "  ├─ TimescaleDB:        localhost:5433"
echo "  └─ Redis:              localhost:6379"
echo ""

echo -e "${CYAN}🔑 Test Credentials (password: password123):${NC}"
echo "  ├─ User:      user@example.com"
echo "  ├─ Operator:  operator@example.com"
echo "  └─ Admin:     admin@example.com"
echo ""

echo -e "${CYAN}🚀 Next Steps:${NC}"
echo "  1. Access API documentation:  http://localhost:3000/docs"
echo "  2. Run simulator:             ./scripts/run-simulator.sh"
echo "  3. Check system health:       ./scripts/health-check.sh"
echo "  4. View Kafka topics:         http://localhost:8080"
echo "  5. Monitor metrics:           http://localhost:9090"
echo ""

echo -e "${CYAN}📖 Documentation:${NC}"
echo "  ├─ Deployment Guide:   DEPLOYMENT.md"
echo "  ├─ API Testing Guide:  apps/api-gateway/TESTING.md"
echo "  └─ Main README:        README.md"
echo ""

echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "  • View logs:         docker compose logs -f <service-name>"
echo "  • Stop system:       docker compose down"
echo "  • Restart service:   docker compose restart <service-name>"
echo "  • Full reset:        docker compose down -v"
echo ""

# Optional: Ask to run simulator
echo -e "${BLUE}Would you like to run the simulator now? (y/n)${NC}"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo ""
    print_step "Starting simulator with 100 meters, 5s interval..."
    ./scripts/run-simulator.sh --meters 100 --interval 5000
else
    echo ""
    echo -e "${GREEN}Setup complete! Run './scripts/run-simulator.sh' when ready.${NC}"
fi

echo ""
