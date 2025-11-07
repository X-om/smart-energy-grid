#!/bin/bash

# Quick Start Script for Tariff Service Testing
echo "=================================================="
echo "  Tariff Service - Quick Test Setup"
echo "=================================================="
echo ""

# Step 1: Start Tariff Service in background
echo "Step 1: Starting Tariff Service..."
cd /tmp/smart-energy-grid/apps/tariff
node dist/index.js > tariff.log 2>&1 &
TARIFF_PID=$!
echo "Tariff Service started with PID: $TARIFF_PID"
echo "Logs: /tmp/smart-energy-grid/apps/tariff/tariff.log"
echo ""

# Wait for service to be ready
echo "Waiting for service to be ready..."
for i in {1..15}; do
    if curl -s http://localhost:3003/health > /dev/null 2>&1; then
        echo "✅ Service is ready!"
        break
    fi
    sleep 1
done

echo ""
echo "=================================================="
echo "  Service is now running!"
echo "=================================================="
echo ""
echo "In a new terminal, run these commands:"
echo ""
echo "# 1. Test health check:"
echo "curl http://localhost:3003/health | jq"
echo ""
echo "# 2. Get all current tariffs:"
echo "curl http://localhost:3003/operator/tariffs/all | jq"
echo ""
echo "# 3. Manual override (Pune-West → ₹4.75):"
echo "curl -X POST http://localhost:3003/operator/tariff/override \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"region\":\"Pune-West\",\"newPrice\":4.75,\"reason\":\"Night discount\"}' | jq"
echo ""
echo "# 4. Check Kafka UI:"
echo "open http://localhost:8080"
echo "Navigate to Topics → tariff_updates → Messages"
echo ""
echo "# 5. Or run the comprehensive test script:"
echo "cd /tmp/smart-energy-grid/apps/tariff"
echo "./test-tariff-service.sh"
echo ""
echo "=================================================="
echo "To stop the service:"
echo "kill $TARIFF_PID"
echo "=================================================="
echo ""
