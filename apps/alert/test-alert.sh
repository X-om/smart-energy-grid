#!/bin/bash

echo "🧪 Testing Alert Service..."
echo ""

# Test 1: Health Check
echo "1️⃣ Testing health endpoint..."
curl -s http://localhost:3004/health | jq -r '.status, .connections'
echo ""

# Test 2: Send first overload message
echo "2️⃣ Sending first overload message..."
echo '{"region":"Pune-West","timestamp":"2025-11-07T12:10:00Z","meter_count":100,"total_consumption":9500,"avg_consumption":95,"max_consumption":150,"min_consumption":50,"load_percentage":95.5,"active_meters":["meter-001","meter-002"]}' | \
  docker exec -i segs-kafka kafka-console-producer --topic aggregates_1m --broker-list localhost:9092
echo "✅ First message sent"
echo ""

# Wait 2 seconds
sleep 2

# Test 3: Send second overload message
echo "3️⃣ Sending second overload message..."
echo '{"region":"Pune-West","timestamp":"2025-11-07T12:11:00Z","meter_count":100,"total_consumption":9600,"avg_consumption":96,"max_consumption":155,"min_consumption":52,"load_percentage":96.0,"active_meters":["meter-001","meter-002"]}' | \
  docker exec -i segs-kafka kafka-console-producer --topic aggregates_1m --broker-list localhost:9092
echo "✅ Second message sent"
echo ""

# Wait for processing
echo "⏳ Waiting 3 seconds for processing..."
sleep 3
echo ""

# Test 4: Check alerts
echo "4️⃣ Checking created alerts..."
curl -s http://localhost:3004/operator/alerts | jq .
echo ""

# Test 5: Check active alerts
echo "5️⃣ Checking active alerts..."
curl -s http://localhost:3004/operator/alerts/active | jq .
echo ""

# Test 6: Check alert statistics
echo "6️⃣ Checking alert statistics..."
curl -s http://localhost:3004/operator/stats | jq .
echo ""

echo "✅ Test complete!"
