#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get JWT token
echo -e "${BLUE}=== Getting JWT Token ===${NC}"
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alerttest@test.com","password":"Test123!@#"}' | jq -r '.data.tokens.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get token${NC}"
  exit 1
fi

echo -e "${GREEN}Token obtained${NC}\n"

# Test 1: Get user's alerts
echo -e "${BLUE}=== Test 1: GET /api/v1/alerts (User's alerts) ===${NC}"
curl -s -X GET "http://localhost:3000/api/v1/alerts" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "\n"

# Test 2: Get specific alert by ID (get first alert ID from previous response)
ALERT_ID=$(curl -s -X GET "http://localhost:3000/api/v1/alerts" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.alerts[0].id')

echo -e "${BLUE}=== Test 2: GET /api/v1/alerts/:alertId ===${NC}"
echo "Alert ID: $ALERT_ID"
curl -s -X GET "http://localhost:3000/api/v1/alerts/$ALERT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "\n"

# Test 3: Filter by status
echo -e "${BLUE}=== Test 3: GET /api/v1/alerts?status=active ===${NC}"
curl -s -X GET "http://localhost:3000/api/v1/alerts?status=active" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "\n"

# Test 4: Filter by severity
echo -e "${BLUE}=== Test 4: GET /api/v1/alerts?severity=critical ===${NC}"
curl -s -X GET "http://localhost:3000/api/v1/alerts?severity=critical" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "\n"

echo -e "${GREEN}=== All User Alert Tests Complete ===${NC}"
