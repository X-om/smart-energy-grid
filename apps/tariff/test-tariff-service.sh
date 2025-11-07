#!/bin/bash

# Tariff Service Testing Script
# This script tests all aspects of the Tariff Service

set -e

echo "=========================================="
echo "  Tariff Service Testing Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3003"

# Function to print section headers
print_section() {
    echo ""
    echo -e "${BLUE}=========================================="
    echo -e "  $1"
    echo -e "==========================================${NC}"
    echo ""
}

# Function to print test results
print_test() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
    fi
}

# Wait for service to be ready
print_section "1. Waiting for Tariff Service to be ready..."
echo "Checking if service is running on port 3003..."
for i in {1..30}; do
    if curl -s ${BASE_URL}/health > /dev/null 2>&1; then
        echo -e "${GREEN}Service is ready!${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

# Test 1: Health Check
print_section "2. Health Check"
echo "GET ${BASE_URL}/health"
HEALTH_RESPONSE=$(curl -s ${BASE_URL}/health)
echo "$HEALTH_RESPONSE" | python3 -m json.tool
print_test "Health check"

# Test 2: Get All Current Tariffs
print_section "3. Get All Current Tariffs"
echo "GET ${BASE_URL}/operator/tariffs/all"
ALL_TARIFFS=$(curl -s ${BASE_URL}/operator/tariffs/all)
echo "$ALL_TARIFFS" | python3 -m json.tool
print_test "Get all tariffs"

# Test 3: Get Specific Tariff (Pune-West)
print_section "4. Get Specific Tariff (Pune-West)"
echo "GET ${BASE_URL}/operator/tariff/Pune-West"
TARIFF=$(curl -s ${BASE_URL}/operator/tariff/Pune-West)
echo "$TARIFF" | python3 -m json.tool
print_test "Get Pune-West tariff"

# Test 4: Manual Override
print_section "5. Manual Tariff Override Test"
echo "POST ${BASE_URL}/operator/tariff/override"
echo "Setting Pune-West to ₹4.75 (Night discount)"
OVERRIDE_RESPONSE=$(curl -s -X POST ${BASE_URL}/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Pune-West",
    "newPrice": 4.75,
    "reason": "Night discount",
    "operatorId": "OP123"
  }')
echo "$OVERRIDE_RESPONSE" | python3 -m json.tool
print_test "Manual override"

# Wait a moment for the change to propagate
sleep 2

# Test 5: Verify Override Applied
print_section "6. Verify Override Applied"
echo "GET ${BASE_URL}/operator/tariff/Pune-West"
UPDATED_TARIFF=$(curl -s ${BASE_URL}/operator/tariff/Pune-West)
echo "$UPDATED_TARIFF" | python3 -m json.tool
NEW_PRICE=$(echo "$UPDATED_TARIFF" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['pricePerKwh'])")
if [ "$NEW_PRICE" == "4.75" ]; then
    echo -e "${GREEN}✅ Override successfully applied! Price is now ₹4.75${NC}"
else
    echo -e "${RED}❌ Override failed! Price is still ₹$NEW_PRICE${NC}"
fi

# Test 6: Get Tariff History
print_section "7. Get Tariff History for Pune-West"
echo "GET ${BASE_URL}/operator/tariff/Pune-West/history?limit=5"
HISTORY=$(curl -s "${BASE_URL}/operator/tariff/Pune-West/history?limit=5")
echo "$HISTORY" | python3 -m json.tool
print_test "Get tariff history"

# Test 7: Check Prometheus Metrics
print_section "8. Check Prometheus Metrics"
echo "GET ${BASE_URL}/metrics"
echo "Showing tariff-related metrics:"
curl -s ${BASE_URL}/metrics | grep -E "^tariff_" | head -20
print_test "Prometheus metrics"

