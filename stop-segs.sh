#!/bin/bash

# Smart Energy Grid System - Stop Script
# Stops all services gracefully

set -e

echo "======================================================================"
echo "  Smart Energy Grid Management System (SEGS) - Shutdown"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Ask for confirmation if volumes should be removed
read -p "Do you want to remove volumes (will delete all data)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Stopping all services and removing volumes..."
    docker-compose down -v
    print_success "All services stopped and volumes removed"
else
    print_info "Stopping all services (preserving data volumes)..."
    docker-compose down
    print_success "All services stopped (data preserved)"
fi

echo ""
print_success "Smart Energy Grid System has been shut down"
echo ""
print_info "To start again: ./start-segs.sh or docker-compose up -d"
echo ""
