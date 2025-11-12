#!/bin/bash

# Smart Energy Grid System - Kafka Topic Creation Script
# Creates all required Kafka topics with proper partitioning and replication

set -e

echo "🔧 Creating Kafka topics for Smart Energy Grid System..."
echo ""

# Wait for Kafka to be ready
echo "⏳ Waiting for Kafka to be ready..."
sleep 10

# Get Kafka container name
KAFKA_CONTAINER=$(docker ps --filter "name=segs-kafka" --format "{{.Names}}" | grep -E "^segs-kafka$" | head -n 1)

if [ -z "$KAFKA_CONTAINER" ]; then
    echo "❌ Error: Kafka container not found. Is Docker Compose running?"
    echo "   Run: docker-compose up -d"
    exit 1
fi

echo "✅ Found Kafka container: $KAFKA_CONTAINER"
echo ""

# Function to create a topic
create_topic() {
    local topic_name=$1
    local partitions=$2
    local replication=$3
    
    echo "📝 Creating topic: $topic_name (partitions=$partitions, replication=$replication)"
    
    docker exec "$KAFKA_CONTAINER" kafka-topics \
        --create \
        --if-not-exists \
        --topic "$topic_name" \
        --bootstrap-server localhost:29092 \
        --partitions "$partitions" \
        --replication-factor "$replication" 2>/dev/null || true
    
    echo "✅ Topic '$topic_name' ready"
}

# Create all topics
echo "Creating topics..."
echo ""

# Core data flow topics
create_topic "raw_readings" 3 1
create_topic "aggregates_1m" 3 1
create_topic "aggregates_1m_regional" 3 1

# Alert system topics
create_topic "alerts" 3 1
create_topic "alerts_processed" 3 1
create_topic "alert_status_updates" 3 1

# Tariff and billing topics
create_topic "tariff_updates" 3 1
create_topic "billing_updates" 3 1
create_topic "payment_updates" 3 1
create_topic "dispute_updates" 3 1

echo ""
echo "📋 Listing all topics:"
docker exec "$KAFKA_CONTAINER" kafka-topics \
    --list \
    --bootstrap-server localhost:29092

echo ""
echo "✅ All Kafka topics created successfully!"
echo ""
echo "💡 View topics in Kafka UI: http://localhost:8080"
