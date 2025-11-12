#!/bin/bash

# Smart Energy Grid System - Startup Script
# Starts all infrastructure and application services

set -e

echo "======================================================================"
echo "  Smart Energy Grid Management System (SEGS) - Startup"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_success "Docker is running"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found. Please install Docker Compose."
    exit 1
fi

print_success "Docker Compose found"
echo ""

# Stop any existing containers
print_info "Stopping any existing SEGS containers..."
docker-compose down 2>/dev/null || true
print_success "Cleaned up existing containers"
echo ""

# Build all services
print_info "Building all services (this may take a few minutes)..."
docker-compose build --parallel
print_success "All services built successfully"
echo ""

# Start infrastructure services first
print_info "Starting infrastructure services..."
docker-compose up -d zookeeper kafka redis postgres timescaledb prometheus grafana
print_success "Infrastructure services started"
echo ""

# Wait for services to be healthy
print_info "Waiting for services to be healthy..."
echo ""

# Wait for Kafka
print_info "  - Waiting for Kafka (this may take 30-60 seconds)..."
timeout=120
counter=0
until docker-compose exec -T kafka kafka-topics --bootstrap-server localhost:29092 --list &> /dev/null; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        print_error "Kafka failed to start within ${timeout}s"
        exit 1
    fi
done
print_success "  - Kafka is ready"

# Wait for PostgreSQL
print_info "  - Waiting for PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U segs_user -d segs_db &> /dev/null; do
    sleep 1
done
print_success "  - PostgreSQL is ready"

# Wait for TimescaleDB
print_info "  - Waiting for TimescaleDB..."
until docker-compose exec -T timescaledb pg_isready -U segs_user -d segs_db &> /dev/null; do
    sleep 1
done
print_success "  - TimescaleDB is ready"

# Wait for Redis
print_info "  - Waiting for Redis..."
until docker-compose exec -T redis redis-cli ping &> /dev/null; do
    sleep 1
done
print_success "  - Redis is ready"

echo ""
print_success "All infrastructure services are healthy"
echo ""

# Create Kafka topics
print_info "Creating Kafka topics..."
docker-compose up -d kafka-init
sleep 5
print_success "Kafka topics created"
echo ""

# Start application services
print_info "Starting application services..."
docker-compose up -d api-gateway ingestion stream-processor tariff alert notification
print_success "Application services started"
echo ""

# Wait a bit for services to initialize
print_info "Waiting for application services to initialize (10 seconds)..."
sleep 10
print_success "Services initialized"
echo ""

# Start simulator last
print_info "Starting telemetry simulator..."
print_info "  Configuration:"
print_info "    - Meters: 5000"
print_info "    - Interval: 10 seconds"
print_info "    - Mode: normal"
print_info "    - Target: HTTP (Ingestion Service)"
print_info "    - Iterations: 0 (infinite)"
docker-compose up -d simulator
print_success "Simulator started"
echo ""

# Show status
echo "======================================================================"
echo "  System Status"
echo "======================================================================"
echo ""
docker-compose ps
echo ""

# Show access URLs
echo "======================================================================"
echo "  Access URLs"
echo "======================================================================"
echo ""
echo "  API Gateway:          http://localhost:3000"
echo "  Swagger Docs:         http://localhost:3000/api-docs"
echo "  Ingestion Service:    http://localhost:3001"
echo "  Stream Processor:     http://localhost:3002"
echo "  Tariff Service:       http://localhost:3003"
echo "  Alert Service:        http://localhost:3004"
echo "  Notification Service: http://localhost:3005"
echo ""
echo "  Kafka UI:             http://localhost:8080"
echo "  Grafana:              http://localhost:3006 (admin/admin)"
echo "  Prometheus:           http://localhost:9090"
echo ""
echo "  PostgreSQL:           localhost:5432 (segs_user/segs_password)"
echo "  TimescaleDB:          localhost:5433 (segs_user/segs_password)"
echo "  Redis:                localhost:6379"
echo ""
echo "======================================================================"
echo ""

print_success "Smart Energy Grid System is now running!"
echo ""
print_info "To view logs: docker-compose logs -f [service-name]"
print_info "To stop:      docker-compose down"
print_info "To restart:   ./start-segs.sh"
echo ""

# Follow logs for all services
read -p "Do you want to follow logs? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose logs -f
fi
