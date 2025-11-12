#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get operator token
OP_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operatortest@test.com","password":"Op123!@#"}' | jq -r '.data.tokens.accessToken')

# Get fresh alert ID
ALERT_ID=$(curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/active" \
  -H "Authorization: Bearer $OP_TOKEN" | jq -r '.data.alerts[] | select(.acknowledged == false) | .id' | head -1)

echo -e "${BLUE}Testing Alert ID: $ALERT_ID${NC}\n"

echo -e "${BLUE}=== Acknowledge Alert ===${NC}"
curl -s -X POST "http://localhost:3000/api/v1/alerts/operator/$ALERT_ID/acknowledge" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operatorId":"operatortest","acknowledged_by":"operatortest"}' | jq .
echo -e "\n"

echo -e "${BLUE}=== Resolve Alert ===${NC}"
curl -s -X POST "http://localhost:3000/api/v1/alerts/operator/$ALERT_ID/resolve" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operatorId":"operatortest","resolution":"Test resolution complete"}' | jq .
echo -e "\n"

echo -e "${GREEN}Complete!${NC}"
