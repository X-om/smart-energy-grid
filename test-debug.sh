#!/bin/bash

# Get operator token
OP_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operatortest@test.com","password":"Op123!@#"}' | jq -r '.data.tokens.accessToken')

# Get alert ID
ALERT_ID=$(curl -s -X GET "http://localhost:3000/api/v1/alerts/operator/active" \
  -H "Authorization: Bearer $OP_TOKEN" | jq -r '.data.alerts[0].id')

echo "Alert ID: $ALERT_ID"
echo "Operator Token: ${OP_TOKEN:0:20}..."
echo ""

# Test directly to alert service (not through API Gateway)
echo "=== Direct to Alert Service (should fail - no auth) ==="
curl -s -X POST "http://localhost:3004/operator/alerts/$ALERT_ID/acknowledge" \
  -H "Content-Type: application/json" \
  -d '{"operatorId":"testop"}' | jq .

