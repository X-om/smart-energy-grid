#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get operator token
echo -e "${BLUE}=== Getting Operator Token ===${NC}"
OP_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operatortest@test.com","password":"Op123!@#"}' | jq -r '.data.tokens.accessToken')

if [ "$OP_TOKEN" == "null" ] || [ -z "$OP_TOKEN" ]; then
  echo -e "${RED}Failed to get operator token${NC}"
  exit 1
fi

echo -e "${GREEN}Operator token obtained${NC}\n"

# Get alert ID for testing
ALERT_ID=$(curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/all" \
  -H "Authorization: Bearer $OP_TOKEN" | jq -r '.data.alerts[0].id')

echo -e "${YELLOW}Using Alert ID: $ALERT_ID${NC}\n"

# Test with fixed payloads
echo -e "${BLUE}=== Test: POST /api/v1/alerts/operator/:alertId/acknowledge ===${NC}"
curl -s -X POST "http://localhost:3000/api/v1/alerts/operator/$ALERT_ID/acknowledge" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"acknowledged_by":"operatortest"}' | jq .
echo -e "\n"

echo -e "${BLUE}=== Test: POST /api/v1/alerts/operator/:alertId/resolve ===${NC}"
curl -s -X POST "http://localhost:3000/api/v1/alerts/operator/$ALERT_ID/resolve" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operatorId":"operatortest","resolution":"Fixed by operator","notes":"Test resolution"}' | jq .
echo -e "\n"

echo -e "${GREEN}=== Operator Alert Action Tests Complete ===${NC}"