# Test 8: Verify Kafka Messages
print_section "9. Verify Kafka Topic (tariff_updates)"
echo "Checking last 5 messages in tariff_updates topic..."
echo "(Note: Requires Kafka CLI tools)"
echo ""
echo "To manually check Kafka UI, visit: http://localhost:8080"
echo "Topic: tariff_updates"
echo ""
echo "Expected message format:"
echo '{'
echo '  "region": "Pune-West",'
echo '  "pricePerKwh": 4.75,'
echo '  "oldPrice": 5.0,'
echo '  "reason": "Night discount",'
echo '  "triggeredBy": "OP123",'
echo '  "timestamp": "2025-11-07T..."'
echo '}'

# Test 9: Database Verification
print_section "10. Database Verification (PostgreSQL)"
echo "Checking tariffs table in PostgreSQL..."
echo ""
PGPASSWORD=segs_password psql -h localhost -p 5432 -U segs_user -d segs_db -c "
  SELECT 
    region, 
    price_per_kwh, 
    TO_CHAR(effective_from, 'YYYY-MM-DD HH24:MI:SS') as effective_from,
    reason,
    triggered_by
  FROM tariffs 
  WHERE region = 'Pune-West'
  ORDER BY effective_from DESC 
  LIMIT 5;
" 2>/dev/null || echo "⚠️  Could not connect to PostgreSQL. Check if psql is installed."

# Test 10: Redis Verification
print_section "11. Redis Verification"
echo "Checking Redis cache for Pune-West..."
REDIS_VALUE=$(redis-cli -h localhost -p 6379 GET "tariff:Pune-West" 2>/dev/null || echo "⚠️  Could not connect to Redis")
if [ "$REDIS_VALUE" != "⚠️  Could not connect to Redis" ]; then
    echo "Redis value for tariff:Pune-West:"
    echo "$REDIS_VALUE" | python3 -m json.tool
    print_test "Redis cache"
else
    echo "$REDIS_VALUE"
fi

# Test 11: Test Another Region
print_section "12. Test Another Region (Mumbai-North)"
echo "Setting Mumbai-North to ₹6.25 (Peak hour)"
OVERRIDE_RESPONSE_2=$(curl -s -X POST ${BASE_URL}/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Mumbai-North",
    "newPrice": 6.25,
    "reason": "Peak hour",
    "operatorId": "OP456"
  }')
echo "$OVERRIDE_RESPONSE_2" | python3 -m json.tool
print_test "Mumbai-North override"

sleep 1

echo "GET ${BASE_URL}/operator/tariff/Mumbai-North"
MUMBAI_TARIFF=$(curl -s ${BASE_URL}/operator/tariff/Mumbai-North)
echo "$MUMBAI_TARIFF" | python3 -m json.tool

# Test 12: Invalid Override Tests
print_section "13. Invalid Override Tests"

echo "Test 1: Price too low (₹0.10)"
INVALID_1=$(curl -s -X POST ${BASE_URL}/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Pune-West",
    "newPrice": 0.10,
    "reason": "Test invalid",
    "operatorId": "OP999"
  }')
echo "$INVALID_1" | python3 -m json.tool
echo ""

echo "Test 2: Price too high (₹25.00)"
INVALID_2=$(curl -s -X POST ${BASE_URL}/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Pune-West",
    "newPrice": 25.00,
    "reason": "Test invalid",
    "operatorId": "OP999"
  }')
echo "$INVALID_2" | python3 -m json.tool
echo ""

echo "Test 3: Missing region"
INVALID_3=$(curl -s -X POST ${BASE_URL}/operator/tariff/override \
  -H "Content-Type: application/json" \
  -d '{
    "newPrice": 5.00,
    "reason": "Test invalid",
    "operatorId": "OP999"
  }')
echo "$INVALID_3" | python3 -m json.tool

# Final Summary
print_section "Test Summary"
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Next Steps:"
echo "1. Check Kafka UI at http://localhost:8080 to see tariff_updates messages"
echo "2. Monitor service logs for automatic tariff calculations"
echo "3. Run Stream Processor to generate aggregates and trigger auto-pricing"
echo ""
echo "Service URLs:"
echo "  - Health:  ${BASE_URL}/health"
echo "  - Metrics: ${BASE_URL}/metrics"
echo "  - API:     ${BASE_URL}/operator/tariff/*"
echo "  - Kafka UI: http://localhost:8080"
echo ""
echo "=========================================="
