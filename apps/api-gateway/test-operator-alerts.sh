#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get operator token
echo -e "${BLUE}=== Getting Operator Token ===${NC}"
OP_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operatortest@test.com","password":"Op123!@#"}' | jq -r '.data.tokens.accessToken')

if [ "$OP_TOKEN" == "null" ] || [ -z "$OP_TOKEN" ]; then
  echo -e "${RED}Failed to get operator token${NC}"
  curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"operatortest@test.com","password":"Op123!@#"}' | jq .
  exit 1
fi

echo -e "${GREEN}Operator token obtained${NC}\n"

# Test operator routes
echo -e "${BLUE}=== Test 1: GET /api/v1/alerts/operator/all ===${NC}"
curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/all" \
  -H "Authorization: Bearer $OP_TOKEN" | jq .
echo -e "\n"

ALERT_ID=$(curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/all" \
  -H "Authorization: Bearer $OP_TOKEN" | jq -r '.data.alerts[0].id')

echo -e "${BLUE}=== Test 2: GET /api/v1/alerts/operator/:alertId ===${NC}"
echo "Alert ID: $ALERT_ID"
curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/$ALERT_ID" \
  -H "Authorization: Bearer $OP_TOKEN" | jq .
echo -e "\n"

echo -e "${BLUE}=== Test 3: GET /api/v1/alerts/operator/active ===${NC}"
curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/active" \
  -H "Authorization: Bearer $OP_TOKEN" | jq .
echo -e "\n"

echo -e "${BLUE}=== Test 4: GET /api/v1/alerts/operator/stats ===${NC}"
curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/stats" \
  -H "Authorization: Bearer $OP_TOKEN" | jq .
echo -e "\n"

echo -e "${BLUE}=== Test 5: POST /api/v1/alerts/operator/:alertId/acknowledge ===${NC}"
curl -s -X POST "http://localhost:3000/api/v1/alerts/operator/$ALERT_ID/acknowledge" \
  -H "Authorization: Bearer $OP_TOKEN" | jq .
echo -e "\n"

echo -e "${BLUE}=== Test 6: GET /api/v1/alerts/operator/history/Mumbai-North ===${NC}"
curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/history/Mumbai-North" \
  -H "Authorization: Bearer $OP_TOKEN" | jq .
echo -e "\n"

echo -e "${BLUE}=== Test 7: POST /api/v1/alerts/operator/:alertId/resolve ===${NC}"
curl -s -X POST "http://localhost:3000/api/v1/alerts/operator/$ALERT_ID/resolve" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"Fixed by operator","notes":"Test resolution"}' | jq .
echo -e "\n"

echo -e "${GREEN}=== All Operator Alert Tests Complete ===${NC}"
